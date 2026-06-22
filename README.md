# log_anomaly_detection

AI-powered cybersecurity log analysis platform for SOC analysts. Upload a web server log file and get an instant AI-generated threat summary, anomaly detection with confidence scores, attack classification, an event timeline, and a remediation playbook — all in one dashboard.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts, TanStack Table |
| Backend | Node.js, Express, TypeScript (standalone server on `:3001`) |
| Database | PostgreSQL 15 (raw `pg` queries, no ORM) |
| AI | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Auth | JWT in an httpOnly cookie, bcrypt |
| Infra | Docker, Docker Compose |

---

## Architecture

```
Browser (Next.js :3000)
    |
    |  REST API calls
    v
Express Backend (:3001)
    |
    +-- POST /api/upload
    |       -> Multer -> Disk storage
    |
    +-- POST /api/analyze
    |       -> logParser.ts        (Layer 1: deterministic parse + stats)
    |       -> claudeAnalyzer.ts   (Layer 2: Claude API)
    |       -> PostgreSQL          (save result)
    |
    +-- POST /api/remediation
    |       -> remediationAnalyzer.ts  (Claude API)
    |       -> PostgreSQL              (cache playbook)
    |
    +-- GET /api/results/:id
            -> PostgreSQL          (fetch result)


PostgreSQL 15
    +-- users
    +-- uploads
    +-- analysis_results  (result JSONB, playbook JSONB)


External
    +-- Anthropic Claude API  (claude-sonnet-6)
```

---

## Features

- JWT-based authentication (register / login)
- Log file upload (`.log` / `.txt`)
- Two-layer AI pipeline (explained below)
- **SOC Analyst Summary** — plain-English threat narrative
- **Anomaly detection** with confidence scores and attack classification badges: Brute Force, SQL Injection, Path Traversal, Recon, Credential Stuffing
- **Critical alert banner** when a brute force attack succeeds
- **Event timeline** with severity levels
- **Top Attacking IPs** ranked panel
- **Remediation Playbook** — per-anomaly actionable steps (Immediate / Short-term / Long-term) with checkboxes
- **Fully interactive dashboard** — clicking stats, timeline events, anomaly IPs, status-code bars, and flagged log rows all filter or scroll to the relevant section
- Filterable, paginated log table (TanStack Table)
- Overview / Remediation tab layout
- Heuristic fallback when the Claude API key is not configured

---

## Screenshots

![Dashboard Overview](docs/Dashboard1.png)
![Anomalies & Timeline](docs/Dashboard2.png)
![Remediation Playbook](docs/Dashboard3.png)

---

## AI Usage

The platform uses a **two-layer pipeline**: a deterministic parser does all structured extraction and statistics, then Claude is used purely for threat reasoning on top of that structured data.

### Layer 1 — Deterministic Parser

`backend/src/lib/logParser.ts` — **no AI involved.**

- Auto-detects the log format from the first lines (Apache Combined, Nginx, ZScaler)
- Regex-parses each line into structured `LogEntry` fields: `timestamp`, `ip`, `method`, `url`, `status`, `bytes`, `userAgent`
- Computes stats: total requests, unique IPs, requests per IP, status-code breakdown, requests per minute, time range
- Pre-flags entries heuristically:
  - **Path traversal** patterns (`../../etc/passwd`)
  - **SQL injection** patterns (`UNION SELECT`, `OR 1=1`, `%27`)
  - **Suspicious user agents** (`sqlmap`, `nikto`, `nmap`)
  - **Brute force** — sliding 2-minute window; flags IPs with ≥ 5 failed logins (401s)
  - **Successful brute force** — detects when a streak of 401s ends in a 200 from the same IP

### Layer 2 — Claude API, Call 1: Main Analysis

`backend/src/lib/claudeAnalyzer.ts`

- **Model:** `claude-sonnet-4-20250514`
- **Input:** the pre-parsed structured JSON + computed stats (**not** raw log text)
- Claude is asked to:
  1. Write a 3-sentence SOC analyst narrative summarizing the threat landscape
  2. Build a chronological event timeline with severity levels
  3. Detect anomalies — each with an `ip`, `reason`, and `confidence` score (0–1)
