from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import UpdateOne
from pymongo.errors import DuplicateKeyError

from ..auth import User, get_current_user
from ..db import reminders_collection
from ..models import ReminderIn, ReminderOut, ReminderPatch, ReorderItem

router = APIRouter(
    prefix="/api/reminders",
    tags=["reminders"],
    dependencies=[Depends(get_current_user)],
)


def _serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


def _oid(id_: str) -> ObjectId:
    try:
        return ObjectId(id_)
    except InvalidId as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found") from exc


@router.get("", response_model=list[ReminderOut])
async def list_reminders(user: User = Depends(get_current_user)):
    cursor = reminders_collection().find({"owner_id": user.sub}).sort("order_index", 1)
    return [_serialize(doc) async for doc in cursor]


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    payload: ReminderIn,
    user: User = Depends(get_current_user),
):
    coll = reminders_collection()
    count = await coll.count_documents({"owner_id": user.sub})
    doc = {
        "owner_id": user.sub,
        "text": payload.text,
        "kind": payload.kind,
        "due_at": payload.due_at,
        "end_at": payload.end_at,
        "notes": payload.notes,
        "completed": False,
        "order_index": count,
        "application_id": payload.application_id,
        "created_at": datetime.now(timezone.utc),
    }
    if payload.nudge_id:
        doc["nudge_id"] = payload.nudge_id
    try:
        result = await coll.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "This nudge is already in your reminders") from exc
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.put("/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_reminders(
    items: list[ReorderItem],
    user: User = Depends(get_current_user),
):
    if not items:
        return
    ops = [
        UpdateOne(
            {"_id": _oid(item.id), "owner_id": user.sub},
            {"$set": {"order_index": item.order_index}},
        )
        for item in items
    ]
    await reminders_collection().bulk_write(ops)


@router.put("/{rem_id}", response_model=ReminderOut)
async def update_reminder(
    rem_id: str,
    payload: ReminderPatch,
    user: User = Depends(get_current_user),
):
    updates = payload.model_dump(by_alias=False, exclude_unset=True)
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")
    result = await reminders_collection().find_one_and_update(
        {"_id": _oid(rem_id), "owner_id": user.sub},
        {"$set": updates},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return _serialize(result)


@router.delete("/{rem_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(rem_id: str, user: User = Depends(get_current_user)):
    result = await reminders_collection().delete_one(
        {"_id": _oid(rem_id), "owner_id": user.sub}
    )
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
