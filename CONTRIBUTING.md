# Contributing to sof.ai

Thanks for wanting to help build the School of AI.

## Authoring content

All programs live under `web/src/content/programs/<program-slug>/`.

```
programs/<program-slug>/
├── program.json                    # program-level metadata
└── modules/
    └── 01-<module-slug>/
        ├── module.json             # module-level metadata
        └── lessons/
            ├── 01-<lesson-slug>.mdx
            ├── 02-<lesson-slug>.mdx
            └── ...
```

Lessons are MDX files with YAML frontmatter. Required fields:

```mdx
---
title: "Your first commit"
summary: "One-line hook for the lesson."
estimatedMinutes: 15
# Optional: add a Devin capstone at the end of the lesson.
devinCapstone:
  title: "Short title for the capstone"
  prompt: |
    A plain-English task spec for Devin.
  repoHint: "DearMrFree/sof-ai-scratch"
  rubric:
    - "Acceptance criterion 1"
    - "Acceptance criterion 2"
---

Lesson body in MDX. You can use headings, lists, code blocks, and anything
else the MDX renderer supports.
```

## Dev loop

```bash
cd web && npm run dev
cd api && uvicorn sof_ai_api.main:app --reload
```

## Before opening a PR

```bash
# Web
cd web && npm run lint && npm run build

# API
cd api && ruff check . && pytest -q
```

CI runs both on every PR.
