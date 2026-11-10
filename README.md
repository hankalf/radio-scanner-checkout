# Safety Knife Checkout System

A tablet-first web app for tracking pre-numbered food-production safety knives through
their full lifecycle: **operator checkout → sanitation cleaning & inspection → back in
service**. A knife kept out past its due date is flagged overdue. Every action is recorded
for food-safety auditing. Day-to-day the app runs in **kiosk mode on a shared iPad**; the
management board and admin panel are for admins, QA, and managers.

## Lifecycle

```
AVAILABLE ──checkout(operator)──▶ CHECKED_OUT ──return(operator)──▶ DIRTY
   ▲                                                                   │
   │                                    sanitation cleans + inspects   │
   │                                                                    ▼
   └───── condition GOOD ◀──────────────── 4-question checklist ──────▶ DAMAGED
                                                                         │
                       manager/admin returns to service ◀─────────────┘
```

Before a used knife goes back in service, **sanitation answers a 4-question checklist**
(all prompts bilingual, English + Spanish):

1. **Cleaned?** Yes / No
2. **Inspected?** Yes / No
3. **Condition** — Good or Damaged
4. If **Damaged**, describe why — and optionally **attach a photo** (captured on the tablet,
   downscaled on-device)

A **Good** knife (cleaned **and** inspected) returns straight to service. A **Damaged** knife
moves to a **DAMAGED** state with the reported reason and photo, and **only a manager or admin**
can return it to service from the board — **QA, a manager, or an admin** (where they see the reason and photo).

- **Overdue** is derived (a checked-out knife past its due date), shown in red with a banner.
- **Out of service** — admins/QA can retire damaged/lost knives and restore them later.

### Knife type & due dates

Each knife is **Food Contact (FC)** or **Non-Food Contact (NFC)**. In this fleet,
**#1–#14 are FC** and **#51–#78 are NFC** (the seed enforces this). The type drives the
**due date** at checkout:

- **FC** — checked out and returned the **same day**, due by end of shift (end of today).
- **NFC** — signed out for the week (Mon–Fri), **due end of Friday**.

On **both** the kiosk and the management board a tile is **filled by type** — silver/metal
for FC, blue for NFC, with the type spelled out — and **ringed by status**: green available, yellow
checked out, orange awaiting sanitation, red damaged, red + "OVERDUE" when past due. A
checked-out tile also shows **who has it** (first name + last initial) and **when it's due
back**. Set the type when adding a knife, or change it later from the knife's action modal
(admin/QA). New knives default to FC.

> Due dates use the **server's local time** — set the `TZ` environment variable (e.g.
> `TZ=America/New_York` for Eastern) so "end of day/Friday" matches the plant's timezone. The active
> timezone and current server time are shown in **Admin → Advanced → System** so you can
> confirm it at a glance. `render.yaml` sets `TZ` for Render; on Railway add it as a variable.

## Roles (identified by PIN)

| Role | Can do |
|------|--------|
| Operator | Check out an available knife; return **their own** checked-out knife after use (kiosk only) |
| Sanitation | Clean & inspect used (dirty) knives via the checklist, returning good ones to service |
| QA | Fleet board, reports, and admin panel: manages **knives** and the kiosk logo, and can return **damaged** knives to service — but **not** employees or Teams settings |
| **Manager** | Floor supervisor: does every **operator, sanitation, and QA** job, reviews **damaged** knives, and can **view** the knife fleet + audit log — but the admin panel is **read-only** (no Add a knife, Workers, or Advanced, and no editing knives) |
| Admin | **Everything** — all of the above plus **manage employees & PINs** (add/edit/bulk-upload/remove) and **configure Teams alerts** |

A worker can hold multiple roles. **Admins implicitly have every capability**, and a
**manager** implicitly holds the operator, sanitation, and QA capabilities. Only the
operator who checked a knife out (or an admin) can return it, so returns are attributed to the
right person.

## Access & the admin panel

The app is used **99% of the time in kiosk mode** by employees on a shared iPad, so the two
surfaces are gated very differently:

- **`/kiosk`** — open to everyone, no sign-in. Employees tap a knife and confirm each action
  with their PIN. This is the everyday floor surface.
