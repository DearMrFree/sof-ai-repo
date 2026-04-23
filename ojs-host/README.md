# sof.ai — OJS host companion

This directory deploys a self-hosted [Open Journal Systems 3.4](https://pkp.sfu.ca/software/ojs/) instance on Fly.io. It's the **backend** of the OJS federation adapter shipped in `api/src/sof_ai_api/integrations/ojs/`: once the OJS machine is up and its API token is wired into sof-ai-api's secrets, every new journal / article / peer review / issue written on sof.ai is mirrored to OJS in real time.

## Why OJS?

OJS is the world's most widely used scholarly publishing platform — 25,000+ journals rely on it. Building the Journalism School of AI on top of OJS means every paper on sof.ai gets:

- a real submission workflow (editor desk → review → copyediting → galley)
- DOI support (Crossref / DataCite plug-ins)
- proper issue publishing + back-issue archives
- an open-source, auditable, portable record — journals can leave sof.ai at any time and keep all their data

The integration is **federated, not embedded**: OJS runs as its own service, and sof.ai mirrors writes to it via OJS's REST API. See `api/src/sof_ai_api/integrations/ojs/adapter.py`.

## Architecture

```
┌────────────────────────┐           ┌────────────────────────┐
│       sof.ai web       │           │     sof.ai FastAPI     │
│     (Next.js / JAM)    │ ──HTTP──▶ │   /journals/*          │
└────────────────────────┘           │                        │
                                     │   BackgroundTasks      │
                                     │   mirror_*()           │
                                     │      │                 │
                                     └──────┼─────────────────┘
                                            │ httpx
                                            ▼
                               ┌────────────────────────┐
                               │   OJS 3.4 on Fly.io    │
                               │   (this directory)     │
                               │  + Fly PG + files vol  │
                               └────────────────────────┘
```

## Deploy

Do this once, in order.

### 1. Create the Fly app + volume

```bash
fly apps create sofai-ojs
fly volumes create ojs_files -a sofai-ojs --size 3 --region iad
```

### 2. Provision PostgreSQL

If you already run a Fly Postgres cluster for sof.ai, attach it:

```bash
fly pg attach <existing-pg-app> -a sofai-ojs --database-name ojs
```

Or spin up a dedicated one:

```bash
fly pg create --name sofai-ojs-pg --region iad --initial-cluster-size 1 \
  --vm-size shared-cpu-1x --volume-size 3
fly pg attach sofai-ojs-pg -a sofai-ojs --database-name ojs
```

`fly pg attach` sets a `DATABASE_URL` secret. OJS wants the parts separately, so also set:

```bash
fly secrets set -a sofai-ojs \
  OJS_DB_HOST=<host-from-DATABASE_URL> \
  OJS_DB_USER=<user> \
  OJS_DB_PASSWORD=<password> \
  OJS_DB_NAME=ojs
```

### 3. Deploy

```bash
fly deploy -c ojs-host/fly.toml
```

### 4. Run the OJS install wizard

Open https://sofai-ojs.fly.dev in a browser. OJS's first-run wizard collects:

- Admin username + password → **save these, you'll mint the API token here**
- Locale (English)
- Database settings (already pre-filled from the env vars we set)
- Files directory: `/var/www/files` (default)

Wizard takes ~3 minutes. After it completes you'll land on the OJS dashboard.

### 5. Mint the API token

Inside OJS:

1. Top-right menu → **Edit Profile** → **API Key**.
2. Click **Generate New API Key** and copy it.
3. Wire it into the sof-ai-api app:

```bash
fly secrets set -a sof-ai-api \
  OJS_BASE_URL=https://sofai-ojs.fly.dev \
  OJS_API_TOKEN=<paste-here>
```

sof-ai-api re-rolls its machines on `fly secrets set`. Verify with:

```bash
curl https://sof-ai-api.fly.dev/journals/_ojs/status
# => {"enabled": true}
```

### 6. Backfill existing journals

Every `Journal` / `Article` / `PeerReview` / `Issue` that predates the OJS deploy is still in sof.ai's native tables but is not yet mirrored. Kick off the backfill:

```bash
curl -X POST \
  -H "X-Internal-Auth: $INTERNAL_API_KEY" \
  https://sof-ai-api.fly.dev/journals/_ojs/resync
```

The response reports how many rows were mirrored per table.

### 7. (Optional) Point `ojs.sof.ai` at the Fly app

Once your DNS is on Cloudflare / Namecheap for sof.ai:

```
CNAME   ojs   sofai-ojs.fly.dev
```

Then `fly certs add -a sofai-ojs ojs.sof.ai` and update `OJS_BASE_URL` in both `ojs-host/fly.toml` and the `sof-ai-api` secrets.

## Cost

At Fly's October-2025 price sheet:

- `shared-cpu-1x` (1 vCPU, 1 GB RAM): ~$5/mo when running, $0 when stopped (we use `auto_stop_machines = "stop"` in `fly.toml`)
- Fly volume (3 GB): ~$0.45/mo
- Fly Postgres (shared, 1 GB volume): ~$2/mo

Total: **~$8/mo** for a low-traffic academic journal host.

## Notes for future phases

- OJS 3.4 supports **Crossref DOI** via a first-party plug-in — turning that on upgrades every mirrored article to a real scholarly record.
- OJS's `submissionFile` API (`POST /{context}/api/v1/submissions/{id}/files`) is how we'll attach PDF galleys in Phase 3 once sof.ai grows a PDF-generator for the Notion-style editor.
- For a proper journal URL scheme (`ojs.sof.ai/journal-ai`), leave OJS's multi-context support enabled (it is, by default). Each `urlPath` in the adapter maps 1:1 to a context.
