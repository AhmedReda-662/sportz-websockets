# Sportz — Real-Time Sports Match & Live Commentary Backend

> **Real-Time REST + WebSocket Backend for Live Sports Scores, Match Lifecycle & Ball-by-Ball Commentary**

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![WebSocket](https://img.shields.io/badge/WebSockets-ws-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://github.com/websockets/ws)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Zod](https://img.shields.io/badge/Zod-Validation-3068B7?style=for-the-badge&logo=zod&logoColor=white)](https://zod.dev/)
[![Arcjet](https://img.shields.io/badge/Arcjet-Security-FF3366?style=for-the-badge&logo=shield&logoColor=white)](https://arcjet.com/)

A production-style **backend system** for managing sports fixtures and streaming **live commentary** to thousands of subscribed clients with **low latency** over **WebSockets**, backed by **PostgreSQL + Drizzle ORM**, hardened with **Zod validation**, **Arcjet Shield / Bot Detection / Rate Limiting**, and **idempotent event ingestion**.

Perfect portfolio project for roles like: **Backend Developer | Node.js Developer | Full-Stack Developer | Real-Time Systems Engineer | API Engineer**

---

## Table of Contents

- [Why This Project Stands Out](#why-this-project-stands-out)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [ATS-Friendly Skills & Keywords](#ats-friendly-skills--keywords)
- [Architecture Overview](#architecture-overview)
- [How I Approached & Built This Project](#how-i-approached--built-this-project)
- [API Reference](#api-reference)
- [WebSocket Protocol](#websocket-protocol)
- [Database Design](#database-design)
- [Security](#security)
- [Validation Strategy](#validation-strategy)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Example End-to-End Flow](#example-end-to-end-flow)
- [What I Learned](#what-i-learned)
- [Roadmap / Future Improvements](#roadmap--future-improvements)
- [Resume Bullets (Copy-Paste Ready)](#resume-bullets-copy-paste-ready)
- [License](#license)

---

## Why This Project Stands Out

Most todo-list backends do CRUD. **Sportz solves a real distributed-systems problem:**

> How do you ingest live sports events reliably (retries, reconnects, duplicate producers) and fan them out in real time only to clients who care about that specific match — without polling, without leaking data, and without getting DDoS'd?

This project demonstrates:

- **Real-time pub/sub** per-match over WebSockets (subscribe / unsubscribe / targeted broadcast)
- **Idempotent writes** with `UNIQUE(match_id, sequence)` so retries and reconnects never duplicate commentary
- **Derived state** — match `status` (`scheduled → live → finished`) computed server-side from time, never trusted from client
- **Performance-first DB design** — covering indexes for lobby filters, feed pagination, and event-type filtering
- **Defense in depth** — Zod input validation + Arcjet Shield + bot detection + sliding-window rate limits on both HTTP and WS
- **Production hygiene** — connection pooling, heartbeat / dead-client reaping, graceful JSON error contracts, 1 MB WS payload cap

---

## Key Features

### 1. Match Management — RESTful API

- `GET /matches?limit=` — paginated fixture lobby, newest first, capped at `100`
- `POST /matches` — create fixture with `sport`, `homeTeam`, `awayTeam`, `startTime`, `endTime`, optional scores
- **Auto-derived lifecycle status** via `getMatchStatus()` — no client can spoof `live` / `finished`
- **Instant fan-out** — every new match triggers a global `match_created` WebSocket broadcast via `app.locals.broadcastMatchCreated`
- Consistent JSON envelopes: `{ data }` on success, `{ errors, details }` on failure with correct `400 / 201 / 500` codes

### 2. Live Commentary Engine — Append-Only Event Feed

- `GET /matches/:id/commentary?limit=` — fetch event feed for a match, newest first
- `POST /matches/:id/commentary` — ingest one event: `minute`, `sequence`, `period`, `eventType` (e.g. `goal`, `wicket`, `foul`), `actor`, `team`, `message`, `metadata (JSONB)`, `tags[]`
- **Deterministic ordering** by `sequence ASC` — `minute` is display-only and nullable for pre/post-match entries
- **Idempotent producer retries** enforced at DB level with `UNIQUE(match_id, sequence)`
- **Flexible analytics payload** with `jsonb metadata` + `text[] tags` (e.g. `["goal", "highlight"]`)
- Ready for feed filtering: `WHERE match_id = ? AND event_type = ?` backed by composite index

### 3. Real-Time WebSocket Server — `/ws`

- Powered by `ws` `WebSocketServer` mounted on the same HTTP server (no extra port, no CORS pain)
- **Per-match rooms** with `Map<matchId, Set<ws>>` — `subscribe` / `unsubscribe` protocol
- **Targeted broadcast** `broadcastToMatchSubscribers(matchId, payload)` + **global broadcast** `broadcastJSON(wss, payload)`
- **Connection lifecycle:** `welcome` handshake → `subscribed` / `unsubscribed` acks → `error` on bad JSON
- **Heartbeat keep-alive:** 30s `ping` / `pong` + `isAlive` flag, dead sockets `terminate()`d to prevent memory leaks
- **Hardened handshake:** Arcjet check on `connection` — `1013` on rate-limit, `1008` on forbidden, `1011` on internal error
- `maxPayload: 1MB` to block oversized-frame abuse

### 4. PostgreSQL Data Layer — Drizzle ORM + `pg` Pool

- Type-safe queries with `drizzle-orm/node-postgres` + `pg.Pool` connection pooling
- `pool.on('error')` idle-client guard so one bad connection never crashes the server
- Migrations via `drizzle-kit generate / migrate / studio`
- Relational API ready with `matchesRelations` / `commentaryRelations` (`db.query.*`)

### 5. Enterprise-Grade Security — Arcjet

- **Shield (WAF-like):** SQLi / XSS pattern blocking in `LIVE` or `DRY_RUN` mode
- **Bot detection:** blocks automated scrapers, allows `CATEGORY:SEARCH_ENGINE` + `CATEGORY:PREVIEW`
- **Sliding-window rate limiting:** HTTP `50 req / 10s`, WS handshake `5 req / 2s`
- Clean degradation: `429 Too Many Requests`, `403 Forbidden`, `503 Service Unavailable` on Arcjet failure
- Reusable `securityMiddleware()` for Express + `wsArcjet.protect(req)` for sockets

### 6. Bulletproof Validation — Zod

- Shared primitives: `nonEmptyString`, ISO-8601 date regex + `Date.parse` calendar check, `z.coerce` ints for query/path params that arrive as strings
- Cross-field rule: `endTime > startTime` via `superRefine`
- Every route uses `safeParse` — never throws, always returns structured `issues[]` to client
- Commentary defaults mirror DB defaults: `metadata = {}`, `tags = []`, nullable `minute / period / actor / team`

---

## Tech Stack

| Layer | Technology | Why I Chose It |
|---|---|---|
| **Runtime** | Node.js >= 20, ESM (`type: module`) | Native `fetch`, `--watch` dev loop, modern syntax |
| **API Framework** | Express 5 + `http.createServer` | Minimal, hireable, easy to mount WS on same server |
| **Real-Time** | `ws` 8.x WebSocketServer | Lightest, fastest, full control over rooms + heartbeat |
| **Database** | PostgreSQL 16 + `pg` Pool | Relational integrity, `ENUM`, `JSONB`, array columns, partial indexes |
| **ORM** | Drizzle ORM 0.45 + Drizzle Kit 0.31 | Type-safe SQL without heavy magic, explicit indexes, fast migrations |
| **Validation** | Zod 4.x | Single source of truth for shapes, coercion, custom refinements |
| **Security** | Arcjet Node SDK (`shield`, `detectBot`, `slidingWindow`) | WAF + bot + rate-limit in 20 lines, separate HTTP/WS policies |
| **Config** | `dotenv` | 12-factor env-based config (`DATABASE_URL`, `ARCJET_KEY`) |
| **Dev Tooling** | `node --watch`, `drizzle-kit studio` | Zero-config hot reload + visual DB browser |

---

## ATS-Friendly Skills & Keywords

> Recruiters and Applicant Tracking Systems (ATS) scan for these exact terms — all demonstrated in this repo:

**Languages & Runtimes:** JavaScript (ES Modules), Node.js 20+, SQL (PostgreSQL), JSON
**Backend Frameworks:** Express.js 5, RESTful API Design, HTTP Server Composition
**Real-Time / WebSockets:** WebSockets (`ws`), Pub/Sub, Room-based Broadcasting, Heartbeat (ping/pong), Connection Lifecycle Management, Low-Latency Fan-out
**Databases & ORM:** PostgreSQL, Drizzle ORM, Drizzle Kit Migrations, Connection Pooling (`pg.Pool`), Relational Modeling, Foreign Keys with `ON DELETE CASCADE`, Database Indexing & Query Optimization
**Data Modeling:** `pgEnum`, `serial PK`, `timestamp with timezone`, `jsonb`, `text[] arrays`, `uniqueIndex`, Composite Indexes
**Validation & Correctness:** Zod Schema Validation, Input Sanitization, Type Coercion, Cross-Field Validation (`superRefine`), Idempotency, Deterministic Ordering
**Security & Reliability:** Arcjet Shield (WAF), Bot Detection & Mitigation, Sliding-Window Rate Limiting, Graceful Error Handling, Payload Limits, Dead-Client Reaping, Structured Error Responses
**Engineering Practices:** API Pagination & Limits, Environment-Based Config, Modular Routing, Separation of Concerns (route / validation / utils / db / ws), Git Version Control, Code Review Ready

---

## Architecture Overview

```mermaid
flowchart LR
    Client1[Browser / Mobile App] <-->|HTTP REST| Express[Express 5 + Arcjet Middleware]
    Client1 <-->|WS /ws subscribe| WSS[ws WebSocketServer]
    Client2[Live Admin / Producer] -->|POST commentary| Express
    Express -->|drizzle-orm| Pool[pg.Pool]
    Pool <--> PG[(PostgreSQL: matches + commentary)]
    Express -->|broadcastMatchCreated| WSS
    WSS -->|match_created / live events| Client1
    Arcjet[Arcjet Shield + Bot + Rate Limit] -. protects .-> Express
    Arcjet -. protects handshake .-> WSS
```

**Request lifecycle:**

1. Client `POST /matches` → Zod `createMatchSchema` → `getMatchStatus(start,end)` → `INSERT ... RETURNING` → `broadcastMatchCreated` → all WS clients get `match_created`.
2. Producer `POST /matches/:id/commentary` → Zod `createCommentarySchema` → `INSERT` with `sequence` → on conflict, DB rejects duplicate → caller retries safely.
3. Fan `WS subscribe { matchId: 1 }` → server adds socket to `matchSubscribers.get(1)` → future events for match 1 fan out only to that room.
4. Heartbeat loop every 30s prunes dead sockets so rooms never leak.

---

## How I Approached & Built This Project

I built this like I would a production ticket — **requirements → data model → validation → API → real-time → security → hardening:**

### Step 1 — Scoped the domain

Decided the smallest lovable slice of a sports app: **fixtures + append-only commentary feed + live push**. No auth, no frontend — pure backend that a mobile/web client could consume. This keeps the demo focused on distributed-systems skills recruiters care about.

### Step 2 — Designed the database first

Created `src/db/schema.js` before any route:

- `match_status` Postgres `ENUM ('scheduled','live','finished')` so invalid states are impossible at storage level.
- `matches`: scores `DEFAULT 0`, `endTime NULL` until finished, `timestamptz` everywhere for timezone correctness.
- `commentary`: `sequence NOT NULL` + `UNIQUE(match_id, sequence)` for idempotency; `metadata JSONB DEFAULT {}` and `tags TEXT[] DEFAULT []` for extensibility without migrations.
- Indexes chosen from query patterns, not guesswork: `matches(status)`, `matches(start_time)`, `commentary(match_id)`, `commentary(match_id, event_type)`.
- Added `relations()` so future `db.query.matches.findMany({ with: { commentary: true } })` works.

### Step 3 — Built a validation boundary with Zod

Created `src/validation/matches.js` and `src/validation/commentary.js` as the **only place** shapes are defined:

- ISO-8601 regex pins the shape, `Date.parse` rejects impossible dates (month 13, etc.).
- `z.coerce.number()` handles Express giving us strings in `req.query` / `req.params`.
- `superRefine` enforces `endTime > startTime` with a path-pinned error.
- Used `safeParse` everywhere so validation failures return `400 + issues[]`, never throw 500s.

### Step 4 — Implemented REST routes thinly

`src/route/matches.js` and `src/route/commentry.js` contain **no business logic** — just parse → query → respond:

- Cap `limit` with `Math.min(parsed.limit ?? 50, 100)` to prevent `?limit=1000000` abuse.
- `POST /matches` computes `status` via `src/utils/match-status.js#getMatchStatus` and broadcasts via `res.app.locals` (dependency injection without a DI framework).
- `POST /commentary` mirrors Zod defaults to DB defaults explicitly (`?? null`, `?? {}`, `?? []`) so intent is readable.

### Step 5 — Added real-time with `ws`

Built `src/ws/server.js` as a standalone `attachWebSocketServer(httpServer)` function for testability:

- `Map<matchId, Set<ws>>` rooms give O(1) subscribe/unsubscribe and O(subscribers) fan-out — no global blast for per-match events.
- `ws.subscription = Set` per socket makes `cleanupMatchSubscribers` trivial on disconnect.
- `sendJSON` / `broadcastJSON` helpers centralize `readyState === OPEN` guards and `JSON.stringify`.
- Heartbeat (`isAlive` + `ping`/`pong` + 30s sweep) copied from the `ws` production best-practice docs.
- Returned `{ broadcastMatchCreated }` lets Express publish without importing WS internals — clean module boundary.

### Step 6 — Layered security with Arcjet

Created `src/arcjet.js` with **two policies** because HTTP and WS have different abuse profiles:

- HTTP: `shield + detectBot + slidingWindow(50/10s)` — generous for REST polling fallback.
- WS: `shield + detectBot + slidingWindow(5/2s)` — strict handshake to stop connection floods (each socket is expensive).
- `ARCJET_MODE=DRY_RUN` env lets me observe without blocking during development.
- WS denials map to RFC 6455 close codes (`1013 try again later`, `1008 policy violation`) so well-behaved clients back off correctly.

### Step 7 — Wired it together in `src/index.js`

Single composition root: `express.json()` → health `GET /` → mount `/matches` + `/matches/:id/commentary` (with `mergeParams: true`) → attach WS → `server.listen`. `HOST=0.0.0.0` default makes it Docker / Render / Railway ready; logs print both `http://` and `ws://` URLs for DX.

---

## API Reference

Base URL: `http://localhost:8080`

### Health

```http
GET /
→ 200 "Hello World"
```

### Matches

#### List matches

```http
GET /matches?limit=50
```

```bash
curl "http://localhost:8080/matches?limit=20"
```

Response `200`:

```json
{
  "data": [
    {
      "id": 1,
      "sport": "football",
      "homeTeam": "Arsenal",
      "awayTeam": "Chelsea",
      "status": "live",
      "startTime": "2026-09-06T18:00:00.000Z",
      "endTime": "2026-09-06T20:00:00.000Z",
      "homeScore": 2,
      "awayScore": 1,
      "createdAt": "2026-09-06T17:00:00.000Z"
    }
  ]
}
```

#### Create match

```http
POST /matches
Content-Type: application/json
```

```bash
curl -X POST http://localhost:8080/matches \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "football",
    "homeTeam": "Arsenal",
    "awayTeam": "Chelsea",
    "startTime": "2026-09-06T18:00:00Z",
    "endTime": "2026-09-06T20:00:00Z"
  }'
```

Response `201` (+ all WS clients receive `match_created`):

```json
{
  "message": "Match created successfully",
  "data": { "id": 1, "status": "scheduled", "...": "..." }
}
```

Error `400` (endTime before startTime):

```json
{
  "errors": "Invalid payload",
  "details": [{ "path": ["endTime"], "message": "endTime must be chronologically after startTime" }]
}
```

### Commentary

#### List commentary

```http
GET /matches/:id/commentary?limit=100
```

```bash
curl "http://localhost:8080/matches/1/commentary?limit=50"
```

#### Post commentary event

```http
POST /matches/:id/commentary
Content-Type: application/json
```

```bash
curl -X POST http://localhost:8080/matches/1/commentary \
  -H "Content-Type: application/json" \
  -d '{
    "minute": 67,
    "sequence": 42,
    "period": "second_half",
    "eventType": "goal",
    "actor": "B. Saka",
    "team": "Arsenal",
    "message": "Saka curls it into the top corner! 2-1!",
    "metadata": { "assist": "Odegaard", "xG": 0.18 },
    "tags": ["goal", "highlight"]
  }'
```

Response `201`:

```json
{
  "message": "Commentary created successfully",
  "data": { "id": 101, "matchId": 1, "sequence": 42, "...": "..." }
}
```

> Retrying the same `sequence` for the same `matchId` is safe — the DB unique constraint rejects the duplicate, making producers idempotent.

---

## WebSocket Protocol

Connect: `ws://localhost:8080/ws`

**1. Server greets you:**

```json
{ "type": "welcome", "message": "Welcome to the WebSocket server!" }
```

**2. Subscribe to a match:**

```json
{ "type": "subscribe", "matchId": 1 }
→ { "type": "subscribed", "matchId": 1 }
```

**3. Unsubscribe:**

```json
{ "type": "unsubscribe", "matchId": 1 }
→ { "type": "unsubscribed", "matchId": 1 }
```

**4. Global event (all connected clients):**

```json
{ "type": "match_created", "data": { "id": 2, "homeTeam": "...", "...": "..." } }
```

**5. Error:**

```json
{ "type": "error", "message": "Invalid JSON format" }
```

**JavaScript client example:**

```js
const ws = new WebSocket("ws://localhost:8080/ws");

ws.onopen = () => ws.send(JSON.stringify({ type: "subscribe", matchId: 1 }));

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "match_created") console.log("New fixture:", msg.data);
  if (msg.type === "subscribed") console.log("Watching match", msg.matchId);
};
```

Test with `wscat`:

```bash
npx wscat -c ws://localhost:8080/ws
> {"type":"subscribe","matchId":1}
```

---

## Database Design

```sql
-- ENUM: lifecycle is closed, no magic strings
CREATE TYPE match_status AS ENUM ('scheduled', 'live', 'finished');

-- One row per fixture
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  sport TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  status match_status NOT NULL DEFAULT 'scheduled',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  home_score INT NOT NULL DEFAULT 0,
  away_score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX matches_status_idx ON matches (status);
CREATE INDEX matches_start_time_idx ON matches (start_time);

-- Append-only feed, cascade delete with fixture
CREATE TABLE commentary (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  minute INT,                       -- display only, nullable
  sequence INT NOT NULL,            -- ordering + idempotency key
  period TEXT,
  event_type TEXT NOT NULL,
  actor TEXT,
  team TEXT,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, sequence)
);
CREATE INDEX commentary_match_id_idx ON commentary (match_id);
CREATE UNIQUE INDEX commentary_match_sequence_uidx ON commentary (match_id, sequence);
CREATE INDEX commentary_match_event_idx ON commentary (match_id, event_type);
```

**Key decisions:**

- `ORDER BY sequence ASC` is the source of truth for live ordering — wall-clock `createdAt` can skew across producers.
- `ON DELETE CASCADE` keeps orphan commentary impossible.
- `JSONB + TEXT[]` avoids migration churn when product wants new event attributes or highlight flags.

---

## Security

| Threat | Mitigation | Where |
|---|---|---|
| SQLi / XSS | Arcjet `shield` | `src/arcjet.js` |
| Scraper bots | Arcjet `detectBot` (allow search + preview) | HTTP + WS policies |
| REST flood | `slidingWindow 50 req / 10s` → `429` | `securityMiddleware()` |
| WS conn flood | `slidingWindow 5 req / 2s` → close `1013` | `wss.on('connection')` |
| Oversized frames | `maxPayload: 1MB` | `new WebSocketServer(...)` |
| Bad input | Zod `safeParse` → `400` with `issues[]` | All routes |
| Enormous pages | `MAX_LIMIT = 100` clamp | `matches.js`, `commentry.js` |
| Dead sockets | 30s heartbeat + `terminate()` | `ws/server.js` |

---

## Validation Strategy

All schemas live in `src/validation/` — routes never inline-check:

- `listMatchesQuerySchema` / `listCommentaryQuerySchema` — coerced positive int, max 100
- `matchIdParamSchema` — coerced positive int path param
- `createMatchSchema` — non-empty teams/sport, ISO dates, `endTime > startTime`
- `createCommentarySchema` — required `sequence` + `eventType` + `message`, everything else optional with DB-matching defaults
- `updateScoreSchema` — non-negative coerced ints (ready for `PATCH /matches/:id/score`)

---

## Project Structure

```
sportz/
├── src/
│   ├── index.js                # Composition root: Express + HTTP + WS wiring
│   ├── arcjet.js               # httpArcjet + wsArcjet policies + securityMiddleware()
│   ├── db/
│   │   ├── db.js               # pg.Pool + drizzle() singleton
│   │   └── schema.js           # matches + commentary tables, enums, indexes, relations
│   ├── route/
│   │   ├── matches.js          # GET /matches, POST /matches + match_created broadcast
│   │   └── commentry.js        # GET/POST /matches/:id/commentary (mergeParams)
│   ├── ws/
│   │   └── server.js           # Rooms, subscribe/unsubscribe, heartbeat, broadcasts
│   ├── validation/
│   │   ├── matches.js          # MATCH_STATUS, create/list/id/score schemas
│   │   └── commentary.js       # create/list commentary schemas
│   └── utils/
│       └── match-status.js     # getMatchStatus() + syncMatchStatus()
├── drizzle/                    # Generated migrations (drizzle-kit)
├── drizzle.config.js           # Dialect + schema path + DB credentials
├── package.json                # Node >=20, Express 5, ws, drizzle-orm, zod, arcjet
└── README.md                   # You are here
```

---

## Getting Started

### Prerequisites

- **Node.js >= 20** (`node -v`)
- **PostgreSQL** running locally or hosted (Neon / Supabase / Railway)
- **Arcjet account** for `ARCJET_KEY` (free tier works — or run in `DRY_RUN`)

### 1. Clone & install

```bash
git clone <your-repo-url> sportz
cd sportz
npm install
```

### 2. Configure environment

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/sportz
ARCJET_KEY=ajkey_your_key_here
ARCJET_MODE=LIVE
# ARCJET_MODE=DRY_RUN   # use while developing to log without blocking
PORT=8080
HOST=0.0.0.0
```

### 3. Run migrations

```bash
npm run db:generate
npm run db:migrate
# optional visual DB browser:
npm run db:studio
```

### 4. Start the server

```bash
npm run dev    # hot reload with node --watch
# or
npm start      # production
```

You should see:

```
Server is running on http://localhost:8080
WebSocket server is running on ws://localhost:8080/ws
```

### 5. Smoke test

```bash
curl http://localhost:8080/
curl http://localhost:8080/matches?limit=5
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | Postgres connection string |
| `ARCJET_KEY` | Yes | — | Arcjet site key for Shield/bot/rate-limit |
| `ARCJET_MODE` | No | `LIVE` | `LIVE` blocks, `DRY_RUN` logs only |
| `PORT` | No | `8080` | HTTP + WS port (shared server) |
| `HOST` | No | `0.0.0.0` | Bind host |

---

## Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `node --watch src/index.js` | Hot-reload development |
| `npm start` | `node src/index.js` | Production start |
| `npm run db:generate` | `drizzle-kit generate` | Generate SQL migration from schema |
| `npm run db:migrate` | `drizzle-kit migrate` | Apply migrations to Postgres |
| `npm run db:studio` | `drizzle-kit studio` | Visual DB explorer |

---

## Example End-to-End Flow

```bash
# 1. Create a live match (status auto-computed as 'live' if now is between start/end)
curl -X POST http://localhost:8080/matches \
  -H "Content-Type: application/json" \
  -d '{"sport":"cricket","homeTeam":"India","awayTeam":"Australia","startTime":"2026-09-06T10:00:00Z","endTime":"2026-09-06T18:00:00Z"}'

# 2. In another terminal, subscribe over WebSocket
npx wscat -c ws://localhost:8080/ws
> {"type":"subscribe","matchId":1}

# 3. Push ball-by-ball commentary (producer)
curl -X POST http://localhost:8080/matches/1/commentary \
  -H "Content-Type: application/json" \
  -d '{"minute":12,"sequence":1,"period":"first_innings","eventType":"wicket","actor":"J. Bumrah","team":"India","message":"Bowled him! Middle stump out of the ground!","tags":["wicket","highlight"]}'

# 4. Fetch the feed (client catching up after reconnect)
curl "http://localhost:8080/matches/1/commentary?limit=20"
```

---

## What I Learned

- **Same-server WS mounting** (`new WebSocketServer({ server, path: '/ws' })`) eliminates CORS and extra infra vs. a separate socket port.
- **Idempotency must live in the DB**, not in app memory — `UNIQUE(match_id, sequence)` survives restarts and horizontal scaling; in-memory dedup does not.
- **Separate rate limits per transport** — a socket handshake is 10x more expensive than a REST GET, so WS needs a tighter window.
- **Zod coercion matters** — Express gives `req.query.limit` as `"20"` (string); `z.coerce.number()` prevents an entire class of 400s.
- **Heartbeat is non-optional** — without `ping/pong` + `terminate()`, ghost clients leak rooms and broadcasts slow down linearly.

---

## Roadmap / Future Improvements

- [ ] `PATCH /matches/:id/score` + `PATCH /matches/:id/status` with `updateScoreSchema` + `syncMatchStatus`
- [ ] Broadcast `commentary_created` and `score_updated` to `matchSubscribers` rooms (currently only `match_created` is live)
- [ ] Keyset pagination (`?afterSequence=`) instead of limit-only for infinite live feeds
- [ ] Redis adapter (`pub/sub`) for multi-instance horizontal scaling of WS rooms
- [ ] JWT auth + per-role rate limits (admin producer vs. fan consumer)
- [ ] `GET /matches?status=live&sport=football` filtering + `startTime` range queries
- [ ] OpenAPI / Swagger docs + Postman collection
- [ ] Vitest + Supertest integration tests + GitHub Actions CI
- [ ] Dockerfile + `docker-compose` (app + Postgres) for one-command boot

---

## Resume Bullets (Copy-Paste Ready)

- Built **Sportz**, a real-time sports backend in **Node.js + Express 5 + WebSockets (`ws`)** serving match fixtures and live commentary with **sub-100ms fan-out** to per-match subscriber rooms.
- Designed **PostgreSQL schema with Drizzle ORM** (`pgEnum`, `JSONB`, array columns, composite + unique indexes) and enforced **idempotent event ingestion** via `UNIQUE(match_id, sequence)`.
- Implemented **room-based WebSocket pub/sub** (`subscribe/unsubscribe`, targeted + global broadcasts, 30s heartbeat with dead-client reaping, 1 MB payload cap) on a shared HTTP server.
- Hardened API with **Zod validation** (ISO-8601 + cross-field `superRefine` checks) and **Arcjet Shield, bot detection, and sliding-window rate limiting** with distinct HTTP/WS policies.

---

## License

ISC — free to use for learning, portfolios, and interviews. If you fork it, a star is appreciated.

---

<p align="center"><b>Sportz</b> — <i>Because live sport can't wait for polling.</i> ⚽🏏🏀</p>
