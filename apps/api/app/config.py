from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Lingvo Connect Admin API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://lingvo_admin:local@localhost:5434/lingvo_admin"
    session_secret: str = Field(min_length=32)
    totp_encryption_key: str
    admin_web_origin: str = "http://localhost:3003"
    public_site_origin: str = "http://localhost:3002"
    cookie_secure: bool = False
    session_hours: int = 12
    session_idle_minutes: int = 60
    login_window_seconds: int = 300
    login_max_attempts: int = 8
    public_rate_limit_requests: int = 5
    public_rate_limit_window_seconds: int = 600
    public_max_body_bytes: int = 65536
    public_min_submit_seconds: float = 1.5
    application_file_max_bytes: int = 15 * 1024 * 1024
    application_storage_path: str = "./storage"


@lru_cache
def get_settings() -> Settings:
    return Settings()
