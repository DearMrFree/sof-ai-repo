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


# Unique indexes added after initial table creation. These enforce invariants
# (e.g. one article per chat session) without rewriting the migration history.
# Each tuple: (index name, CREATE UNIQUE INDEX statement).
_ADDITIVE_UNIQUE_INDEXES: tuple[tuple[str, str], ...] = (
    # Idempotency guard for POST /articles/start. Partial index so legacy
    # articles with NULL source_session_id are unaffected.
    (
        "uq_article_source_session",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_article_source_session "
        "ON journalarticle (source_session_id) "
        "WHERE source_session_id IS NOT NULL",
    ),
)


def _apply_additive_migrations() -> None:
    """Add columns/indexes that exist on the SQLModel but not yet on the live DB.

    Both SQLite and Postgres support ``ALTER TABLE ... ADD COLUMN`` but
    neither supports a portable ``IF NOT EXISTS`` form for it. Each statement
    runs in its own transaction: on Postgres a failed statement poisons the
    enclosing txn and cascades to every subsequent statement, so wrapping
    everything in a single ``engine.begin()`` would silently skip later
    migrations whenever an earlier one was already applied.
    """
    for _table, _column, _coltype in _ADDITIVE_MIGRATIONS:
        try:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        f"ALTER TABLE {_table} ADD COLUMN {_column} {_coltype}"
                    )
                )
        except Exception:
            # Column likely already exists; safe to ignore.
            continue

    for _name, _stmt in _ADDITIVE_UNIQUE_INDEXES:
        try:
            with engine.begin() as conn:
                conn.execute(text(_stmt))
        except Exception:
            # Index may already exist or the dialect may not support the
            # partial predicate; safe to ignore at boot.
            continue


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _apply_additive_migrations()


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
