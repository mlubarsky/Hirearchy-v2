from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import close_db, ensure_indexes
from .routers import accountability, analytics, applications, auth, calendar, health, parse, reminders, resume


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail closed on missing/invalid required config — before serving any request.
    get_settings().validate()
    try:
        await ensure_indexes()
    except Exception as exc:
        # Don't crash on startup just because Mongo isn't reachable yet — log and continue.
        print(f"[startup] index creation skipped: {exc}")
    yield
    await close_db()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Hirearchy API", version="2.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(applications.router)
    app.include_router(parse.router)
    app.include_router(reminders.router)
    app.include_router(analytics.router)
    app.include_router(calendar.router)
    app.include_router(accountability.router)
    app.include_router(resume.router)
    return app


app = create_app()
