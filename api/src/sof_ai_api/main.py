from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import get_session, init_db
from .routes import (
    applications,
    articles,
    auth,
    challenges,
    devin,
    embed,
    enrollments,
    health,
    journals,
    pioneer_applications,
    progress,
    twins,
    users,
    wallet,
)
from .seed_journal_agentic_teaching import seed as seed_journal_agentic_teaching
from .seed_journal_ai import seed as seed_journal_ai
from .settings import settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    # Seed founding articles for every well-known journal on every
    # startup. Each seed is idempotent — every insert is guarded by an
    # existence check — so warm restarts are cheap no-ops. Each is
    # wrapped in its own try/except so one seed failing (e.g. a pending
    # additive migration) never blocks the application from coming up
    # and never blocks a *sibling* journal's seed from running.
    for _seed_fn, _label in (
        (seed_journal_ai, "journal-ai"),
        (seed_journal_agentic_teaching, "agentic-teaching"),
    ):
        try:
            with next(get_session()) as session:
                _seed_fn(session)
        except Exception:
            # Don't die on startup if the seed can't land. The journal
            # can always be seeded later via POST /journals/_seed/{slug}.
            pass
    yield


app = FastAPI(
    title="sof.ai API",
    description="School of AI LMS backend — programs, progress, Devin capstones.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(progress.router)
app.include_router(devin.router)
app.include_router(challenges.router)
app.include_router(wallet.router)
app.include_router(journals.router)
app.include_router(articles.router)
app.include_router(applications.router)
app.include_router(pioneer_applications.router)
app.include_router(enrollments.router)
app.include_router(embed.router)
app.include_router(users.router)
app.include_router(twins.router)
app.include_router(auth.router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "sof.ai API",
        "tagline": "Learn anything. Train anything. Build anything.",
        "docs": "/docs",
    }
