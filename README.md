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
- [ ] `GET /api/terms` — list available terms
- [ ] `GET /api/courses?subject=&number=&title=&instructor=&ge=&term=` — search
- [ ] `GET /api/courses/:id` — course + all sections
- [ ] `GET /api/sections/:id/grades` — grade distribution (stretch, see §6)
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
- [ ] Frontend: Vercel/Netlify
- [ ] Backend + DB: Railway/Render/Fly.io
- [ ] Scraper: scheduled job (GitHub Actions cron or same host)
- [ ] Domain + basic SEO (title/meta)

## Suggested build order
1. Mock data + core search UI + schedule builder (fully working on fake data) ← **current status**
2. Real backend + DB + API wired to mock data
3. Scraper replacing mock data with real CSUF sections
4. Polish (conflict detection edge cases, saved schedules, unit counts)
5. Stretch: map, grades, auth

## Repo layout

```
apps/
  web/            React + TypeScript + Vite frontend
  api/            Node + Express + TypeScript backend (stub, not yet wired)
packages/
  scraper/        Data pipeline + shared course/section schema (stub)
```

## Getting started

```bash
npm install
npm run dev --workspace apps/web   # frontend dev server (mock data)
```

### Running with Docker

Spins up the web frontend and API together, with source mounted for hot reload:

```bash
docker compose up
```

- Web: http://localhost:5173
- API: http://localhost:3001/api/health

`docker compose down` stops it. Rebuild after dependency changes with `docker compose build`.
