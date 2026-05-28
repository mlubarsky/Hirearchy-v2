from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, Request, status
from jose import jwt
from jose.exceptions import JWTError
from passlib.context import CryptContext

from .config import Settings, get_settings
from .db import users_collection

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


@dataclass(frozen=True)
class User:
    sub: str  # user._id stringified — kept as `sub` for callsite parity across the codebase
    email: str
    name: str | None


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def create_access_token(user_id: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.jwt_expires_hours)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def _bearer_token(request: Request) -> str:
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    return auth.split(" ", 1)[1].strip()


async def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> User:
    token = _bearer_token(request)
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            # Pin the algorithm allowlist to our single symmetric alg. This is what
            # prevents the classic JWT attacks: "alg":"none" forgery and HS/RS
            # algorithm-confusion. Never let the token header dictate the algorithm.
            algorithms=[settings.jwt_alg],
            # Reject tokens with no expiry, and enforce the expiry that's present.
            options={"require_exp": True, "verify_exp": True, "verify_signature": True},
        )
    except JWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {exc}") from exc

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing sub claim")

    try:
        oid = ObjectId(user_id)
    except InvalidId as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid user id") from exc

    doc = await users_collection().find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")

    return User(sub=str(doc["_id"]), email=doc["email"], name=doc.get("name"))
