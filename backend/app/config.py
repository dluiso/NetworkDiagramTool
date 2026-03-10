from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Core security — MUST be changed in production via .env
    secret_key: str = "netdiagram-dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # Database
    database_url: str = "sqlite:///./netdiagram.db"

    # First admin credentials (used only when no admin user exists)
    first_admin_user: str = "admin"
    first_admin_password: str = "admin123"

    # Application
    app_name: str = "NetDiagram"
    app_env: str = "development"   # development | production

    # Frontend URL (used in email links)
    frontend_url: str = "http://localhost:5173"

    # CORS allowed origins (comma-separated)
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"

    # SMTP — all optional, email features disabled if smtp_host is empty
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@netdiagram.local"
    smtp_tls: bool = True

    # Rate limiting
    login_rate_limit: int = 10      # max attempts per window
    login_rate_window: int = 60     # window in seconds
    register_rate_limit: int = 5
    register_rate_window: int = 300

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origins_list(self) -> list:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user)

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
