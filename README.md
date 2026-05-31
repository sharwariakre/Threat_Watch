# Log Anomaly Detection

Full-stack cybersecurity log analysis app. Upload web/proxy access logs and get a
SOC-grade analysis built from a **two-layer AI pipeline**:

1. **Layer 1 — deterministic parser** (`lib/logParser.ts`): auto-detects the log
   format (Apache combined / Nginx / ZScaler), regex-parses each line into a
   structured `LogEntry`, and computes stats (requests per IP, status breakdown,
   requests per minute). No AI involved.
2. **Layer 2 — Claude** (`lib/claudeAnalyzer.ts`): the *pre-parsed* structured JSON
   + stats (not raw logs) are sent to `claude-sonnet-4-20250514` in a single call,
   returning a SOC summary, timeline, and ranked anomalies. The response is
   validated before storage. Falls back to deterministic heuristics if
   `ANTHROPIC_API_KEY` is unset.

## Stack

- Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Recharts · TanStack Table
- API routes (no separate backend) · PostgreSQL with raw `pg` queries (no ORM)
- JWT in an httpOnly cookie · bcrypt password hashing

## Quick start (local)

```bash
cp .env.local.example .env.local   # fill in ANTHROPIC_API_KEY (optional), JWT_SECRET
npm install

# start Postgres (compose just for the db) and apply the schema
docker compose up -d db

npm run dev
```

Open http://localhost:3000 → register → upload `sample-logs/apache_sample.log`.

## Quick start (Docker, full stack)

```bash
ANTHROPIC_API_KEY=sk-... JWT_SECRET=$(openssl rand -hex 32) docker compose up --build
```

This brings up `postgres:15` (schema auto-applied from `db/schema.sql`) and the
Next.js app on port 3000.

## Environment variables (`.env.local`)

| Var | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key. Optional — without it, Layer 2 falls back to heuristics. |
| `DATABASE_URL` | Postgres connection string. |
| `JWT_SECRET` | Secret for signing auth JWTs. |

## API routes

| Method | Route | Body | Returns |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `{ email, password }` | sets JWT cookie |
| POST | `/api/auth/login` | `{ email, password }` | sets JWT cookie |
| POST | `/api/upload` | multipart `file` | `{ upload_id }` |
| POST | `/api/analyze` | `{ upload_id }` | `{ id }` (analysis result id) |
| GET | `/api/results/[id]` | — | `AnalysisResult` JSON |

The dashboard components render with mock data (`lib/mockData.ts`) when the API
isn't connected, so the UI is fully explorable without a database.
