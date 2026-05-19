# Roger Health — Patient Encounter Portal

A production-grade, AI-assisted patient encounter portal built around three
pillars: **data integrity**, **AI efficiency**, and **clinical utility**.

- **Backend:** FastAPI · SQLAlchemy 2.0 async · asyncpg · Postgres 16 · Pydantic v2 · Anthropic `claude-3-5-sonnet-20241022`
- **Frontend:** React 18 · Vite · TypeScript (strict) · Tailwind CSS · TanStack Query v5 · `react-markdown`
- **Orchestration:** Docker Compose (`db`, `backend`, `frontend`)

---

## 1. One-command demo

```powershell
# 1. From the repo root, create your local .env from the template
Copy-Item .env.example .env

# 2. Open .env and paste your real ANTHROPIC_API_KEY
#    (the included .env in this repo already has one for the demo,
#     but .env is gitignored so it will never be committed)

# 3. Build and start everything
docker compose up --build
```

Then visit:

| Service        | URL                                  |
| -------------- | ------------------------------------ |
| Frontend       | <http://localhost:5173>              |
| Backend API    | <http://localhost:8000>              |
| Swagger docs   | <http://localhost:8000/docs>         |
| Health probe   | <http://localhost:8000/healthz>      |
| Postgres       | `localhost:5432` (user/pass `roger`) |

The first `up` will:

1. Start Postgres and wait for its healthcheck.
2. Bring up the backend, which retries DB connections with exponential
   backoff for up to ~30 s before failing.
3. Run an **idempotent** seed (`backend/seed.py`) that inserts two
   sample patients (James "Jim" Wright, Bettye Wellons) with one
   encounter each. Summaries are left blank so the demo can show
   "Generate Summary" live.
4. Launch the Vite dev server with HMR.

---

## 2. Architecture

```text
                                ┌──────────────────────────┐
                                │      Browser (5173)      │
                                │  React + TanStack Query  │
                                └────────────┬─────────────┘
                                             │ HTTP (JSON)
                                             ▼
┌──────────────────────────┐   async   ┌──────────────────────────┐
│  Anthropic Claude API     │◄────────►│      FastAPI (8000)       │
│  (claude-3-5-sonnet-     │  20s wall │   uvicorn · async I/O    │
│   20241022)              │  timeout  │   SHA-256 cache · OL     │
└──────────────────────────┘           └────────────┬─────────────┘
                                                    │ asyncpg
                                                    ▼
                                       ┌──────────────────────────┐
                                       │  Postgres 16 (5432)      │
                                       │  patients · encounters   │
                                       └──────────────────────────┘
```

### File tree (top level)

```text
Roger-Healthcare/
├── docker-compose.yml
├── .env.example          # committed
├── .env                  # gitignored (real key + DB URL)
├── .gitignore
├── README.md
├── VIDEO_SCRIPT.md
├── sample_data/          # mounted read-only into the backend container
│   ├── medical_history_1.txt
│   ├── medical_history_2.txt
│   ├── cleaned_transcript_1.txt
│   └── cleaned_transcript_2.txt
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh     # waits for DB, seeds, then uvicorn
│   ├── requirements.txt
│   ├── seed.py
│   └── app/
│       ├── main.py       # FastAPI factory, lifespan, CORS
│       ├── config.py     # Settings + hard-coded ANTHROPIC_MODEL
│       ├── database.py   # async engine, session factory, wait_for_db
│       ├── models.py     # Patient, Encounter (with indexes)
│       ├── schemas.py    # Pydantic v2 request/response models
│       ├── deps.py       # FastAPI DI helpers
│       ├── errors.py     # global exception handlers
│       ├── api/
│       │   ├── patients.py
│       │   └── encounters.py
│       └── services/
│           └── ai_summary.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── api/{client.ts,types.ts}
        ├── hooks/{usePatients.ts,useEncounters.ts,useToast.tsx}
        └── components/
            ├── Sidebar.tsx
            ├── MedicalHistoryEditor.tsx
            ├── LiveTranscriptEditor.tsx
            ├── EncounterTimeline.tsx
            ├── Toast.tsx
            └── Spinner.tsx
```

---

## 3. API reference

All routes are prefixed `/api` except `/healthz`. Responses are JSON.

| Method | Path                          | Description                                                                                                  |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| GET    | `/healthz`                    | Process liveness probe.                                                                                       |
| GET    | `/api/patients`               | List patients (summary + `latest_encounter_at`).                                                              |
| POST   | `/api/patients`               | Create a patient. Body: `{ name, date_of_birth, medical_history? }`.                                          |
| GET    | `/api/patients/{id}`          | Full patient detail with encounters (DESC by created_at).                                                     |
| PATCH  | `/api/patients/{id}`          | Update `medical_history` with optimistic locking. Body: `{ medical_history, expected_version, expected_updated_at }`. Returns **409** on stale write with `{ error: "version_conflict", current: PatientDetail }`. |
| POST   | `/api/encounters`             | Create an encounter, summarize transcript if non-empty.                                                       |
| PUT    | `/api/encounters/{id}`        | Update transcript. Re-summarize only if SHA-256 hash changed; otherwise reuse stored summary.                 |

Response payloads carry `summary_cached: bool` on encounter create/update so
the UI can render an **AI Summary cached** vs **AI Summary regenerated**
badge during the demo.

---

## 4. The three pillars

### Pillar 1 — Data integrity (optimistic locking)

