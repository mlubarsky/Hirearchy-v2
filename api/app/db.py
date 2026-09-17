from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import get_settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_db() -> AsyncIOMotorDatabase:
    global _client, _db
    if _db is None:
        settings = get_settings()
        _client = AsyncIOMotorClient(settings.mongo_uri, tz_aware=True)
        _db = _client[settings.mongo_db]
    return _db


def users_collection():
    return get_db()["users"]


def applications_collection():
    # Collection name preserved from the legacy Spring Boot app so existing data carries over.
    return get_db()["applicationsCategories"]


def reminders_collection():
    return get_db()["reminders"]


def achievements_collection():
    return get_db()["achievements"]


async def ensure_indexes() -> None:
    users = users_collection()
    await users.create_index("email", unique=True)

    apps = applications_collection()
    await apps.create_index([("owner_id", 1), ("created_at", -1)])
    await apps.create_index([("owner_id", 1), ("status", 1)])

    rems = reminders_collection()
    await rems.create_index([("owner_id", 1), ("order_index", 1)])
    await rems.create_index([("owner_id", 1), ("due_at", 1)])
    # A smart nudge can become a reminder only once. Partial so ordinary
    # reminders (no nudge_id) aren't constrained.
    await rems.create_index(
        [("owner_id", 1), ("nudge_id", 1)],
        unique=True,
        partialFilterExpression={"nudge_id": {"$type": "string"}},
    )

    ach = achievements_collection()
    await ach.create_index([("owner_id", 1), ("code", 1)], unique=True)


async def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None
