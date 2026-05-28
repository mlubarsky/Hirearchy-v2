"""Resume CRUD + match scoring.

Storage: resume text lives directly on the user document in MongoDB
(`users.resume`). No file blobs are kept anywhere — uploads are parsed to text
and the binary is discarded. Cap at 50KB of text, which is generous for any
resume.

Match scoring uses the deterministic skill matcher in `app/skills.py`. No AI.
"""
import re
from datetime import datetime, timezone
from io import BytesIO

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from ..auth import User, get_current_user
from ..db import applications_collection, users_collection
from ..skills import extract_skills, match

router = APIRouter(prefix="/api/resume", tags=["resume"], dependencies=[Depends(get_current_user)])

MAX_RESUME_CHARS = 50_000
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB cap on the file before parsing


# Bullet-like characters that PDFs frequently use; normalize to a single style.
_BULLET_CHARS = "•●○◦▪▫■□◆◇▶▸►★☆–—"


def _clean_pdf_text(raw: str) -> str:
    """Tidy up the raw text pypdf returns. PDF text extraction is notoriously
    messy — words split across lines, mid-sentence newlines, weird whitespace.
    This pass applies a few conservative heuristics that improve most resumes
    without harming any."""
    text = raw

    # Normalize line endings and tabs.
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")

    # Drop non-breaking spaces and other invisibles that PDFs sometimes leak in.
    text = text.replace(" ", " ").replace("​", "")

    # Fix hyphenated words split across lines: "perfor-\nmance" -> "performance"
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)

    # Normalize bullet glyphs to a consistent "- " prefix.
    text = re.sub(rf"^\s*[{re.escape(_BULLET_CHARS)}]\s*", "- ", text, flags=re.MULTILINE)

    # Trim per-line whitespace.
    lines = [line.strip() for line in text.split("\n")]

    # Re-join lines that look like accidental mid-sentence breaks:
    # current line ends without sentence punctuation AND next line begins with
    # a lowercase letter (so it's continuation prose, not a new heading/bullet).
    joined: list[str] = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        while (
            i + 1 < n
            and line
            and lines[i + 1]
            and not line.endswith((".", "!", "?", ":", ";", "—"))
            and not line.endswith("-")  # already a continuation we don't want to glue
            and lines[i + 1][0].islower()
        ):
            line = f"{line} {lines[i + 1]}"
            i += 1
        joined.append(line)
        i += 1

    cleaned = "\n".join(joined)

    # Collapse internal multi-spaces (from extraction artifacts), preserve newlines.
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)

    # Compress runs of 3+ blank lines to a single paragraph break.
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    return cleaned.strip()


def _alias(snake: str) -> str:
    parts = snake.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


class ResumeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_alias)

    content: str
    file_name: str | None = None
    uploaded_at: datetime
    skills: list[str]


class ResumeSaveRequest(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_RESUME_CHARS)
    file_name: str | None = Field(default=None, alias="fileName", max_length=200)
    model_config = ConfigDict(populate_by_name=True)


class UploadResponse(BaseModel):
    content: str
    file_name: str | None = Field(alias="fileName")
    model_config = ConfigDict(populate_by_name=True)


class MatchEntry(BaseModel):
    score: int | None
    matched: list[str]
    missing: list[str]


class MatchesResponse(BaseModel):
    has_resume: bool = Field(alias="hasResume")
    resume_skills: list[str] = Field(alias="resumeSkills")
    matches: dict[str, MatchEntry]
    model_config = ConfigDict(populate_by_name=True)


async def _get_user_doc(user_id: str) -> dict | None:
    return await users_collection().find_one({"_id": ObjectId(user_id)})


def _resume_from_user_doc(doc: dict | None) -> dict | None:
    if not doc:
        return None
    return doc.get("resume")


@router.get("", response_model=ResumeOut | None)
async def get_resume(user: User = Depends(get_current_user)) -> ResumeOut | None:
    doc = await _get_user_doc(user.sub)
    resume = _resume_from_user_doc(doc)
    if not resume:
        return None
    return ResumeOut(
        content=resume["content"],
        file_name=resume.get("file_name"),
        uploaded_at=resume["uploaded_at"],
        skills=sorted(extract_skills(resume["content"])),
    )


@router.post("", response_model=ResumeOut, status_code=status.HTTP_201_CREATED)
async def save_resume(
    req: ResumeSaveRequest,
    user: User = Depends(get_current_user),
) -> ResumeOut:
    content = req.content.strip()
    if not content:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Resume content is empty.")
    now = datetime.now(timezone.utc)
    payload = {
        "content": content,
        "file_name": req.file_name,
        "uploaded_at": now,
    }
    await users_collection().update_one(
        {"_id": ObjectId(user.sub)},
        {"$set": {"resume": payload}},
    )
    return ResumeOut(
        content=content,
        file_name=req.file_name,
        uploaded_at=now,
        skills=sorted(extract_skills(content)),
    )


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(user: User = Depends(get_current_user)) -> None:
    await users_collection().update_one(
        {"_id": ObjectId(user.sub)},
        {"$unset": {"resume": ""}},
    )


@router.post("/upload", response_model=UploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
) -> UploadResponse:
    """Parse a PDF and return its plain text.

    The caller is expected to review the parsed text, then POST it to /api/resume
    to save. We don't auto-save here so the user has a chance to clean up
    parsing artifacts. The binary is never stored.
    """
    if not file.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No file provided.")
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File too large. Limit is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    name = file.filename.lower()
    if not name.endswith(".pdf"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Only PDF uploads are supported. Paste your resume as text for other formats.",
        )

    try:
        reader = PdfReader(BytesIO(raw))
        pages: list[str] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            if text.strip():
                pages.append(text)
        content = "\n\n".join(pages).strip()
    except PdfReadError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Could not read this PDF: {exc}. Try pasting the text instead.",
        ) from exc

    if not content:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "No text could be extracted. The PDF may be a scanned image. "
            "Try pasting the text directly.",
        )

    content = _clean_pdf_text(content)

    if len(content) > MAX_RESUME_CHARS:
        content = content[:MAX_RESUME_CHARS]

    return UploadResponse(content=content, file_name=file.filename)


@router.get("/matches", response_model=MatchesResponse)
async def get_matches(user: User = Depends(get_current_user)) -> MatchesResponse:
    """Compute match scores between the user's resume and each application's JD."""
    doc = await _get_user_doc(user.sub)
    resume = _resume_from_user_doc(doc)

    if not resume:
        return MatchesResponse(has_resume=False, resume_skills=[], matches={})

    resume_text = resume["content"]
    resume_skills = sorted(extract_skills(resume_text))

    matches: dict[str, MatchEntry] = {}
    async for app in applications_collection().find({"owner_id": user.sub}):
        jd = (app.get("job_desc") or "") + "\n" + (app.get("notes") or "")
        if not jd.strip():
            continue
        result = match(resume_text, jd)
        matches[str(app["_id"])] = MatchEntry(
            score=result.score,
            matched=result.matched,
            missing=result.missing,
        )

    return MatchesResponse(
        has_resume=True,
        resume_skills=resume_skills,
        matches=matches,
    )
