"""Deterministic job-posting parser.

Strategy:
1. Fetch the URL with a realistic browser user-agent.
2. Look for Schema.org JSON-LD JobPosting data (works for most ATS platforms
   like Greenhouse, Lever, Workday, Indeed embed this).
3. If not found, fall back to OpenGraph metadata + regex extraction over the page text.
4. Return mappable fields plus a markdown 'notes' blob for the auxiliary info.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from html import unescape
from typing import Any, Optional

import httpx
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)
FETCH_TIMEOUT = 10.0


@dataclass
class ParsedJob:
    company_name: Optional[str] = None
    position: Optional[str] = None
    job_link: Optional[str] = None
    job_desc: Optional[str] = None
    notes: Optional[str] = None
    source: str = "fallback"  # 'json-ld' | 'opengraph' | 'fallback'
    warnings: list[str] = field(default_factory=list)


async def fetch_html(url: str) -> str:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    async with httpx.AsyncClient(
        timeout=FETCH_TIMEOUT,
        follow_redirects=True,
        headers=headers,
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text


def _strip_html(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    soup = BeautifulSoup(text, "lxml")
    # Replace <br> and <p> with newlines so paragraph breaks survive.
    for br in soup.find_all(["br", "p", "li"]):
        br.insert_before("\n")
    cleaned = soup.get_text(separator="").strip()
    cleaned = unescape(cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned or None


def _flatten_jsonld(node: Any) -> list[dict]:
    """JSON-LD can be a dict, a list, or a @graph wrapper. Flatten to a list of dicts."""
    out: list[dict] = []
    if isinstance(node, list):
        for item in node:
            out.extend(_flatten_jsonld(item))
    elif isinstance(node, dict):
        if "@graph" in node and isinstance(node["@graph"], list):
            out.extend(_flatten_jsonld(node["@graph"]))
        else:
            out.append(node)
    return out


def _find_job_posting(soup: BeautifulSoup) -> Optional[dict]:
    for script in soup.find_all("script", type="application/ld+json"):
        text = script.string or script.get_text()
        if not text:
            continue
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            continue
        for item in _flatten_jsonld(data):
            t = item.get("@type")
            if t == "JobPosting" or (isinstance(t, list) and "JobPosting" in t):
                return item
    return None


def _format_salary(salary: Any) -> Optional[str]:
    """Schema.org MonetaryAmount is nested; squash it to a readable string."""
    if not salary:
        return None
    if isinstance(salary, str):
        return salary
    if not isinstance(salary, dict):
        return None
    value = salary.get("value", salary)
    currency = salary.get("currency", "USD")
    if isinstance(value, dict):
        unit = value.get("unitText", "").lower()
        if "minValue" in value or "maxValue" in value:
            lo = value.get("minValue")
            hi = value.get("maxValue")
            parts = []
            if lo is not None:
                parts.append(f"{currency} {int(lo):,}")
            if hi is not None and hi != lo:
                parts.append(f"{currency} {int(hi):,}")
            base = " – ".join(parts) if parts else None
            return f"{base} ({unit})" if base and unit else base
        if "value" in value:
            v = value["value"]
            unit = value.get("unitText", "").lower()
            return f"{currency} {int(v):,}" + (f" ({unit})" if unit else "")
    return None


def _format_location(loc: Any) -> Optional[str]:
    if not loc:
        return None
    if isinstance(loc, list):
        return ", ".join(filter(None, [_format_location(l) for l in loc])) or None
    if isinstance(loc, str):
        return loc
    if not isinstance(loc, dict):
        return None
    addr = loc.get("address", loc)
    if isinstance(addr, dict):
        bits = [
            addr.get("addressLocality"),
            addr.get("addressRegion"),
            addr.get("addressCountry") if isinstance(addr.get("addressCountry"), str) else None,
        ]
        return ", ".join(b for b in bits if b) or None
    return None


def _format_skills(skills: Any) -> Optional[str]:
    if not skills:
        return None
    if isinstance(skills, str):
        return skills
    if isinstance(skills, list):
        return ", ".join(s for s in skills if isinstance(s, str))
    return None


def _build_notes_markdown(fields: dict[str, Optional[str]]) -> Optional[str]:
    lines: list[str] = []
    for label, value in fields.items():
        if value:
            lines.append(f"**{label}:** {value}")
    return "\n".join(lines) if lines else None


def parse_json_ld_posting(job: dict, url: str) -> ParsedJob:
    hiring_org = job.get("hiringOrganization")
    company = None
    if isinstance(hiring_org, dict):
        company = hiring_org.get("name")
    elif isinstance(hiring_org, str):
        company = hiring_org

    description = _strip_html(job.get("description"))

    salary = _format_salary(job.get("baseSalary") or job.get("estimatedSalary"))
    location = _format_location(job.get("jobLocation") or job.get("applicantLocationRequirements"))
    employment_type = job.get("employmentType")
    if isinstance(employment_type, list):
        employment_type = ", ".join(str(e) for e in employment_type)
    deadline = job.get("validThrough")
    posted = job.get("datePosted")
    skills = _format_skills(job.get("skills"))
    industry = job.get("industry")
    department = job.get("occupationalCategory") or job.get("department")

    notes = _build_notes_markdown(
        {
            "Salary": salary,
            "Location": location,
            "Employment type": employment_type if isinstance(employment_type, str) else None,
            "Apply by": deadline,
            "Posted": posted,
            "Skills": skills,
            "Industry": industry,
            "Department": department if isinstance(department, str) else None,
        }
    )

    return ParsedJob(
        company_name=company,
        position=job.get("title"),
        job_link=url,
        job_desc=description,
        notes=notes,
        source="json-ld",
    )


# --- Regex / OG fallback -----------------------------------------------------

SALARY_RE = re.compile(
    r"(?:\$|USD\s?)\s?\d{2,3}(?:[,.]?\d{3})+(?:\s?[-–to]+\s?(?:\$|USD\s?)?\d{2,3}(?:[,.]?\d{3})+)?",
    re.IGNORECASE,
)
DEADLINE_RE = re.compile(
    r"(?:apply by|deadline|closes on|applications close)\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2}(?:,\s*\d{4})?)",
    re.IGNORECASE,
)
LOCATION_RE = re.compile(
    r"(?:location|based in|office)\s*[:\-]\s*([A-Z][A-Za-z\s,]+?)(?:\n|\.|$)",
)


def _og(soup: BeautifulSoup, prop: str) -> Optional[str]:
    tag = soup.find("meta", property=f"og:{prop}")
    if tag and tag.get("content"):
        return str(tag["content"]).strip()
    return None


def parse_fallback(html: str, url: str) -> ParsedJob:
    soup = BeautifulSoup(html, "lxml")
    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else None

    og_title = _og(soup, "title")
    og_site = _og(soup, "site_name")
    og_desc = _og(soup, "description")

    position = og_title or title
    company = og_site

    body = soup.find("body")
    text = body.get_text(separator="\n", strip=True) if body else ""

    salary_match = SALARY_RE.search(text)
    deadline_match = DEADLINE_RE.search(text)
    location_match = LOCATION_RE.search(text)

    notes = _build_notes_markdown(
        {
            "Salary": salary_match.group(0) if salary_match else None,
            "Apply by": deadline_match.group(1) if deadline_match else None,
            "Location": location_match.group(1).strip() if location_match else None,
        }
    )

    return ParsedJob(
        company_name=company,
        position=position,
        job_link=url,
        job_desc=og_desc,
        notes=notes,
        source="opengraph" if (og_title or og_site or og_desc) else "fallback",
        warnings=[
            "No structured job data found on this page. "
            "Fields were guessed from page title / metadata and may be inaccurate.",
        ],
    )


def parse_html(html: str, url: str) -> ParsedJob:
    soup = BeautifulSoup(html, "lxml")
    posting = _find_job_posting(soup)
    if posting is not None:
        return parse_json_ld_posting(posting, url)
    return parse_fallback(html, url)


def parse_text(text: str) -> ParsedJob:
    """Parse a raw pasted job description — no HTML, no URL."""
    salary_match = SALARY_RE.search(text)
    deadline_match = DEADLINE_RE.search(text)
    location_match = LOCATION_RE.search(text)

    notes = _build_notes_markdown(
        {
            "Salary": salary_match.group(0) if salary_match else None,
            "Apply by": deadline_match.group(1) if deadline_match else None,
            "Location": location_match.group(1).strip() if location_match else None,
        }
    )

    # First line that looks substantive becomes the position guess.
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    position = lines[0] if lines else None

    return ParsedJob(
        company_name=None,
        position=position,
        job_link=None,
        job_desc=text.strip(),
        notes=notes,
        source="text",
        warnings=[
            "Parsed from pasted text. Company name not detected — please fill it in.",
        ],
    )
