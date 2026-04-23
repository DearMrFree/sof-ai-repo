from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routes import challenges, devin, health, progress, wallet
from .settings import settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
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


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "sof.ai API",
        "tagline": "Learn anything. Train anything. Build anything.",
        "docs": "/docs",
    }