- The **management board (`/`)**, reports, knife history, and the **admin panel (`/admin`)**
  are restricted to **admins, QA, and managers** (managers get a read-only admin panel).
  Visiting them shows a **full-screen PIN sign-in**; a worker without one of those roles is
  told the area is kiosk-only and pointed back to the kiosk.
- Once an admin, QA, or manager is signed in on the board, opening the **Admin** tab needs **no second
  PIN** — the existing session carries through.

## Screens

- **`/`** *(admin/QA)* — live color-coded fleet board; tap a knife to act on it. Sanitation/QA
  get a **batch mode** to clear many knives at once. A manager returns **damaged** knives to
  service here.
- **`/reports`** *(admin/QA)* — end-of-day sweep of everything still checked out, plus fleet
  metrics: average return→clean turnaround, total cleanings, and most-used knives.
- **`/kiosk`** — full-screen, **bilingual (English + Spanish)** floor surface for the shared
  iPad (auto-refreshes). Employees check out, check in, and clean+inspect knives right on the
  kiosk, confirming each action with their PIN. A checked-out knife's bubble shows **who has
  it out**. Cleaning runs the 4-question sanitation checklist. An optional **company logo**
  shows in the top-left corner.
- **`/admin`** *(admin/QA)* — add knives and **manage the whole fleet** (edit a knife's
  number/type, or remove a mis-added one), retire/restore, manage workers (including
  **CSV bulk upload**), upload a **company logo** for the kiosk, configure **Teams alerts**
  (see below), export the full audit log to CSV, and toggle **light/dark mode** from the
  header. The light/dark choice applies across the management surfaces (board, reports,
  admin, knife history); the kiosk keeps its own high-contrast dark display.
- **`/knife/<number>`** *(admin/QA)* — a single knife's complete lifecycle history.

## Tech stack

- **Next.js (App Router, TypeScript)** — single deployable full-stack app
- **PostgreSQL + Prisma** — managed database with versioned migrations
- **Tailwind CSS** — touch-friendly, tablet-first UI

> **Deployment targets:** `main` is set up for **Railway** and **Render** (see below), which
> build the app with their native Node builders. The full **Docker Desktop** setup
> (Dockerfile + Compose) lives on the **`claude/docker-desktop`** branch, so it doesn't
> interfere with those hosts.

## Getting started (local dev)

You need a PostgreSQL database. Start a throwaway one with Docker (or use any Postgres and
put its URL in `.env`), then run the app:

```bash
docker run -d --name knife-db \
  -e POSTGRES_USER=knife -e POSTGRES_PASSWORD=knife -e POSTGRES_DB=knifedb \
  -p 5432:5432 postgres:16       # or use your own Postgres + set DATABASE_URL in .env
npm install
npm run db:migrate               # apply migrations (creates the tables)
npm run db:seed                  # seed 42 knives (1–14, 51–64, 65–78) + starter workers
npm run dev                      # http://localhost:3000
```

To run the whole app in containers instead, use the **`claude/docker-desktop`** branch
(`docker compose up --build`).

### Default PINs (change these in Admin)

| Role | PIN |
|------|-----|
| Admin (all roles) | `0000` |
| Operator | `1111` |
| Sanitation | `2222` |
| QA | `3333` |

### Useful scripts

- `npm run db:migrate:dev` — create a new migration after editing the schema
- `npm run db:reset` — drop, re-migrate, and re-seed the database
- `npm run db:backup` — gzip a `pg_dump` of the database to `./backups/`
- `npm run test:e2e` — run the Playwright end-to-end suite
- `node docs/capture_sop_shots.mjs` — refresh the SOP screenshots (app must be running;
  set `PW_BASE_URL`, and `TZ` on the server so times look right)
- `python3 docs/build_sop.py` — regenerate the SOP PDF (`docs/Safety-Knife-Checkout-SOP.pdf`)
- `python3 docs/build_sop_es.py` — regenerate the Spanish SOP (`docs/Safety-Knife-Checkout-SOP-ES.pdf`)
- `npm run build && npm start` — production build/run
- `npx prisma studio` — inspect the database (knives, events, workers)

## Deploy on Render (Blueprint)

The repo includes a `render.yaml` Blueprint that provisions the web service **and** a
PostgreSQL database together.

