from collections.abc import Iterator

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from .settings import settings

_connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(
    settings.database_url,
    echo=False,
    connect_args=_connect_args,
)


# Columns added after initial table creation. ``create_all`` only creates
# tables that don't already exist; it never adds new columns to an existing
# table. We need an explicit, idempotent ADD COLUMN per new field so a deploy
# against an already-populated SQLite/Postgres database picks up the schema
# changes without manual intervention.
#
# Each tuple: (table, column, type-with-defaults-and-nullability).
_ADDITIVE_MIGRATIONS: tuple[tuple[str, str, str], ...] = (
    # Living-Article Pipeline (PR #10).
    ("journalarticle", "source_session_id", "VARCHAR"),
    ("journalarticle", "pipeline_phase", "VARCHAR"),
    ("journalarticle", "pipeline_started_at", "TIMESTAMP"),
    ("journalarticle", "pipeline_completed_at", "TIMESTAMP"),
)


def _apply_additive_migrations() -> None:
    """Add columns that exist on the SQLModel but not yet on the live DB.

    Both SQLite and Postgres support ``ALTER TABLE ... ADD COLUMN`` but
    neither supports a portable ``IF NOT EXISTS`` form for it. We swallow
    the per-statement error if the column already exists; subsequent
    statements run independently.
    """
    with engine.begin() as conn:
        for table, column, coltype in _ADDITIVE_MIGRATIONS:
            try:
                conn.execute(
                    text(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")
                )
            except Exception:
                # Column likely already exists; safe to ignore.
                continue


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _apply_additive_migrations()


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
