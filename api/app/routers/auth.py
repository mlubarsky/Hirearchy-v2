from datetime import datetime, timezone

from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

Theme = Literal["light", "dark"]

from ..auth import (
    User,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from ..db import (
    achievements_collection,
    applications_collection,
    reminders_collection,
    users_collection,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    theme: Optional[Theme] = None


class UserResponse(BaseModel):
    id: str
    email: str
    name: str | None = None
    theme: Optional[Theme] = None


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


def _user_to_response(doc: dict) -> UserResponse:
    return UserResponse(
        id=str(doc["_id"]),
        email=doc["email"],
        name=doc.get("name"),
        theme=doc.get("theme"),
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(req: SignupRequest) -> AuthResponse:
    coll = users_collection()
    existing = await coll.find_one({"email": req.email.lower()})
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    doc = {
        "email": req.email.lower(),
        "password_hash": hash_password(req.password),
        "name": req.name,
        "created_at": datetime.now(timezone.utc),
    }
    result = await coll.insert_one(doc)
    doc["_id"] = result.inserted_id

    token = create_access_token(str(doc["_id"]))
    return AuthResponse(token=token, user=_user_to_response(doc))


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest) -> AuthResponse:
    doc = await users_collection().find_one({"email": req.email.lower()})
    if doc is None or not verify_password(req.password, doc["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    token = create_access_token(str(doc["_id"]))
    return AuthResponse(token=token, user=_user_to_response(doc))


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)) -> UserResponse:
    # Read from the DB so the response includes persisted fields (theme, name).
    doc = await users_collection().find_one({"_id": ObjectId(user.sub)})
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return _user_to_response(doc)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    req: UpdateProfileRequest,
    user: User = Depends(get_current_user),
) -> UserResponse:
    updates: dict = {}
    if req.name is not None:
        updates["name"] = req.name.strip() or None
    if req.theme is not None:
        updates["theme"] = req.theme
    if updates:
        await users_collection().update_one(
            {"_id": ObjectId(user.sub)}, {"$set": updates}
        )
    doc = await users_collection().find_one({"_id": ObjectId(user.sub)})
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return _user_to_response(doc)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(user: User = Depends(get_current_user)) -> None:
    # Cascade-delete everything this user owns, then the account itself.
    # (Resume text lives on the user doc, so it goes with the user.)
    await applications_collection().delete_many({"owner_id": user.sub})
    await reminders_collection().delete_many({"owner_id": user.sub})
    await achievements_collection().delete_many({"owner_id": user.sub})
    await users_collection().delete_one({"_id": ObjectId(user.sub)})
