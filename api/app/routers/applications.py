from datetime import datetime, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import User, get_current_user
from ..db import applications_collection
from ..models import (
    JobApplicationIn,
    JobApplicationOut,
    JobApplicationPatch,
    StatusChangeDatePatch,
)
from ..timeline import (
    applied_at,
    history_for,
    initial_history,
    with_applied_date,
    with_status_change,
)

router = APIRouter(
    prefix="/api/applications",
    tags=["applications"],
    dependencies=[Depends(get_current_user)],
)


def _serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    doc["status_history"] = history_for(doc)
    return doc


def _oid(id_: str) -> ObjectId:
    try:
        return ObjectId(id_)
    except InvalidId as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found") from exc


@router.get("", response_model=list[JobApplicationOut])
async def list_applications(user: User = Depends(get_current_user)):
    cursor = applications_collection().find({"owner_id": user.sub}).sort("created_at", -1)
    return [_serialize(doc) async for doc in cursor]


@router.post("", response_model=JobApplicationOut, status_code=status.HTTP_201_CREATED)
async def create_application(
    payload: JobApplicationIn,
    user: User = Depends(get_current_user),
):
    doc = payload.model_dump(by_alias=False)
    now = datetime.now(timezone.utc)
    doc["owner_id"] = user.sub
    doc["created_at"] = now
    doc["status_history"] = initial_history(doc["status"], applied_at(doc), now)
    result = await applications_collection().insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.put("/{app_id}", response_model=JobApplicationOut)
async def update_application(
    app_id: str,
    payload: JobApplicationPatch,
    user: User = Depends(get_current_user),
):
    updates = payload.model_dump(by_alias=False, exclude_unset=True)
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")

    query = {"_id": _oid(app_id), "owner_id": user.sub}
    if "status" in updates or "date_applied" in updates:
        current = await applications_collection().find_one(query)
        if current is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        if "date_applied" in updates:
            current = {**current, "status_history": with_applied_date(current, updates["date_applied"])}
            updates["status_history"] = current["status_history"]
        if updates.get("status") is not None:
            changed = with_status_change(current, updates["status"], datetime.now(timezone.utc))
            if changed is not None:
                updates["status_history"] = changed

    result = await applications_collection().find_one_and_update(
        query,
        {"$set": updates},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return _serialize(result)


@router.put("/{app_id}/history/{index}", response_model=JobApplicationOut)
async def update_status_change_date(
    app_id: str,
    index: int,
    payload: StatusChangeDatePatch,
    user: User = Depends(get_current_user),
):
    """Correct when a status change happened (e.g. the card was moved days after
    the interview was actually booked). Entries must stay in chronological order."""
    query = {"_id": _oid(app_id), "owner_id": user.sub}
    current = await applications_collection().find_one(query)
    if current is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")

    history = history_for(current)
    if not 0 <= index < len(history):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such timeline entry")

    at = payload.at if payload.at.tzinfo else payload.at.replace(tzinfo=timezone.utc)
    if at > datetime.now(timezone.utc) + timedelta(days=1):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Date can't be in the future")
    prev_at = next((e["at"] for e in reversed(history[:index]) if e.get("at")), None)
    next_at = next((e["at"] for e in history[index + 1 :] if e.get("at")), None)
    if (prev_at and at < prev_at) or (next_at and at > next_at):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Date must fall between the previous and next timeline entries",
        )

    history[index] = {**history[index], "at": at}
    updates: dict = {"status_history": history}
    if index == 0 and history[0]["status"] == "Applied":
        # The opening entry *is* the applied date — keep the two in sync.
        updates["date_applied"] = at.date().isoformat()

    result = await applications_collection().find_one_and_update(
        query, {"$set": updates}, return_document=True
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return _serialize(result)


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(app_id: str, user: User = Depends(get_current_user)):
    result = await applications_collection().delete_one(
        {"_id": _oid(app_id), "owner_id": user.sub}
    )
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
