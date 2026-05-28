from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import User, get_current_user
from ..db import applications_collection
from ..models import JobApplicationIn, JobApplicationOut, JobApplicationPatch

router = APIRouter(
    prefix="/api/applications",
    tags=["applications"],
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
    doc["owner_id"] = user.sub
    doc["created_at"] = datetime.now(timezone.utc)
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

    result = await applications_collection().find_one_and_update(
        {"_id": _oid(app_id), "owner_id": user.sub},
        {"$set": updates},
        return_document=True,
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
