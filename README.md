# Hirearchy

Job and internship application tracker. Kanban board, calendar, accountability/streaks, analytics, and deterministic resume-to-job matching.

**Stack:** React + Vite + TypeScript · FastAPI · MongoDB Atlas · self-hosted email/password auth (JWT).

---

## Run it

```bash
# 1. Copy env templates
cp api/.env.example api/.env
cp web/.env.example web/.env

# 2. Set MONGO_URI in api/.env to your MongoDB Atlas connection string,
#    and set a strong JWT_SECRET (python -c "import secrets; print(secrets.token_urlsafe(48))")

# 3. Boot everything (connects to Atlas)
docker compose up --build
```

- API → http://localhost:8080 (OpenAPI docs at `/docs`)
- Web → http://localhost:5173

Run pieces individually:

```bash
# API
cd api && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8080

# Web
cd web && npm install && npm run dev
```

Data lives entirely in MongoDB Atlas — there's no local-DB mode. The API fails to start
if `MONGO_URI` (Atlas connection string) or a 32+ byte `JWT_SECRET` is missing from `api/.env`.

---

## What's here

- **Kanban board** — drag applications across Applied → Interview → Offer / Rejected, with click-to-expand detail views.
- **Calendar** — interview / follow-up / deadline events plus smart nudges, fully in-app.
- **Progress** — XP, streaks, weekly goals, and milestone unlocks with animated celebrations.
- **Analytics** — funnel, status breakdown, response rate, weekly activity.
- **Resume** — paste text or upload a PDF; deterministic skill matching scores each application and shows matched / missing skills (no AI).
- **Reminders** — checklist with drag-to-reorder, optionally tied to an application.
- **Auth** — self-hosted email/password with locally-signed JWTs. No external auth vendor.
- **Themes** — light (eggshell) and dark, toggleable, persisted.

---

## Engineering docs

- High-level architecture and conventions → [`CLAUDE.md`](./CLAUDE.md).
- Subsystem skill guides → [`.claude/skills/`](./.claude/skills/).
