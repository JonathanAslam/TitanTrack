# TitanTrack — CSUF Course Search & Schedule Planner

A course search + weekly schedule builder for Cal State Fullerton.

## 0. Project setup

- [x] Init monorepo: `apps/web` (frontend), `apps/api` (backend), `packages/scraper` (data pipeline)
- [x] Choose stack: React + TypeScript + Vite (frontend), Node/Express or Fastify (API),
      Postgres for storage (courses, sections, meetings, terms)
- [x] Set up repo tooling: ESLint/Prettier, TS config, env vars, README

## 1. Data pipeline (the hard part — no public CSUF API)

CSUF has no open course-data API like UCI's WebSOC. Data must come from CSUF's
public Class Search (PeopleSoft/Campus Solutions, accessed via MyView / Titan Online
"Class Schedule Search" widget — see https://www.fullerton.edu, Quick Links > Class Search).

- [ ] Investigate the public class search page's network requests (open devtools,
      inspect XHR/fetch calls when searching) — PeopleSoft search pages sometimes expose
      an internal JSON/XML endpoint even without a documented public API
- [ ] If no usable internal endpoint exists, build a scraper (Playwright/Puppeteer) that:
  - [ ] Selects a term
  - [ ] Iterates all subjects (e.g. loop the subject dropdown)
  - [ ] Paginates/search results per subject
  - [ ] Parses: course code, title, section, instructor, days/times, location,
        units, seats/capacity, status (open/closed/waitlist), GE category if shown
- [ ] Normalize scraped data into a consistent schema (see `packages/scraper/schema.ts`)
- [ ] Store snapshots per term in Postgres; add a refresh job (cron) to re-scrape
      periodically during shopping/registration windows
- [ ] Respect robots.txt / rate-limit requests; add caching so we don't hammer CSUF servers
- [x] For now: hand-write a `mock-data.json` (a handful of departments/courses) so
      frontend dev isn't blocked on the scraper

## 2. Backend API

- [x] `GET /api/terms` — list available terms
- [x] `GET /api/courses` — list all courses + sections; supports `?term=`, `?subject=`, `?courseNumber=`,
      `?title=`, `?instructor=`, `?ge=` query-param filtering
