from fastapi import APIRouter, Depends

from ..auth import User, get_current_user

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/api/secure/ping")
async def secure_ping(user: User = Depends(get_current_user)) -> dict[str, str]:
    return {"ok": "secure", "sub": user.sub}