`Patient` rows carry both an integer `version` and a `updated_at` timestamp.
Clients submit the version + timestamp they read; the server rejects stale
writes with HTTP 409 and an embedded copy of the current state. The
frontend surfaces a "Conflict — refresh to load latest" toast with a
**Refresh** action that invalidates the relevant TanStack Query cache key.

**Why optimistic over pessimistic locking?**

- The portal is UI-driven and write contention is low — most patients
  are edited by one clinician at a time.
- Pessimistic locks held across HTTP round-trips would serialize all
  writers, badly degrading UX and tying up DB connections.
- Optimistic locks let us scale reads cheaply, fail-fast on rare
  conflicts, and give the user a **clear, actionable** conflict signal
  rather than a silent overwrite.

### Pillar 2 — AI efficiency (SHA-256 transcript cache)

Every encounter row stores `transcript_hash = SHA-256(transcript.strip().lower())`.
On `PUT /encounters/{id}`, we recompute the hash and short-circuit the
LLM call entirely if it matches. The frontend renders **AI Summary
cached** so cache behavior is visible during the walkthrough.

**Why SHA-256 hashing?**

- Deterministic and content-addressed: identical clinical transcripts
  always produce the same key, regardless of insertion order or
  whitespace tweaks (because we normalize first).
- Cheap to compute (~µs) compared to a ~2 s LLM round-trip and
  hundreds of output tokens.
- Hex-encoded into a 64-char string that fits a `String(64)` column
  and is trivially indexable.

### Pillar 3 — Clinical utility (structured Markdown)

The Anthropic call is driven by a focused **Professional Medical Scribe**
system prompt that produces a fixed 5-section Markdown skeleton — Chief
Complaint, Key Symptoms, Pain Level, Clinician's Focus Areas, Plan / Next
Steps — under ~250 words. The frontend renders this with `react-markdown`
so clinicians get scannable structured output rather than a wall of prose.

---

## 5. Technical justifications

- **Async SQLAlchemy 2.0 + asyncpg** — the LLM call is the dominant
  latency in this app (~1–3 s). Running every request on a sync worker
  would block the event loop and tank concurrency. With `AsyncSession`,
  one uvicorn worker can comfortably serve hundreds of concurrent
  clinicians while the LLM is in flight.
- **TanStack Query v5** — automatic request dedup (multiple components
  reading the same patient share one fetch), built-in cache, and explicit
  invalidation primitives (`invalidateQueries`) — exactly what we need for
  the "refresh on conflict" UX without rolling our own state machine.
- **Pydantic v2** — `from_attributes=True` lets us serialize ORM objects
  directly with zero hand-mapping, and validation errors come out as
  clean JSON via the global exception handler.
- **Vite + TypeScript strict** — sub-second HMR for the demo and strict
  typing all the way through the API client (snake_case types mirror the
  Pydantic schemas exactly, eliminating a class of casing bugs).
- **Docker Compose with a single `up`** — one command brings up the
  database, runs the idempotent seed, and starts both servers with
  hot-reload, so a fresh interviewer can reproduce the demo trivially.

---

## 6. Edge cases handled

| Scenario                                  | Behavior                                                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Empty / whitespace transcript             | LLM is **not** called; summary is set to `"No transcript provided yet."`.                                                                 |
| LLM timeout (>20 s wall clock)            | `asyncio.wait_for` cancels the call; the encounter row is still saved with `"[Summary unavailable: timed out after 20s]"`.                |
| Anthropic API error (auth, 5xx, network)  | Caught and converted to `"[Summary unavailable: <reason>]"`; row persists. Endpoint returns 200 so the UI keeps working.                  |
| Missing `ANTHROPIC_API_KEY`               | No call is made; summary becomes `"[Summary unavailable: ANTHROPIC_API_KEY not configured]"`.                                             |
| Postgres not ready at backend startup     | `wait_for_db` retries with exponential backoff up to ~30 s before raising.                                                                |
| Two tabs editing same patient             | Second `PATCH` returns **409** with the current row; frontend shows a "Conflict — refresh" toast with an actionable button.               |
| Identical transcript re-PUT               | Hash matches; LLM is skipped; response carries `summary_cached: true` so the UI can show **AI Summary cached**.                           |
| Unhandled server exception                | Global FastAPI exception handler returns `{ "error": "internal_server_error", ... }` with HTTP 500, plus a stack trace logged server-side. |

---

## 7. Local dev without Docker (optional)

```powershell
# Backend
cd backend
py -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL = "postgresql+asyncpg://roger:roger@localhost:5432/roger"
$env:ANTHROPIC_API_KEY = "<your key>"
uvicorn app.main:app --reload

# Frontend
cd ..\frontend
npm install
npm run dev
```

---

## 8. Notes & decisions

- The included `.env` is **gitignored** but contains the real Anthropic
  key for local one-shot demos. The placeholder `sk-ant-REPLACE-ME`
  lives only in `.env.example`, which is committed. The real key
  appears in zero tracked files.
- Seed encounters intentionally have **blank summaries** so the
  demo can show the "Generate Summary" flow live without spending
  tokens at seed time.
- Patient 1 (James "Jim" Wright) and Patient 2 (Bettye Wellons) names
  and DOBs were extracted verbatim from the `<patient_demographics>`
  blocks of the supplied histories.
- Schema creation uses `Base.metadata.create_all` at startup for demo
  simplicity. In production this would be replaced with Alembic
  migrations.
