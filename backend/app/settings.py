from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MERCURYDESK_",
        env_file=(str(_BACKEND_DIR / ".env"), ".env", "backend/.env"),
        extra="ignore",
    )

    database_url: str = "sqlite+pysqlite:///./mercurydesk.db"
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    media_dir: str = "./media"
    rsshub_base_url: str = "https://rsshub.app"
    models_catalog_url: str = "https://models.dev/api.json"
    models_catalog_refresh_seconds: int = 60 * 60
    frontend_url: str = "http://127.0.0.1:5173"
    api_public_base_url: str = "http://127.0.0.1:8000"
    oauth_redirect_base_url: str = "http://127.0.0.1:8000"
    forward_inbound_domain: str = "inbox.localhost"
    gmail_client_id: str | None = None
    gmail_client_secret: str | None = None
    outlook_client_id: str | None = None
    outlook_client_secret: str | None = None
    github_client_id: str | None = None
    github_client_secret: str | None = None

    # X (Twitter) API v2 Bearer Token for official API access
    x_bearer_token: str | None = None

    # Optional Fernet key used to encrypt stored secrets (OAuth tokens, IMAP passwords).
    # Generate one via: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    fernet_key: str | None = None


settings = Settings()
