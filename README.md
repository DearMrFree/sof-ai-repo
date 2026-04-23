# sof.ai — School of AI

**Learn anything. Train anything. Build anything.**

An AI-native learning management system. Every lesson has an AI tutor. Every assessment is AI-graded. The flagship **Software Engineer** program is fully powered by [Devin](https://devin.ai) — learners don't just read about engineering, they ship PRs with a real autonomous engineer.

Inspired by [Curriki](https://www.curriki.org)'s open educational resources mission and the **Program → Module → Lesson → Activity** content model from CurrikiStudio / C2E.

---

## Monorepo

```
sof-ai/
├── web/    # Next.js 14 frontend (App Router, Tailwind, shadcn/ui, NextAuth)
├── api/    # FastAPI backend (SQLModel, Postgres)
└── ...
```

## Quick start (local)

```bash
# Frontend
cd web
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY, etc.
npm install
npm run dev                  # http://localhost:3000

# Backend
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn sof_ai_api.main:app --reload --port 8000
```

## Content model

```
Program            e.g. "Software Engineer, powered by Devin"
 └── Module        e.g. "Week 1: Git & GitHub"
      └── Lesson   e.g. "Making your first PR"
           └── Activity   (one of)
                ├─ Reading (MDX)
                ├─ Video
                ├─ Quiz (AI-graded)
                ├─ CodeLab (in-browser sandbox)
                ├─ DevinTask (spawns a real Devin session)
                └─ Reflection (free-form, AI feedback)
```

Programs live in `web/src/content/programs/` as MDX + JSON. In v2 we'll migrate to a DB-backed authoring tool (like CurrikiStudio).

## License

MIT
