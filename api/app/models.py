from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ApplicationStatus = Literal["Applied", "Interview", "Offer", "Rejected"]
ReminderKind = Literal["interview", "follow_up", "deadline", "nudge", "task"]

_camel_config = ConfigDict(populate_by_name=True)


def _alias(snake: str) -> str:
    parts = snake.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


class JobApplicationIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_alias)

    company_name: str
    position: str
    job_link: Optional[str] = None
    job_desc: Optional[str] = None
    date_applied: Optional[str] = None
    status: ApplicationStatus = "Applied"
    notes: Optional[str] = None


class JobApplicationPatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_alias)

    company_name: Optional[str] = None
    position: Optional[str] = None
    job_link: Optional[str] = None
    job_desc: Optional[str] = None
    date_applied: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None
    match_score: Optional[int] = None
    ai_summary: Optional[str] = None


class StatusChange(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_alias)

    status: ApplicationStatus
    at: Optional[datetime] = None  # None = happened before the timeline existed, date unknown


class StatusChangeDatePatch(BaseModel):
    at: datetime


class JobApplicationOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_alias)

    id: str
    owner_id: str
    company_name: str
    position: str
    job_link: Optional[str] = None
    job_desc: Optional[str] = None
    date_applied: Optional[str] = None
    status: ApplicationStatus
    notes: Optional[str] = None
    match_score: Optional[int] = None
    ai_summary: Optional[str] = None
    status_history: list[StatusChange] = []
    created_at: datetime


class ReminderIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_alias)

    text: str
    kind: ReminderKind = "task"
    due_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    notes: Optional[str] = None
    application_id: Optional[str] = None
    # Set when the reminder was created from a smart nudge; each nudge can be
    # added once (enforced by a unique index).
    nudge_id: Optional[str] = None


class ReminderPatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_alias)

    text: Optional[str] = None
    kind: Optional[ReminderKind] = None
    due_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None
    order_index: Optional[int] = None
    application_id: Optional[str] = None


class ReminderOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_alias)

    id: str
    owner_id: str
    text: str
    kind: ReminderKind = "task"
    due_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    notes: Optional[str] = None
    completed: bool
    order_index: int
    application_id: Optional[str] = None
    nudge_id: Optional[str] = None
    created_at: datetime


class ReorderItem(BaseModel):
    id: str
    order_index: int = Field(alias="orderIndex")

    model_config = ConfigDict(populate_by_name=True)
