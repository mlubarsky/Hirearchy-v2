"""POST /api/applications/parse — extract structured fields from a job URL or pasted text."""
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from ..auth import User, get_current_user
from ..parser import ParsedJob, fetch_html, parse_html, parse_text


def _alias(snake: str) -> str:
    parts = snake.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


router = APIRouter(
    prefix="/api/applications",
    tags=["applications"],
    dependencies=[Depends(get_current_user)],
)


class ParseRequest(BaseModel):
    url: str | None = None
    text: str | None = None


class ParseResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_alias)

    company_name: str | None = None
    position: str | None = None
    job_link: str | None = None
    job_desc: str | None = None
    notes: str | None = None
    source: str
    warnings: list[str] = Field(default_factory=list)


def _to_response(parsed: ParsedJob) -> ParseResponse:
    return ParseResponse(
        company_name=parsed.company_name,
        position=parsed.position,
        job_link=parsed.job_link,
        job_desc=parsed.job_desc,
        notes=parsed.notes,
        source=parsed.source,
        warnings=parsed.warnings,
    )


@router.post("/parse", response_model=ParseResponse)
async def parse_application(
    req: ParseRequest,
    _: User = Depends(get_current_user),
) -> ParseResponse:
    if req.text and req.text.strip():
        return _to_response(parse_text(req.text))

    if not req.url or not req.url.strip():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Provide either a 'url' or 'text' to parse.",
        )

    try:
        html = await fetch_html(req.url.strip())
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Site returned HTTP {status_code}. The page may block scrapers — "
            "try pasting the job description text instead.",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Could not reach the URL: {exc}. Check the link or paste the text directly.",
        ) from exc

    return _to_response(parse_html(html, req.url.strip()))
