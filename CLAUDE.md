# Hirearchy v2 — Engineering Guide

**One-liner:** AI-augmented job & internship application tracker. Track applications, manage interview pipelines, get AI-tailored resume bullets and cover letters, surface analytics about your search.

This is a rewrite of the original Spring Boot Hirearchy (`~/Projects/Hirearchy/`) into a clean, scalable, deploy-anywhere stack.

---

## Stack

| Layer        | Tech                                                            | Why                                                  |
| ------------ | --------------------------------------------------------------- | ---------------------------------------------------- |
| Frontend     | Vite + React 18 + TypeScript + TailwindCSS                      | Fast HMR, type safety, utility-first styling         |
| State + data | TanStack Query                                                  | Cache + invalidation handled correctly out of the box |
| Charts       | Recharts                                                        | Declarative, composable                              |
| Drag-drop    | @dnd-kit                                                        | Modern, accessible, framework-agnostic               |
| Auth         | Self-hosted email + password → JWT bearer to API                | Vendor-free; users live in `users` Mongo collection  |
| Backend      | FastAPI (Python 3.11)                                           | Async-native, OpenAPI for free, fast cold-start      |
| Mongo driver | Motor                                                           | Async Mongo with PyMongo semantics                   |
| Password hashing | passlib + bcrypt                                            | Standard, vetted; cost factor configurable           |
| JWT          | python-jose, HS256, secret from `JWT_SECRET`                    | Signed locally; no external JWKS round-trips         |
| Resume match | Deterministic keyword overlap (`app/skills.py`)                 | No AI — explainable matched/missing skill lists      |
| Job parsing  | Schema.org JSON-LD + regex fallback (`app/parser.py`)           | No AI — deterministic structured extraction          |
| Database     | MongoDB Atlas (`mongodb+srv://`); `dnspython` for SRV lookups   | Cloud-hosted only — no local DB                      |
| Container    | docker-compose for `web` + `api` (both talk to Atlas)           | One-command boot against Atlas                       |

---

## Repo layout

```
/
├── api/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI entrypoint, middleware, router mounting
│   │   ├── config.py       # Settings (pydantic-settings, reads .env)
│   │   ├── db.py           # Motor client + collection accessors
│   │   ├── auth.py         # Auth0 JWT validation dependency
│   │   ├── ai.py           # Anthropic-powered features
│   │   ├── models.py       # Pydantic models (JobApplication, Reminder)
│   │   └── routers/
│   │       ├── applications.py
│   │       ├── reminders.py
│   │       ├── analytics.py
│   │       ├── ai.py
│   │       └── health.py
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── .env.example
├── web/                    # React frontend
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── lib/            # api client, auth helpers, formatters
│   │   ├── components/     # reusable UI primitives
│   │   ├── features/       # feature-scoped: applications, reminders, analytics, ai
│   │   └── pages/          # route-level
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml
└── README.md
```

---

## Domain model

Per-user scoping happens via the JWT `sub` claim, which is the user's Mongo `_id` (stringified). Every document stores `owner_id`; every query and mutation filters by it. Never trust a client-supplied `owner_id`.

**User** (`users` collection):
- `_id`, `email` (unique, lowercased), `password_hash` (bcrypt), `name`, `created_at`.
- The `password_hash` field is **never** returned to the client.

**JobApplication** (`applicationsCategories` collection — kept from legacy for data continuity):
- `id`, `owner_id`, `company_name`, `position`, `job_link`, `job_desc`
- `date_applied` (ISO date string `YYYY-MM-DD`)
- `status` ∈ {`Applied`, `Interview`, `Offer`, `Rejected`}
- `notes`, `created_at` (UTC)
- New in v2: `match_score` (0–100, nullable, AI-generated), `ai_summary` (nullable)

**Reminder** (`reminders` collection):
- `id`, `owner_id`, `text`, `completed`, `order_index`, `created_at`
- Optional `application_id` foreign-ref for reminders tied to a specific application

