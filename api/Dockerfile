# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps for psycopg + runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast, reproducible installs from uv.lock.
RUN pip install --no-cache-dir uv==0.4.29

# Copy lockfiles + project metadata first for layer caching.
COPY pyproject.toml uv.lock ./
COPY src ./src

# Install the project + postgres extra into the system Python (no venv in container).
RUN uv pip install --system --no-cache \
        -e ".[postgres]"

EXPOSE 8000

# SQLModel create_all runs on startup (see main.py). No migrations tool yet;
# add one before we ship user-critical schema changes.
CMD ["uvicorn", "sof_ai_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