- [x] `GET /api/courses/:id` — course + all sections
- [x] `GET /api/sections/:id/grades` — route exists, returns `{ available: false }` until a grade-distribution data source is chosen (stretch, see §6)
- [ ] Basic caching layer (courses don't change every second)

## 3. Frontend — core course search

- [x] Search bar + filters: subject, course number, title, instructor, GE category, open-only
- [x] Results list: course code/title, sections table (time, days, instructor, room, seats)
- [x] "Add to schedule" action per section

## 4. Frontend — weekly schedule builder

- [x] Weekly calendar grid (Mon–Fri/Sat) rendering added sections as blocks
- [x] Time-conflict detection (highlight overlapping sections)
- [x] Running unit count
- [x] Multiple saved schedule "tabs"/variations, switchable
- [x] Local persistence (localStorage) so a refresh doesn't lose the schedule
- [ ] Export schedule (image/PDF or .ics calendar file) — stretch

## 5. Campus map (stretch, phase 2)

- [ ] Source a CSUF campus map (building list + coordinates — check fullerton.edu maps page)
- [ ] Interactive map showing pins for each scheduled class's building
- [ ] Walking-distance/time estimate between back-to-back classes

## 6. Grade distributions & enrollment history (stretch, phase 2)

- [ ] Identify a data source — CSUF doesn't publish this like UCI's Zotistics;
      check if CSUF Institutional Research / public records has anything usable
- [ ] If no source exists, scope this down or drop it for v1

## 7. Auth & accounts (stretch, phase 3)

- [ ] Optional sign-in to save schedules across devices
- [ ] Import/export saved schedule as shareable link

## 8. Deployment

- [x] Frontend: Vercel
- [x] Backend: Render
- [x] DB (+ future auth): Supabase
- [ ] Scraper: scheduled job (GitHub Actions cron or same host)
- [ ] Domain + basic SEO (title/meta)

## 9. Deployment architecture

Current stack (v0, chosen to get something live cheaply while staying easy to scale later):

| Piece              | Deployed to                      | Notes                                                                                                                                                                                                                                                                                                                   |
| ------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`         | **Vercel**                       | Static Vite build. Free tier, global CDN. Build-time env var `VITE_API_BASE_URL` must point at the Render API's public URL.                                                                                                                                                                                             |
| `apps/api`         | **Render** (Web Service, Docker) | Built from `apps/api/Dockerfile`'s `prod` stage via the root `render.yaml` blueprint. Stateful long-running Express process (in-memory course cache, periodic data-sync interval) — this is why it's on Render and not a serverless platform like Vercel functions.                                                     |
| Postgres           | **Supabase**                     | Free tier doesn't expire like Render's; also brings Google-sign-in-capable Auth + RLS for whenever accounts/saved schedules (README §7) get built. Connected via `DATABASE_URL` set manually as a Render env var (its connection-pooling string, not the direct one — see step-by-step below).                          |
| `packages/scraper` | _not yet deployed_               | Currently run manually/locally (`npm run scrape --workspace packages/scraper`). Its output (`scraped-data.json`) is gitignored, so until it's automated, real data gets into Supabase by running the API's sync locally against Supabase's `DATABASE_URL`. See §1/§8 todo above for automating this as a scheduled job. |

**Why this split:** `apps/api` keeps state in process (an in-memory TTL cache, a `setInterval` poll loop), so it needs a long-running server rather than a serverless function — that's Render. `apps/web` is a static build with no server-side state, so it belongs on a CDN-first host — that's Vercel, and it's effectively free at this scale. Postgres lives on Supabase rather than Render so the free-tier DB doesn't expire, and to get Auth/RLS for free when accounts are built.

**Scaling later, cheaply:** Render's autoscaling/load-balancing (paid plans) works without any code changes — the API already reads `PORT`/`DATABASE_URL` from env and is stateless per request, so adding instances behind Render's load balancer is a plan upgrade, not a rewrite. The one caveat is the in-memory courses cache: each instance caches independently, so at higher scale that's the first thing to move to a shared cache (e.g. Redis) rather than in-process memory.

**One-click redeploy:** the root `render.yaml` is a Render Blueprint for the API service — importing this repo into Render provisions it with the right env vars pre-filled, prompting only for `DATABASE_URL` (since the DB itself lives on Supabase, outside Render).

## Suggested build order

1. Mock data + core search UI + schedule builder (fully working on fake data)
2. Real backend + DB + API wired to mock data ← **current status**
3. Scraper replacing mock data with real CSUF sections
4. Polish (conflict detection edge cases, saved schedules, unit counts)
5. Stretch: map, grades, auth

## Repo layout

```
apps/
  web/            React + TypeScript + Vite frontend
  api/            Node + Express + TypeScript backend, backed by Postgres
packages/
  scraper/        Data pipeline + shared course/section schema (stub)
```

## Getting started

```bash
npm install
npm run dev --workspace apps/web   # frontend dev server (mock data)
```

Running `apps/api` outside Docker requires a reachable Postgres and a
`DATABASE_URL` env var (see `docker-compose.yml` for the expected format).
The API creates its tables and seeds them from `packages/scraper/src/mock-data.json`
automatically on first run.

### Running with Docker

Spins up the web frontend, API, and a Postgres database together, with source
mounted for hot reload:

```bash
docker compose up
```

- Web: http://localhost:5173
- API: http://localhost:3001/api/health
- Postgres: localhost:5433 (mapped from the container's 5432 to avoid clashing with a local Postgres)

`docker compose down` stops it (add `-v` to also drop the Postgres volume).
Rebuild after dependency changes with `docker compose build`.