1. In [Render](https://render.com): **New → Blueprint**, connect this repo, pick `main`, and
   **Apply**. Render reads `render.yaml` and creates the `safety-knife-checkout` web service
   plus the `knife-db` Postgres, wiring `DATABASE_URL` automatically.
2. On first deploy the app applies migrations and seeds the fleet, then serves. Open the URL
   Render gives you and sign in with the default PINs below.

The Blueprint uses Render's entry paid plans (`starter` web + `basic-256mb` Postgres) so the
service stays awake and the database is persistent; adjust the `plan:` values to size up/down.

## Deploy on Railway

Railway gives you a public URL you can open on any device (including a floor tablet), and
this repo is set up so it deploys with almost no configuration. `start:prod` applies
database migrations and seeds the fleet on every boot.

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
   and pick `production-knife-dashboard` (choose the branch you want to deploy).
2. In the same project, click **New → Database → Add PostgreSQL**. Railway provisions it and
   exposes its connection string as a `DATABASE_URL` variable.
3. Open your app service → **Variables** → add a reference variable
   **`DATABASE_URL`** = `${{Postgres.DATABASE_URL}}` (Railway autocompletes this once the
   Postgres service exists), so the app points at the database.
4. Railway builds with `npm run build`, then runs `npm run start:prod` (migrate → seed →
   serve). When it's green, open **Settings → Networking → Generate Domain** for your URL.
5. Sign in with the default PINs — **Admin `0000`, Operator `1111`, Sanitation `2222`,
   QA `3333`** — and change them in Admin.

Data lives in the Postgres service and persists across redeploys. The seed is idempotent,
so redeploys never duplicate knives or workers.

## Audit log

Every transition writes an immutable `KnifeEvent` (knife, action, from/to status, worker,
timestamp, note). View a single knife's history at `/knife/<number>`, or export the full
log to CSV from the Admin screen (`/api/export`).

## Bulk-add workers (CSV)

Under **Admin → Add a worker** you can **upload a CSV** to add many workers at once, and
**download a sample CSV** to fill in. Columns are `name,pin,roles` (one worker per row); the
`roles` column accepts multiple roles separated by `;`, `|`, or spaces (e.g.
`SANITATION;QA`). Rows with a duplicate or invalid PIN are skipped and reported, so a partial
file still imports cleanly.

## Teams notifications

The Admin screen has a **Microsoft Teams notifications** panel. Paste an **Incoming Webhook
URL** for a Teams channel, enable it, and choose what to be notified about:

- **Damaged knives** — fires **live** the moment sanitation flags a knife damaged (no
  scheduler needed).
- **Overdue sweep** — the end-of-day list of knives still checked out. This one needs a
  scheduled job to call the sweep on a timer; the preference and message are in place.

Settings are saved to the `Setting` store (`teams.*` keys), and a **Send test message**
button posts to the channel so you can confirm the webhook before relying on it.

## Testing

End-to-end tests (Playwright) cover the critical flows: kiosk access/bilingual copy, the
admin/QA gate on the board, the full kiosk lifecycle (checkout → holder shown → check-in →
sanitation "Good" → available), and the damaged → manager-return path.

```bash
# Against a server Playwright starts itself (production build):
npm run build
npm run test:e2e

# Against an already-running dev server:
PW_BASE_URL=http://localhost:3000 npm run test:e2e
```

The tests run against a real PostgreSQL database and assert on persisted state. CI runs them
on every push/PR via `.github/workflows/e2e.yml` (spins up Postgres, migrates, seeds, builds,
and runs the suite).

## Database backups

The audit log is the compliance backbone, so back the database up regularly.

```bash
npm run db:backup            # writes ./backups/knife-backup-<timestamp>.sql.gz
BACKUP_DIR=/mnt/nas npm run db:backup
```

`scripts/backup.sh` runs `pg_dump` against `DATABASE_URL` (loading it from `.env` if needed),
gzips the dump, and keeps the newest 30 (override with `BACKUP_KEEP`). To run it on a
schedule, add a cron entry on the host, a **Railway cron service**, or a **Render cron job**
that runs `npm run db:backup` and ships the file to durable storage. Railway and Render also
provide their own managed Postgres backups — this script is for portable, off-host copies.

## Ideas reserved for later

- QR/barcode scanning — the schema already has a `scanCode` field per knife.
- A scheduled job to drive the Teams **overdue sweep** on a timer.