- **Why structured input:** sending pre-parsed JSON instead of raw logs reduces token usage, eliminates parsing hallucinations, and lets Claude focus purely on threat reasoning.
- **Fallback:** if `ANTHROPIC_API_KEY` is missing or the call fails, the pipeline falls back to deterministic heuristic analysis so the app never breaks.

### Layer 2 — Claude API, Call 2: Remediation Playbook

`backend/src/lib/remediationAnalyzer.ts`

- **Model:** `claude-sonnet-4-20250514`
- **Separate** from the main analysis call — independent failure, independent regeneration
- **Input:** the confirmed anomalies + their related log entries
- Claude is asked to generate a **specific, actionable** remediation checklist per anomaly — referencing the actual IPs, URLs, timestamps, and payloads observed, not generic advice.
- Each step is classified as **Immediate**, **Short-term**, or **Long-term**.
- The result is **cached in PostgreSQL** (a `playbook` JSONB column on `analysis_results`) — Claude is called at most once per analysis, never on page refresh.

---

## Local Setup (without Docker)

### Prerequisites

- Node.js 18+
- PostgreSQL 15
- An Anthropic API key (optional — the app works without it using the heuristic fallback)

### Steps

1. **Clone the repo:**

   ```bash
   git clone <repository-url>
   cd log_anomaly_detection
   ```

2. **Create the database and apply the schema:**

   ```bash
   createdb log_anomaly
   psql -d log_anomaly -f db/schema.sql
   ```

3. **Set up environment variables (two files).**

   `backend/.env`:

   ```bash
   ANTHROPIC_API_KEY=your_key_here
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/log_anomaly
   JWT_SECRET=your_secret_here
   PORT=3001
   ```

   `.env.local` (frontend, at repo root):

   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

4. **Install and run the backend:**

   ```bash
   cd backend
   npm install
   npm run dev
   ```

5. **Install and run the frontend** (in a second terminal, from the repo root):

   ```bash
   npm install
   npm run dev
   ```

6. **Open** http://localhost:3000

   Register → upload `sample-logs/apache_sample.log` → view results.

---

## Local Setup (with Docker) — recommended

**Prerequisites:** Docker + Docker Compose

```bash
docker compose up -d
```

This starts:

- **PostgreSQL 15** on port `5433` (schema auto-applied)
- **Express backend** on port `3001`
- **Next.js frontend** on port `3000`

Open http://localhost:3000

---

## Sample Log File

Location: `sample-logs/apache_sample.log`

51 lines of Apache Combined Log format with realistic anomalies baked in:

- **`198.51.100.77`** — 19 rapid `POST /login` attempts (401s) followed by a successful login (200): credential stuffing / brute force
- **`192.0.2.55`** — `sqlmap/1.7.2` scanner: path traversal, SQL injection payloads, sensitive-file enumeration
- **`203.0.113.88`** — sequential recon pattern (`/`, `/robots.txt`, `/sitemap.xml`)
- Normal traffic from legitimate IPs for contrast

---

## Design Decisions Worth Noting

- **Standalone Express backend** (not Next.js API routes) — matches the assignment requirement for a separate backend framework.
- **No ORM** — raw `pg` queries for full transparency over every statement.
- **Two separate Claude calls** — the main analysis and the remediation playbook are intentionally decoupled, so a remediation failure never breaks the dashboard and each can be regenerated independently.
- **Empty playbooks are not cached** — if the API key is missing, the cache stays empty so the first real run generates and caches properly.
- **Heuristic fallback** — the app is fully functional without an API key, using deterministic pattern matching for anomaly detection.

---

## What I'd Add With More Time

- ZScaler and firewall log-format support (the parser is designed to be extensible)
- Natural-language log querying ("show all requests from suspicious IPs after 8am")
- Attack-narrative reconstruction — Claude traces the full kill chain across multiple anomalies
- Threat-intel enrichment — cross-reference flagged IPs against AbuseIPDB / VirusTotal
- Real-time log streaming instead of file upload
