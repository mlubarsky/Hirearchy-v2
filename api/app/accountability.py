"""Solo accountability: XP, streaks, weekly target, milestone unlocks.

All numbers are computed live from the user's existing applications and reminders.
Only milestone unlocks are persisted (so they don't re-fire on every page load).
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

# Single source of truth for XP awarded by activity type.
XP_PER_APPLICATION = 10
XP_INTERVIEW_BONUS = 25
XP_OFFER_BONUS = 100
XP_PER_COMPLETED_REMINDER = 5

# Milestone definitions. Each is (code, label, threshold-checker).
@dataclass(frozen=True)
class MilestoneDef:
    code: str
    label: str
    description: str
    icon: str  # lucide-react icon name the frontend will resolve
    sort: int


MILESTONES: list[MilestoneDef] = [
    MilestoneDef("first_application", "First application", "You submitted your first application.", "rocket", 10),
    MilestoneDef("five_applications", "5 applications", "Momentum is building.", "flame", 20),
    MilestoneDef("twenty_five_applications", "25 applications", "Job-hunt habit unlocked.", "target", 30),
    MilestoneDef("hundred_applications", "100 applications", "Marathon runner.", "trophy", 40),
    MilestoneDef("first_interview", "First interview", "Your first foot in the door.", "users", 50),
    MilestoneDef("first_offer", "First offer", "The hard part is done — now negotiate.", "award", 60),
    MilestoneDef("seven_day_streak", "7-day streak", "A full week of consistent effort.", "calendar-check", 70),
    MilestoneDef("thirty_day_streak", "30-day streak", "A whole month of momentum.", "calendar-heart", 80),
    MilestoneDef("goal_crusher", "Goal crusher", "Hit your weekly target.", "zap", 90),
]


@dataclass
class AccountabilitySummary:
    xp: int
    streak: int
    longest_streak: int
    weekly_target: int
    weekly_completed: int
    week_start: datetime
    total_applications: int
    by_status: dict[str, int]
    unlocked_milestones: list[str]  # codes the user has already unlocked
    newly_unlocked: list[str]  # codes unlocked during this request


def _week_start_utc(now: datetime) -> datetime:
    # Monday 00:00 UTC of the week containing `now`.
    monday = now - timedelta(days=now.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def _date_of(dt: datetime) -> tuple[int, int, int]:
    return (dt.year, dt.month, dt.day)


def compute_streak(activity_dates: set[tuple[int, int, int]], now: datetime) -> tuple[int, int]:
    """Returns (current_streak, longest_streak).

    Current streak = consecutive days ending today (or yesterday — we don't break the
    streak just because the user hasn't logged anything yet today).
    """
    if not activity_dates:
        return (0, 0)

    today = _date_of(now)
    yesterday = _date_of(now - timedelta(days=1))

    # Start the current-streak walk from today, or from yesterday if there's no activity today.
    cursor = now if today in activity_dates else (now - timedelta(days=1) if yesterday in activity_dates else None)
    current = 0
    while cursor is not None and _date_of(cursor) in activity_dates:
        current += 1
        cursor = cursor - timedelta(days=1)

    # Longest streak: scan all dates.
    sorted_dates = sorted(activity_dates)
    longest = 1
    run = 1
    for i in range(1, len(sorted_dates)):
        prev = datetime(*sorted_dates[i - 1], tzinfo=timezone.utc)
        cur = datetime(*sorted_dates[i], tzinfo=timezone.utc)
        if (cur - prev).days == 1:
            run += 1
            longest = max(longest, run)
        else:
            run = 1
    longest = max(longest, current)
    return (current, longest)


def compute_xp(applications: list[dict], reminders: list[dict]) -> int:
    xp = len(applications) * XP_PER_APPLICATION
    for app in applications:
        status = app.get("status")
        if status in ("Interview", "Offer"):
            xp += XP_INTERVIEW_BONUS
        if status == "Offer":
            xp += XP_OFFER_BONUS
    for r in reminders:
        if r.get("completed"):
            xp += XP_PER_COMPLETED_REMINDER
    return xp


def evaluate_milestones(
    applications: list[dict],
    streak: int,
    longest_streak: int,
    weekly_completed: int,
    weekly_target: int,
) -> set[str]:
    """Returns the set of milestone codes the user currently qualifies for."""
    total = len(applications)
    statuses = Counter(a.get("status") for a in applications)

    earned: set[str] = set()
    if total >= 1:
        earned.add("first_application")
    if total >= 5:
        earned.add("five_applications")
    if total >= 25:
        earned.add("twenty_five_applications")
    if total >= 100:
        earned.add("hundred_applications")
    if (statuses["Interview"] + statuses["Offer"]) >= 1:
        earned.add("first_interview")
    if statuses["Offer"] >= 1:
        earned.add("first_offer")
    if max(streak, longest_streak) >= 7:
        earned.add("seven_day_streak")
    if max(streak, longest_streak) >= 30:
        earned.add("thirty_day_streak")
    if weekly_completed >= weekly_target and weekly_target > 0:
        earned.add("goal_crusher")
    return earned


def compute_summary(
    *,
    applications: list[dict],
    reminders: list[dict],
    weekly_target: int,
    persisted_milestones: set[str],
    now: Optional[datetime] = None,
) -> tuple[AccountabilitySummary, set[str]]:
    """Returns (summary, newly_unlocked_codes).

    Caller is responsible for persisting the newly_unlocked set.
    """
    now = now or datetime.now(timezone.utc)
    week_start = _week_start_utc(now)

    activity: set[tuple[int, int, int]] = set()
    for app in applications:
        if app.get("created_at"):
            activity.add(_date_of(app["created_at"]))
    for r in reminders:
        if r.get("created_at"):
            activity.add(_date_of(r["created_at"]))

    streak, longest = compute_streak(activity, now)
    xp = compute_xp(applications, reminders)
    weekly_completed = sum(
        1 for app in applications if app.get("created_at") and app["created_at"] >= week_start
    )

    earned_now = evaluate_milestones(
        applications=applications,
        streak=streak,
        longest_streak=longest,
        weekly_completed=weekly_completed,
        weekly_target=weekly_target,
    )
    newly_unlocked = earned_now - persisted_milestones
    all_unlocked = persisted_milestones | newly_unlocked

    summary = AccountabilitySummary(
        xp=xp,
        streak=streak,
        longest_streak=longest,
        weekly_target=weekly_target,
        weekly_completed=weekly_completed,
        week_start=week_start,
        total_applications=len(applications),
        by_status=dict(Counter(a.get("status", "Applied") for a in applications)),
        unlocked_milestones=sorted(all_unlocked),
        newly_unlocked=sorted(newly_unlocked),
    )
    return summary, newly_unlocked