---

## API surface (under `/api`)

All routes (except `/health` and `/api/auth/*`) require `Authorization: Bearer <jwt>` where the JWT was issued by `/api/auth/login` or `/api/auth/signup`.

```
POST   /api/auth/signup               { email, password, name? } → { token, user }
POST   /api/auth/login                { email, password } → { token, user }
GET    /api/auth/me                   current user

GET    /api/applications              list current user's applications
POST   /api/applications              create
PUT    /api/applications/{id}         partial update
DELETE /api/applications/{id}

GET    /api/reminders
POST   /api/reminders
PUT    /api/reminders/{id}
DELETE /api/reminders/{id}
PUT    /api/reminders/reorder         batch reorder

GET    /api/analytics/summary         status counts, response rate, weekly app count
GET    /api/analytics/funnel          Applied → Interview → Offer drop-off

POST   /api/ai/match-score            { job_desc, resume } → { score, reasons }
POST   /api/ai/tailor                 { job_desc, resume, tone? } → { bullets, cover_letter }
POST   /api/ai/parse-email            { raw_email } → extracted application fields

GET    /health                        public
GET    /api/secure/ping               authed sanity check
```

---

## Conventions

- **Naming:** snake_case in Python and Mongo, camelCase in TypeScript. The Pydantic models use `Field(alias="camelCase")` + `populate_by_name = True` so the API speaks camelCase on the wire — TS clients stay clean.
- **Auth on every protected route:** every router includes `dependencies=[Depends(get_current_user)]`. Don't add per-handler manual checks.
- **Repository pattern:** thin functions in `api/app/db.py` returning Motor collections; routers call them directly. No ORM, no over-abstraction.
- **Validation:** Pydantic models do all input validation. Mongo writes accept only validated models.
- **No global state in React:** TanStack Query is the source of truth for server state. Local UI state (modals, drag positions) lives in component state.
- **Tailwind only:** no CSS modules, no styled-components. Reusable patterns live in `web/src/components/` as React components, not class strings.
- **Dark mode is default.** Light mode is a toggle, not the baseline.

---

## Running locally

```bash
# one-time
cp api/.env.example api/.env       # set MONGO_URI to your Atlas string, set JWT_SECRET
cp web/.env.example web/.env       # set VITE_API_BASE_URL

# everything at once (connects to Atlas via api/.env)
docker compose up --build

# or independently:
cd api && uvicorn app.main:app --reload --port 8080
cd web && npm install && npm run dev
```

API: `http://localhost:8080`  ·  Web: `http://localhost:5173`

**Database is MongoDB Atlas — cloud only, no local DB option.** `MONGO_URI` in `api/.env` holds the
`mongodb+srv://` connection string and is **required**: the API calls `Settings.validate()` at startup
and refuses to boot if `MONGO_URI` is missing/malformed or `JWT_SECRET` is under 32 bytes.

---

## Deployment notes (future)

- API → Fly.io or Render (single Docker container, env-driven config).
- Web → Vercel or Netlify (static Vite build).
- DB → MongoDB Atlas (existing tenant).
- The Auth0 tenant is shared with legacy — when ready, add the new web origin to "Allowed Callback URLs" in the Auth0 dashboard.

---

## What NOT to do

- Don't add ORM layers or repositories beyond the thin Motor wrapper.
- Don't add Redux, Zustand, or context for server state — TanStack Query covers it.
- Don't store the raw password anywhere — only the bcrypt hash via `auth.hash_password`.
- Don't return `password_hash` in any API response. The `UserResponse` schema deliberately omits it.
- Don't put the JWT secret in code or commit it. `JWT_SECRET` is required and should be 48+ random bytes in any environment that handles real users.
- Don't bypass JWT validation in dev with mock users. Use the real signup/login flow even locally.
- Don't reorder existing Mongo collections or rename fields without a migration plan — legacy users still have data in `applicationsCategories`.
