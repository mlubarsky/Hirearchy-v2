from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from ..auth import User, get_current_user
from ..db import applications_collection
from ..timeline import (
    APPLIED,
    applied_at,
    days_between,
    entered_at,
    first_response_at,
    history_for,
)

# An application with no response after this many days counts as "no response".
GHOSTED_AFTER_DAYS = 21

router = APIRouter(
    prefix="/api/analytics",
    tags=["analytics"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/summary")
async def summary(user: User = Depends(get_current_user)) -> dict:
    coll = applications_collection()
    docs = [doc async for doc in coll.find({"owner_id": user.sub})]

    by_status: Counter[str] = Counter()
    for d in docs:
        by_status[d.get("status", "Applied")] += 1

    total = len(docs)
    responses = by_status["Interview"] + by_status["Offer"] + by_status["Rejected"]
    response_rate = round((responses / total) * 100) if total else 0

    now = datetime.now(timezone.utc)
    weeks: list[dict] = []
    for i in range(7, -1, -1):
        end = now - timedelta(days=i * 7)
        start = end - timedelta(days=7)
        count = sum(1 for d in docs if start <= d.get("created_at", now) < end)
        weeks.append({"weekEnding": end.date().isoformat(), "count": count})

    # Timing, from each application's status timeline. Transitions with an
    # unknown date (pre-timeline data) are left out rather than guessed.
    response_days: list[float] = []
    decision_days: list[float] = []
    ghosted = 0
    for d in docs:
        history = history_for(d)
        applied = applied_at(d)
        days = days_between(applied, first_response_at(history))
        if days is not None:
            response_days.append(days)
        if d.get("status") in ("Offer", "Rejected"):
            days = days_between(entered_at(history, "Interview"), entered_at(history, d["status"]))
            if days is not None:
                decision_days.append(days)
        if (
            d.get("status", APPLIED) == APPLIED
            and applied is not None
            and now - applied >= timedelta(days=GHOSTED_AFTER_DAYS)
        ):
            ghosted += 1

    def _avg(values: list[float]) -> float | None:
        return round(sum(values) / len(values), 1) if values else None

    return {
        "total": total,
        "byStatus": [{"status": s, "count": c} for s, c in by_status.items()],
        "responseRate": response_rate,
        "weekly": weeks,
        "timing": {
            "avgDaysToResponse": _avg(response_days),
            "responsesMeasured": len(response_days),
            "avgDaysInterviewToDecision": _avg(decision_days),
            "decisionsMeasured": len(decision_days),
            "noResponseCount": ghosted,
            "noResponseAfterDays": GHOSTED_AFTER_DAYS,
        },
    }


@router.get("/funnel")
async def funnel(user: User = Depends(get_current_user)) -> dict:
    coll = applications_collection()
    docs = [doc async for doc in coll.find({"owner_id": user.sub})]

    applied = len(docs)
    # Strict current-status counts so the funnel numbers match the stat boxes
    # exactly. (Earlier we used cumulative counts — Offer rolled up into Interview —
    # which is the more analytically "correct" funnel, but it reads as a bug when
    # the same word shows two different numbers on the same screen.)
    interview = sum(1 for d in docs if d.get("status") == "Interview")
    offer = sum(1 for d in docs if d.get("status") == "Offer")

    return {
        "stages": [
            {"label": "Total applications", "count": applied},
            {"label": "Interview", "count": interview},
            {"label": "Offer", "count": offer},
        ]
    }
