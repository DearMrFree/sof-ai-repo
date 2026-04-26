# Testing the LuxAI1 embed widget + insights pipeline

This skill captures the testing patterns for the LuxAI1 chat widget on ai1.llc and the daily insights pipeline that classifies its conversations into training signal. Use it to verify changes to either pipeline in <15 minutes without re-deriving the auth + deploy + cron + UI sequence.

## What this stack looks like

- **Widget**: `/embed/luxai1.js` (Shadow-DOM script tag), embedded on https://ai1.llc, talks to `/api/embed/luxai1/chat`
- **Persistence**: Web side proxies every turn to FastAPI on Fly, which writes `EmbedConversation` rows
- **Classifier**: Vercel cron at `/api/embed/cron/insights` runs at 09:00 UTC, walks the FastAPI pending queue, calls Anthropic, upserts `EmbedInsight` rows
- **Trainer console**: `/embed/{slug}/insights` (NextAuth + canViewAgent gated), ranked by signal_score

## Devin Secrets Needed

- `FLY_API_TOKEN` — to deploy FastAPI changes and read INTERNAL_API_KEY off the running container
- `ANTHROPIC_API_KEY` — set on Vercel sof-ai production (used by classifier)
- `INTERNAL_API_KEY` — set on **both** Vercel and Fly; values must match. See "Retrieving keys" below for how to read it.
- `RESEND_API_KEY` — set on Vercel sof-ai production (used by lead-submission email)

## Phase 1 setup checklist

### 1. Confirm Fly is at merged main

The Vercel side auto-deploys on every push to `main`, but **Fly does not**. After any `api/` change merges, somebody must run `flyctl deploy` or the cron will hit 404s. Check:

```bash
export PATH="$HOME/.fly/bin:$PATH"
curl -s -w "\nHTTP=%{http_code}\n" "https://sofai.fly.dev/embed/luxai1/insights/pending?limit=1" -H "X-Internal-Auth: $INTERNAL_API_KEY"
# Expect HTTP=200. If HTTP=404, Fly needs a redeploy:
cd api && flyctl deploy --remote-only   # NOT from repo root — Dockerfile expects api/ as build context
```

If flyctl is missing: `curl -L https://fly.io/install.sh | sh && export PATH="$HOME/.fly/bin:$PATH"`

### 2. Retrieving INTERNAL_API_KEY

`vercel env pull` returns **redacted empty quoted strings** for sensitive secrets even with `--environment=production`. The reliable workaround is to read from the running Fly container (read-only, no impact):

```bash
export PATH="$HOME/.fly/bin:$PATH"
KEY=$(flyctl ssh console -a sofai -C 'printenv INTERNAL_API_KEY' 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | tr -d '\r' | grep -v '^$' | tail -1)
export INTERNAL_API_KEY="$KEY"
echo "len=${#INTERNAL_API_KEY}"  # expect ~43 for production key
```

### 3. Confirm test data

```bash
curl -s "https://sofai.fly.dev/embed/luxai1/conversations?limit=10" -H "X-Internal-Auth: $INTERNAL_API_KEY" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["total"])'
```

If `total=0`: seed by POSTing to `https://sof.ai/api/embed/luxai1/chat` a couple of times (the public chat endpoint persists every turn).

## Phase 2 testing patterns

### Manually trigger the cron (production)

```bash
curl -s -X POST "https://sof.ai/api/embed/cron/insights" -H "X-Internal-Auth: $INTERNAL_API_KEY"
# Expect:
# {"slugs":[{"slug":"luxai1","pending":N,"classified":N,"failed":0,"errors":[]}],"total_classified":N}
```

Key assertions:
- `slugs[0].failed == 0` — broken Anthropic path produces failed > 0
- `total_classified > 0` on first run, `== 0` on immediate re-run (idempotency by `conversation_id`)
- `slugs[0].pending` reflects the **full backlog**, not the page size — see PR #33 below

Then verify the insights landed:

```bash
curl -s "https://sofai.fly.dev/embed/luxai1/insights?limit=10" -H "X-Internal-Auth: $INTERNAL_API_KEY" | python3 -m json.tool
# Each item.insight should have:
#   insight_type ∈ {missed_lead, capability_gap, off_brand, great_save}
#   0.0 <= signal_score <= 1.0
#   classifier_model == "claude-sonnet-4-5"  (NOT claude-3-5-sonnet — that's an older variant)
#   summary, reasoning non-empty
```

