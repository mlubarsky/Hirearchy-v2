from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


# HS256 (HMAC-SHA256) requires a key of at least the hash output size — 256 bits
# / 32 bytes — per RFC 7518 §3.2. We enforce that as the minimum secret length.
_MIN_SECRET_BYTES = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # No defaults for required external config — the app fails closed at startup
    # (see validate()) rather than silently falling back to localhost or a weak key.
    mongo_uri: str = ""
    mongo_db: str = "hirearchydb"

    jwt_secret: str = ""
    jwt_alg: str = "HS256"
    jwt_expires_hours: int = 168  # 7 days

    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def validate(self) -> None:
        """Fail closed on missing/invalid required config. Called at startup so a
        misconfigured deploy crashes loudly instead of running insecurely or
        silently connecting to the wrong database."""
        uri = self.mongo_uri.strip()
        if not uri:
            raise RuntimeError(
                "MONGO_URI is not set. Add your MongoDB Atlas connection string to api/.env "
                "(mongodb+srv://...)."
            )
        if not uri.startswith(("mongodb://", "mongodb+srv://")):
            raise RuntimeError(
                "MONGO_URI is invalid — it must start with 'mongodb://' or 'mongodb+srv://'."
            )

        if len(self.jwt_secret.encode("utf-8")) < _MIN_SECRET_BYTES:
            raise RuntimeError(
                f"JWT_SECRET must be at least {_MIN_SECRET_BYTES} bytes (256 bits) for HS256. "
                'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
