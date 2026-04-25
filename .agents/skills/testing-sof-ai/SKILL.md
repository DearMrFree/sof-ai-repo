# Testing sof.ai

Keep this file as the canonical place for hard-won knowledge about how to
test sof.ai end-to-end. Add new pitfalls here when you find them.

## TL;DR

- Chrome **does not launch** on the Devin VM for this repo. Don't waste
  time trying to start `google-chrome --remote-debugging-port=29229` —
  the process exits and CDP never listens. Test through the API instead;
  the route handlers exercise the same code paths as the UI buttons.
- Use the **NextAuth email-credentials** flow for shell-based login.
  Provider id is **`email`** (not `credentials`). The endpoint is
  `/api/auth/callback/email`.
- Backend lives at https://sofai.fly.dev (Fly), frontend at
  https://sof.ai (Vercel). Both auto-deploy on merge to `main`.

## Shell-based login (NextAuth CSRF)

```bash
mkdir -p /tmp/lap-test && cd /tmp/lap-test
rm -f cookies.txt csrf.json
curl -sS -c cookies.txt https://sof.ai/api/auth/csrf -o csrf.json
CSRF=$(python3 -c "import json;print(json.load(open('csrf.json'))['csrfToken'])")
curl -sS -c cookies.txt -b cookies.txt -L \
  -X POST "https://sof.ai/api/auth/callback/email?callbackUrl=/" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=freedom@thevrschool.org" \
  --data-urlencode "callbackUrl=/" \
  --data-urlencode "json=true" -o /dev/null -w "HTTP %{http_code}\n"
curl -sS -b cookies.txt https://sof.ai/api/auth/session
```

Expected: `HTTP 200`, then `{"user":{"name":"Freedom","email":"freedom@thevrschool.org","image":null,"id":"email:freedom@thevrschool.org"},...}`.

Reuse `cookies.txt` on every downstream call (`-b cookies.txt`). The
NextAuth JWT is valid for ~30 days.

Session cookie name (production, HTTPS): `__Secure-next-auth.session-token`.
Dev cookie name (HTTP): `next-auth.session-token`.

## Living-Article Pipeline contract

- Author wire format: `"type:id|display_name"`. Legacy rows without the
  `|` resolve via the canonical-name map (`freedom` → "Dr. Freedom Cheteni",
  `devin` → "Devin", `claude` → "Claude", `gemini` → "Gemini").
- Freedom is always slot 1; Devin always slot 2; other humans 3+.
  Claude / Gemini are reviewers, **never** authors.
- The API auto-canonicalizes Freedom regardless of how the auth proxy
  presents him: `("user","freedom")`, `("user","email:freedom@thevrschool.org")`,
  and `("user","freedom@thevrschool.org")` all collapse into the canonical
  `("user","freedom")` slot 1.
- Idempotency is on `source_session_id` via a partial unique index. Re-POSTing
  `/api/articles/start` with the same `sessionId` returns the same article id.
- Pipeline phases: `drafted → claude_review_1 → devin_review_1 →
  claude_review_2 → gemini_review → devin_final → awaiting_approval →
  approved → published`. The review chain is idempotent — re-running
  `run-pipeline` skips phases at-or-past their state.
- `awaiting_approval` gate: only Dr. Cheteni can call `/api/articles/{id}/approve`.
  Anonymous calls return `401 "Sign in to approve a Living Article."`

## End-to-end smoke test

After login (above), this proves the pipeline works:

```bash
SESSION_ID=$(uuidgen)
cat > start-body.json <<JSON
{
  "sessionId": "$SESSION_ID",
  "agentId": "devin",
  "transcript": [
    {"role":"user","content":"...4 turns of Devin co-work..."},
    {"role":"agent","content":"..."},
    {"role":"user","content":"..."},
    {"role":"agent","content":"..."}
  ],
  "titleHint": "...",
  "primaryAuthor": {"type":"user","id":"email:freedom@thevrschool.org","display_name":"Freedom Cheteni"},
  "coauthors": []
}
JSON
# Spawn — assert canonical authors
curl -sS -b cookies.txt -X POST https://sof.ai/api/articles/start \
  -H "Content-Type: application/json" --data @start-body.json
# Idempotency — re-POST returns identical id
curl -sS -b cookies.txt -X POST https://sof.ai/api/articles/start \
  -H "Content-Type: application/json" --data @start-body.json
# Run pipeline — 5 real LLM calls, ~3 min, ends at awaiting_approval
curl -sS --max-time 600 -b cookies.txt \
  -X POST https://sof.ai/api/articles/{id}/run-pipeline
# Approve
curl -sS -b cookies.txt -X POST https://sof.ai/api/articles/{id}/approve \
  -H "Content-Type: application/json" \
  --data '{"approverEmail":"freedom@thevrschool.org"}'
```

## Model-name convention

**Always** use the env-var-with-default pattern, never a hardcoded
`-latest` model name (those get retired):

```ts
model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5"
model: process.env.GEMINI_MODEL ?? "gemini-2.5-pro"
```

Files using this convention: `web/src/lib/articles/reviewChain.ts`,
`web/src/lib/llm.ts`, `web/src/app/api/cowork/plan/route.ts`,
`web/src/app/api/files/analyze/route.ts`,
`web/src/app/api/agent-chat/route.ts`,
`web/src/app/api/recommend-video/route.ts`,
`web/src/app/api/tutor/route.ts`.

If you ever see `claude-3-5-sonnet-latest` or `claude-3-opus-latest` etc.
in a new diff — it's wrong, those are retired. The Anthropic 404 looks
like: `{"type":"not_found_error","message":"model: claude-3-5-sonnet-latest"}`.

## Gemini systemInstruction shape

Google's Gemini API rejects `role` on `systemInstruction`. It accepts
only `parts`:

```ts
// Correct
systemInstruction: { parts: [{ text: system }] }

// Wrong — 400 the moment GEMINI_API_KEY is provisioned
systemInstruction: { role: "system", parts: [{ text: system }] }
```

## Useful production endpoints

- `GET https://sofai.fly.dev/articles/{id}` — direct backend read
  (bypasses Next.js render; returns full JSON with `reviews[]`)
- `GET https://sofai.fly.dev/journals` — list all journals
- `GET https://sofai.fly.dev/journals/_ojs/status` — `{enabled: true|false}`,
  flips when `OJS_BASE_URL` + `OJS_API_TOKEN` are set on Fly

## Known cookies / secrets present on Vercel

Never commit these — they live in Vercel env:

- `ANTHROPIC_API_KEY` — Claude + Devin phases + Gemini fallback
- `INTERNAL_API_KEY` — gates the Vercel→Fly proxy calls (sent as `X-Internal-Auth`)
- `NEXTAUTH_SECRET` — JWT session encryption
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob (file uploads)
- `VERCEL_TOKEN` — when scripting Vercel ops; also live in agent shell
- `GEMINI_API_KEY` — typically **unset** in prod; Gemini phase falls back to Anthropic

## Cowork PR test pattern

For cowork (PR #9-style features), the Vercel preview URL is gated by
Vercel SSO and not reachable from curl. Run `next dev` locally with the
same env (`vercel env pull .env.production.local`), reuse the cookie
from step 1 above (NextAuth's signed JWT works against any host on the
same `NEXTAUTH_SECRET`), and exercise the cowork endpoints there.
