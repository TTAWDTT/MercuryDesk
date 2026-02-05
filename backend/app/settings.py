from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MERCURYDESK_", env_file=".env", extra="ignore")

    database_url: str = "sqlite+pysqlite:///./mercurydesk.db"
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    media_dir: str = "./media"

    # Optional Fernet key used to encrypt stored secrets (OAuth tokens, IMAP passwords).
    # Generate one via: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    fernet_key: str | None = None


settings = Settings()
