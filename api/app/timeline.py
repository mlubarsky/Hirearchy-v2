"""Application status timeline.

Each application stores `status_history`: a list of `{"status", "at"}` entries,
oldest first. An entry is appended whenever the status actually changes, so the
list answers "when did this move to Interview?" — the current `status` field
alone can't.

Applications created before the timeline existed have no stored history. For
those, `history_for()` synthesizes one from what we do know (the applied date and
the current status); an unknown transition time is `None` rather than a guess.
The synthesized list is persisted the first time the application is changed.
"""
from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Optional

APPLIED = "Applied"


def parse_date_applied(value: Optional[str]) -> Optional[datetime]:
    """`date_applied` is a calendar day with no timezone. Anchor it at 12:00 UTC so
    it lands on the same local day for every offset from UTC-11 to UTC+11."""
    if not value:
        return None
    try:
        return datetime.combine(date.fromisoformat(value), time(12, 0), tzinfo=timezone.utc)
    except ValueError:
        return None


def applied_at(doc: dict) -> Optional[datetime]:
    return parse_date_applied(doc.get("date_applied")) or doc.get("created_at")


def initial_history(status: str, applied: Optional[datetime], now: datetime) -> list[dict]:
    """History for a brand-new application. Every application starts as Applied.
    If it's logged further along (e.g. after the interview was already booked), we
    don't know when that move happened — record it as unknown so it doesn't count
    as a same-day response; the user can set the real date from the timeline."""
    history = [{"status": APPLIED, "at": applied or now}]
    if status != APPLIED:
        history.append({"status": status, "at": None})
    return history


def history_for(doc: dict) -> list[dict]:
    stored = doc.get("status_history")
    if stored:
        return list(stored)
    status = doc.get("status", APPLIED)
    history = [{"status": APPLIED, "at": applied_at(doc)}]
    if status != APPLIED:
        history.append({"status": status, "at": None})
    return history


def with_status_change(doc: dict, new_status: str, now: datetime) -> Optional[list[dict]]:
    """The history after moving `doc` to `new_status`, or None if it's unchanged."""
    if new_status == doc.get("status", APPLIED):
        return None
    return history_for(doc) + [{"status": new_status, "at": now}]


def with_applied_date(doc: dict, new_date_applied: Optional[str]) -> list[dict]:
    """Keep the opening Applied entry in sync when the user edits date_applied."""
    history = history_for(doc)
    new_at = parse_date_applied(new_date_applied)
    if new_at and history and history[0]["status"] == APPLIED:
        history[0] = {**history[0], "at": new_at}
    return history


def first_response_at(history: list[dict]) -> Optional[datetime]:
    """When the company first responded: the first move out of Applied."""
    for entry in history[1:]:
        if entry["status"] != APPLIED:
            return entry.get("at")
    return None


def entered_at(history: list[dict], status: str) -> Optional[datetime]:
    """When the application most recently entered `status`."""
    for entry in reversed(history):
        if entry["status"] == status:
            return entry.get("at")
    return None


def days_between(start: Optional[datetime], end: Optional[datetime]) -> Optional[float]:
    if start is None or end is None or end < start:
        return None
    return (end - start).total_seconds() / 86_400