### UI verification when Chrome won't launch (Playwright fallback)

The Devin VM Chrome has been broken in 5+ consecutive sessions. **Don't waste time trying to launch native Chrome** — go straight to Playwright headless:

```bash
mkdir -p /home/ubuntu/luxai1-ui-test && cd /home/ubuntu/luxai1-ui-test
npm init -y > /dev/null && npm i playwright > /dev/null 2>&1
npx playwright install chromium
```

Minimal sign-in-as-Freedom + assert script (NextAuth email-credentials provider accepts any email, no password). The trick: the email panel is **collapsed by default** behind a button labeled `Use my email instead` (NOT "Sign in with email"):

```js
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newContext({ viewport: { width: 1280, height: 1600 } }).then(c => c.newPage());
await page.goto('https://sof.ai/signin', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /use my email instead/i }).click();
await page.locator('input[type="email"]').fill('freedom@thevrschool.org');
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(3000);  // signin redirect to /classroom
await page.goto('https://sof.ai/embed/luxai1/insights', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/home/ubuntu/insights.png', fullPage: true });
```

Lead professors authorized to view luxai1 console: `freedom@thevrschool.org`, `devin@sof.ai`, owner `luxservicesbayarea@gmail.com`.

Key UI assertions (from page.tsx):
- H1 exactly: `LUXAI1 — training insights` (em-dash, not hyphen)
- Type chips: `Missed lead`, `Capability gap`, `Off-brand`, `Great save` (these EXACT strings)
- Score badges: `\d+% signal` (NOT `0.92` — formatter converts to integer percent)
- Each card wraps `<a href="/embed/luxai1/conversations/{id}">`
- Sort: descending by signal_score (so cards rendered cid=highest, cid=lowest)

**Cosmetic gotcha**: each `\d+% signal` string appears **twice** in the DOM (likely a media-query or aria-label). When asserting descending order, dedupe by card link order rather than raw regex matches.

### Adversarial unit-test diff (proving regression fixes)

When a fix only fires under data states production can't easily reach (e.g. `eligible > limit` with limit=25), prove it via the unit-test diff pattern:

```bash
# 1. On post-fix main, run the regression test → expect PASS
cd /home/ubuntu/repos/sof-ai/api && unset INTERNAL_API_KEY && uv run pytest tests/test_embed_insights.py::test_pending_total_reflects_full_backlog_not_page -v

# 2. Roll back ONLY the production code (not test) to pre-fix commit
cd /home/ubuntu/repos/sof-ai
git show <pre-fix-sha>:api/src/sof_ai_api/routes/embed.py > /tmp/embed_prefix.py
cp /tmp/embed_prefix.py api/src/sof_ai_api/routes/embed.py
cd api && unset INTERNAL_API_KEY && uv run pytest tests/test_embed_insights.py::test_pending_total_reflects_full_backlog_not_page  # expect FAIL with exact value mismatch

# 3. Restore
cd /home/ubuntu/repos/sof-ai && git checkout api/src/sof_ai_api/routes/embed.py
```

**IMPORTANT: `unset INTERNAL_API_KEY` before pytest.** The test client uses `"test-internal-key"` for AUTH headers. If your shell has `INTERNAL_API_KEY` exported (which is needed for curl tests), `settings.internal_api_key` reads from env var → tests get 401.

## Common gotchas (will-bite-the-next-Devin-too)

- **Fly Dockerfile build context**: `flyctl deploy -c api/fly.toml` from repo root **fails** with "COPY pyproject.toml: not found". Run from `api/` directory: `cd api && flyctl deploy --remote-only`.
- **`vercel env pull` redacts secrets** to empty quoted strings. Don't trust them. Read from Fly via `flyctl ssh console`.
- **Resend sandbox** still blocks email delivery to non-sof.ai addresses (no verified sender domain on the account). The route succeeds, but the email never lands. Verify a domain at https://resend.com/domains to fix permanently.
- **NextAuth sign-in label**: the Use-my-email button is collapsed-by-default behind `Use my email instead`, NOT `Sign in with email`. Test scripts using the wrong label time out at 30s.
- **GH_ADMIN_PAT**: bot integrations can't change repo default branches or delete branches. If user provides a fine-grained PAT, it must include `Administration: Read and write` (not just `Contents`).
- **Chrome won't launch** on the Devin VM (5+ sessions). Don't try `google-chrome` or `wmctrl` workarounds — go straight to Playwright headless.
