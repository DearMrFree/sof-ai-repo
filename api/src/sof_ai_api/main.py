from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import get_session, init_db
from .routes import (
    applications,
    articles,
    challenges,
    devin,
    embed,
    enrollments,
    health,
    journals,
    progress,
    wallet,
)
from .seed_journal_ai import seed as seed_journal_ai
from .settings import settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    # Seed Journal AI's founding article on every startup. The function is
    # idempotent — every insert is guarded by an existence check — so warm
    # restarts are cheap no-ops. Wrapped in a try/except so a seed failure
    # never blocks the application from coming up.
    try:
        with next(get_session()) as session:
            seed_journal_ai(session)
    except Exception:
        # Don't die on startup if the seed can't land (e.g. DB migration
        # pending, missing column). The journal can always be seeded later
        # via the POST /journals/_seed/journal-ai endpoint.
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
app.include_router(enrollments.router)
app.include_router(embed.router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "sof.ai API",
        "tagline": "Learn anything. Train anything. Build anything.",
        "docs": "/docs",
    }
