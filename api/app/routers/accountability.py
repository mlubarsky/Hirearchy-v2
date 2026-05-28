from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from pymongo.errors import DuplicateKeyError

from ..accountability import MILESTONES, compute_summary
from ..auth import User, get_current_user
from ..db import achievements_collection, applications_collection, reminders_collection, users_collection

router = APIRouter(
    prefix="/api/accountability",
    tags=["accountability"],
    dependencies=[Depends(get_current_user)],
)

DEFAULT_WEEKLY_TARGET = 5


def _alias(snake: str) -> str:
    parts = snake.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


class MilestoneInfo(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_alias)

    code: str
    label: str
    description: str
    icon: str


class SummaryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_alias)

    xp: int
    streak: int
    longest_streak: int
    weekly_target: int
    weekly_completed: int
    week_start: datetime
    total_applications: int
    by_status: dict[str, int]
    unlocked_milestones: list[str]
    newly_unlocked: list[str]
    catalog: list[MilestoneInfo]


class SettingsRequest(BaseModel):
    weekly_target: int = Field(ge=0, le=200, alias="weeklyTarget")
    model_config = ConfigDict(populate_by_name=True)


async def _persist_unlocks(owner_id: str, codes: set[str]) -> None:
    if not codes:
        return
    now = datetime.now(timezone.utc)
    coll = achievements_collection()
    for code in codes:
        try:
            await coll.insert_one({"owner_id": owner_id, "code": code, "unlocked_at": now})
        except DuplicateKeyError:
            # Another concurrent request raced us. Fine — the milestone exists.
            pass


@router.get("/summary", response_model=SummaryResponse)
async def summary(user: User = Depends(get_current_user)) -> SummaryResponse:
    # Pull user doc for weekly_target.
    user_doc = await users_collection().find_one({"_id": ObjectId(user.sub)})
    weekly_target = (user_doc or {}).get("weekly_target", DEFAULT_WEEKLY_TARGET)

    applications = [doc async for doc in applications_collection().find({"owner_id": user.sub})]
    reminders = [doc async for doc in reminders_collection().find({"owner_id": user.sub})]
    persisted = {
        d["code"] async for d in achievements_collection().find({"owner_id": user.sub})
    }

    summary, newly_unlocked = compute_summary(
        applications=applications,
        reminders=reminders,
        weekly_target=weekly_target,
        persisted_milestones=persisted,
    )

    await _persist_unlocks(user.sub, newly_unlocked)

    return SummaryResponse(
        xp=summary.xp,
        streak=summary.streak,
        longest_streak=summary.longest_streak,
        weekly_target=summary.weekly_target,
        weekly_completed=summary.weekly_completed,
        week_start=summary.week_start,
        total_applications=summary.total_applications,
        by_status=summary.by_status,
        unlocked_milestones=summary.unlocked_milestones,
        newly_unlocked=summary.newly_unlocked,
        catalog=[
            MilestoneInfo(
                code=m.code,
                label=m.label,
                description=m.description,
                icon=m.icon,
            )
            for m in MILESTONES
        ],
    )


@router.put("/settings", response_model=SummaryResponse)
async def update_settings(
    req: SettingsRequest,
    user: User = Depends(get_current_user),
) -> SummaryResponse:
    await users_collection().update_one(
        {"_id": ObjectId(user.sub)},
        {"$set": {"weekly_target": req.weekly_target}},
    )
    return await summary(user=user)
