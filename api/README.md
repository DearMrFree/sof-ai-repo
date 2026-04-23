# sof.ai API

FastAPI backend for the School of AI LMS.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn sof_ai_api.main:app --reload --port 8000
```

Visit http://localhost:8000/docs for interactive API docs.

## Endpoints (v1)

- `GET /health` — liveness
- `POST /progress/enroll` — enroll a user in a program
- `POST /progress/complete` — mark a lesson complete
- `GET /progress/{user_id}/{program_slug}` — progress summary
- `POST /devin/attempts` — record a Devin capstone attempt

## Tests

```bash
pytest
```

## Env

Copy `.env.example` to `.env` and fill in.
