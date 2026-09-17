"""Calendar feed (unified events) and computed nudges.

Events on the calendar come from two sources:
- Reminders that have a `due_at` (interview / follow_up / deadline / nudge / task)
- Applications, surfaced as a synthetic 'application' event on `date_applied`

Nudges are not persisted — they're recomputed on every request based on the
current state of the user's applications and their existing reminders.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict

from ..auth import User, get_current_user
from ..db import applications_collection, reminders_collection
from ..models import _alias
from ..timeline import applied_at, entered_at, history_for, parse_date_applied

router = APIRouter(
    prefix="/api/calendar",
    tags=["calendar"],
    dependencies=[Depends(get_current_user)],
)


class CalendarEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_alias)

    id: str
    source: str  # 'reminder' | 'application'
    kind: str  # reminder kind, or 'application' for app milestones
    title: str
    start: datetime
    end: Optional[datetime] = None
    notes: Optional[str] = None
    application_id: Optional[str] = None
    completed: bool = False


class Nudge(BaseModel):
    # camelCase on the wire like every other model — the frontend reads
    # `applicationId` / `suggestedDueAt`.
    model_config = ConfigDict(populate_by_name=True, alias_generator=_alias)

    id: str  # deterministic so the UI can dedupe across refreshes
    kind: str  # the kind a materialized reminder would have
    title: str
    reason: str
    suggested_due_at: datetime
    application_id: str


@router.get("/events", response_model=list[CalendarEvent])
async def list_events(
    user: User = Depends(get_current_user),
    range_from: Optional[datetime] = Query(default=None, alias="from"),
    range_to: Optional[datetime] = Query(default=None, alias="to"),
):
    events: list[CalendarEvent] = []

    rem_query: dict = {"owner_id": user.sub, "due_at": {"$ne": None}}
    if range_from or range_to:
        date_range: dict = {}
        if range_from:
            date_range["$gte"] = range_from
        if range_to:
            date_range["$lte"] = range_to
        rem_query["due_at"] = {**rem_query["due_at"], **date_range}

    async for r in reminders_collection().find(rem_query):
        if not r.get("due_at"):
            continue
        events.append(
            CalendarEvent(
                id=str(r["_id"]),
                source="reminder",
                kind=r.get("kind", "task"),
                title=r["text"],
                start=r["due_at"],
                end=r.get("end_at"),
                notes=r.get("notes"),
                application_id=r.get("application_id"),
                completed=r.get("completed", False),
            )
        )

    async for a in applications_collection().find({"owner_id": user.sub}):
        start = parse_date_applied(a.get("date_applied"))
        if start is None:
            continue
        if range_from and start < range_from:
            continue
        if range_to and start > range_to:
            continue
        events.append(
            CalendarEvent(
                id=f"app-{a['_id']}",
                source="application",
                kind="application",
                title=f"Applied to {a.get('company_name', '?')}",
                start=start,
                notes=a.get("position"),
                application_id=str(a["_id"]),
                completed=a.get("status") in ("Offer", "Rejected"),
            )
        )

    events.sort(key=lambda e: e.start)
    return events


@router.get("/nudges", response_model=list[Nudge])
async def list_nudges(user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)

    apps = [a async for a in applications_collection().find({"owner_id": user.sub})]
    rems = [r async for r in reminders_collection().find({"owner_id": user.sub})]

    # Index existing reminders by application + kind so we don't suggest dupes
    existing: set[tuple[str, str]] = set()
    for r in rems:
        if r.get("application_id") and not r.get("completed", False):
            existing.add((r["application_id"], r.get("kind", "task")))
    # Nudges already turned into a reminder stay hidden for good — even once that
    # reminder is completed — so the same suggestion doesn't keep coming back.
    added = {r["nudge_id"] for r in rems if r.get("nudge_id")}

    nudges: list[Nudge] = []

    for app in apps:
        status_ = app.get("status")
        app_id = str(app["_id"])
        company = app.get("company_name", "this role")
        applied = applied_at(app)
        if applied is None:
            continue
        days_since = (now - applied).days

        if status_ == "Applied" and days_since >= 7 and (app_id, "follow_up") not in existing:
            nudges.append(
                Nudge(
                    id=f"nudge-follow-up-{app_id}",
                    kind="follow_up",
                    title=f"Follow up with {company}",
                    reason=f"You applied {days_since} days ago and haven't heard back.",
                    suggested_due_at=now + timedelta(days=1),
                    application_id=app_id,
                )
            )

        # Measure from when it actually moved to Interview, not from the applied date.
        in_interview_since = entered_at(history_for(app), "Interview") or applied
        days_in_interview = (now - in_interview_since).days
        if status_ == "Interview" and days_in_interview >= 5 and (app_id, "follow_up") not in existing:
            nudges.append(
                Nudge(
                    id=f"nudge-thank-you-{app_id}",
                    kind="follow_up",
                    title=f"Send thank-you to {company}",
                    reason=f"Your last touchpoint was {days_in_interview} days ago.",
                    suggested_due_at=now + timedelta(hours=4),
                    application_id=app_id,
                )
            )

        if status_ == "Offer" and (app_id, "deadline") not in existing:
            nudges.append(
                Nudge(
                    id=f"nudge-decide-{app_id}",
                    kind="deadline",
                    title=f"Decide on {company} offer",
                    reason="Open offer — set a decision deadline so it doesn't slip.",
                    suggested_due_at=now + timedelta(days=7),
                    application_id=app_id,
                )
            )

    return [n for n in nudges if n.id not in added]
