from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./sof_ai.db"
    cors_origins: str = "http://localhost:3000"
    # Shared secret required on mutating Educoin routes (e.g. /wallet/transfer)
    # so the public Fly backend can't be called directly by clients who'd
    # spoof a sender_id. The Next.js proxy forwards this as X-Internal-Auth.
    # Empty string disables the gate for local dev and test suites that
    # hit the app via TestClient (they don't need to forge the header).
    internal_api_key: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
