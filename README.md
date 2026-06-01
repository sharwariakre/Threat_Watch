# Log Anomaly Detection

Full-stack cybersecurity log analysis app. Upload web/proxy access logs and get a
SOC-grade analysis built from a **two-layer AI pipeline**:

1. **Layer 1 — deterministic parser** (`backend/src/lib/logParser.ts`): auto-detects
   the log format (Apache combined / Nginx / ZScaler), regex-parses each line into a
   structured `LogEntry`, computes stats (requests per IP, status breakdown, requests
   per minute), and flags brute-force IPs. No AI involved.
2. **Layer 2 — Claude** (`backend/src/lib/claudeAnalyzer.ts`): the *pre-parsed*
   structured JSON + stats (not raw logs) are sent to Claude in a single call,
   returning a SOC summary, timeline, and ranked anomalies. The response is validated
   before storage. Falls back to deterministic heuristics if `ANTHROPIC_API_KEY` is
   unset. Model defaults to `claude-sonnet-4-6` (override with `ANTHROPIC_MODEL`).

## Architecture

Two separate servers + Postgres:

- **Frontend** — Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui · Recharts ·
  TanStack Table. Runs on **:3000**. Lives at the repo root (`app/`, `components/`, `lib/`).
- **Backend** — standalone Node.js **Express** API (TypeScript). Runs on **:3001**.
  Lives in `backend/`. Raw `pg` queries (no ORM), JWT in an httpOnly cookie, bcrypt,
  multer for uploads.
- **Database** — PostgreSQL 15.

The frontend talks to the backend over HTTP at `NEXT_PUBLIC_API_URL` (default
`http://localhost:3001`), sending the auth cookie with `credentials: "include"`.
CORS on the backend allows the frontend origin.

## Quick start (local, two terminals)

Start Postgres (schema auto-applied) and copy env files:

```bash
docker compose up -d db                 # Postgres on host port 5433
cp .env.local.example .env.local        # frontend: NEXT_PUBLIC_API_URL
cp backend/.env.example backend/.env    # backend: fill in ANTHROPIC_API_KEY, JWT_SECRET, etc.
```

Terminal 1 — backend:

```bash
cd backend
npm install
npm run dev          # tsx watch -> http://localhost:3001
```

Terminal 2 — frontend (repo root):

```bash
npm install
npm run dev          # next dev -> http://localhost:3000
```

Open http://localhost:3000 → register → upload `sample-logs/apache_sample.log`.

## Quick start (Docker, everything at once)

```bash
ANTHROPIC_API_KEY=sk-ant-... JWT_SECRET=$(openssl rand -hex 32) docker compose up --build
```

Brings up three services: `db` (Postgres 15, schema auto-applied), `backend`
(Express on :3001), `frontend` (Next.js on :3000).

## Environment variables

**Frontend** (`.env.local`):

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API (default `http://localhost:3001`). |

**Backend** (`backend/.env`):

| Var | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key. Optional — without it, Layer 2 falls back to heuristics. |
| `ANTHROPIC_MODEL` | Optional model override (default `claude-sonnet-4-6`). |
| `DATABASE_URL` | Postgres connection string (local: `...@localhost:5433/log_anomaly`). |
| `JWT_SECRET` | Secret for signing auth JWTs. |
| `PORT` | Backend port (default `3001`). |
| `FRONTEND_URL` | Allowed CORS origin (default `http://localhost:3000`). |

## API routes (Express, all under `/api`, served on :3001)

| Method | Route | Body | Returns |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `{ email, password }` | sets JWT cookie |
| POST | `/api/auth/login` | `{ email, password }` | sets JWT cookie |
| POST | `/api/upload` | multipart `file` | `{ upload_id }` |
| POST | `/api/analyze` | `{ upload_id }` | `{ id }` (analysis result id) |
| GET | `/api/results/:id` | — | `AnalysisResult` JSON |
| GET | `/health` | — | `{ ok: true }` |

The dashboard components render with mock data (`lib/mockData.ts`) when the API
isn't reachable, so the UI is explorable without a running backend.
