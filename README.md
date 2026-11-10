# Radio & Scanner Checkout

A tablet-first web app for tracking a warehouse's **two-way radios and handheld scanners**:
**operator checks one out → uses it for the shift → returns it to the charger**. A device kept
out past the end of its shift is flagged overdue, and every action is recorded in an audit
log. Day-to-day the app runs in **kiosk mode on a shared iPad**; the fleet board and admin
panel are for supervisors and admins.

Adapted from the production knife checkout dashboard (`hankalf/production-knife-dashboard`).

## Lifecycle

```
AVAILABLE ──checkout(operator)──▶ CHECKED_OUT ──return checklist──▶ condition GOOD ──▶ AVAILABLE
                                                       │
                                                       └──▶ condition DAMAGED ──▶ DAMAGED
                                                                                    │
                                    supervisor/admin returns to service ◀───────────┘
```

Checking a device in runs a short **return checklist** (bilingual, English + Spanish):

1. **Placed on the charger?** — must be **Yes** to submit.
2. **Condition** — Good or Damaged.
3. If **Damaged**, describe what's wrong — and optionally **attach a photo** (captured on the
   tablet, downscaled on-device).

A **Good** device goes straight back to Available. A **Damaged** device is held in a
**DAMAGED** state with the reason and photo until a **supervisor or admin** returns it to
service from the fleet board.

- **Overdue** is derived (a checked-out device past its due time), shown in red with a banner.
- **Out of service** — supervisors/admins can retire lost or broken devices and restore them.

### Device types & labels

The seed creates **20 radios (R001–R020)** and **20 scanners (S001–S020)**. Tiles are **filled by
type** — blue for radios, amber for scanners — and **ringed by status**: green available,
white checked out, red overdue, magenta damaged, dimmed out of service. A checked-out tile
also shows **who has it** (first name + last initial) and **when it's due back**.

Add, relabel, or remove devices in **Admin**. Typing a bare number when adding a device gives
it the type's letter (`21` → `R021` or `S021`). The seed only runs into an empty fleet, so
devices you remove or relabel are never re-created on the next deploy.

### Due times (end of shift)

Every checkout is due at the **next shift end**. Shift end times are set in
**Admin → Advanced → Shift end times** (24-hour clock, default `07:00, 15:00, 23:00`). A
device checked out **within an hour** of a shift end is due at the following one, so the
incoming shift isn't marked overdue the moment they pick up a radio.

> Due times use the **server's local time** — set the `TZ` environment variable (e.g.
> `TZ=America/New_York`) so shift ends match the warehouse. The active timezone and current
> server time are shown in **Admin → Advanced → System**. `render.yaml` sets `TZ` for Render;
> on Railway add it as a variable.

## Roles (identified by PIN)

| Role | Can do |
|------|--------|
| Operator | Check out an available device and check in **their own** device (kiosk) |
| **Supervisor** | Everything an operator does, plus: check in a device someone else left out, return **damaged** devices to service, view the fleet board and reports, manage devices (add/edit/remove/retire/restore), set shift times, kiosk logo, and kiosk lock |
| Admin | **Everything** — all of the above plus **manage employees & PINs** (add/edit/bulk-upload/remove) and **configure Teams alerts** |

## Access

- **`/kiosk`** — open to everyone, no sign-in. Employees tap a device and confirm each action
  with their PIN. This is the everyday floor surface.
- The **fleet board (`/`)**, reports, device history, and the **admin panel (`/admin`)** are
  restricted to **supervisors and admins**. Visiting them shows a full-screen PIN sign-in; an
  operator is told the area is kiosk-only and pointed back to the kiosk.

## Screens

- **`/kiosk`** — full-screen, **bilingual** board for the shared iPad (auto-refreshes):
  radios on the top rows, scanners below. Check out and check in right on the kiosk. An
  optional **company logo** shows in the top-left corner (upload it in Admin → Advanced).
- **`/`** — live color-coded fleet board; tap a device to act on it. Supervisors return
  **damaged** devices to service and retire/restore devices here.
- **`/reports`** — end-of-shift sweep of everything still checked out, plus fleet metrics:
  total checkouts, average time out, damage reports, and most-used devices.
- **`/admin`** — manage devices and workers (including **CSV bulk upload**), shift end
  times, kiosk logo, **Teams alerts**, and export the full audit log to CSV.
- **`/device/<label>`** — a single device's complete history.

## Embedding in monday.com (or another dashboard)

The app can run inside a frame on another site, such as a command ops board on monday.com.

- **Who may frame it:** `next.config.mjs` sends `Content-Security-Policy: frame-ancestors`
  allowing this app plus `https://monday.com`, `https://*.monday.com`, and
  `https://*.monday.app`. To allow other sites, set **`EMBED_ORIGINS`** (space- or
  comma-separated, replaces the default list) and redeploy — the header is fixed at build time.
- **Sign-in inside the frame:** the session cookies are `SameSite=None; Secure; Partitioned`,
  so the PIN sign-in for the fleet board, reports, and admin works inside the frame in
  Chrome, Edge, and the monday desktop app, even with third-party cookies blocked.
- **The kiosk needs no cookies** — every kiosk action is confirmed by PIN — so `/kiosk`
  embeds in any browser. Safari (including iPad) blocks cookies in cross-site frames, so for
  the fleet board/admin on Safari, open the app in its own tab.

## Tech stack

- **Next.js (App Router, TypeScript)** — single deployable full-stack app
- **PostgreSQL + Prisma** — managed database with versioned migrations
- **Tailwind CSS** — touch-friendly, tablet-first UI

## Getting started (local dev)

```bash
docker run -d --name device-db \
  -e POSTGRES_USER=device -e POSTGRES_PASSWORD=device -e POSTGRES_DB=devicedb \
  -p 5432:5432 postgres:16       # or use your own Postgres + set DATABASE_URL in .env
npm install
npm run db:migrate               # apply migrations (creates the tables)
npm run db:seed                  # seed R001–R020, S001–S020 + starter workers
npm run dev                      # http://localhost:3000
```

### Default PINs (change these in Admin)

| Role | PIN |
|------|-----|
| Admin | `0000` |
| Operator | `1111` |
| Supervisor | `2222` |

### Useful scripts

- `npm run db:migrate:dev` — create a new migration after editing the schema
- `npm run db:reset` — drop, re-migrate, and re-seed the database
- `npm run db:backup` — gzip a `pg_dump` of the database to `./backups/`
- `npm run test:e2e` — run the Playwright end-to-end suite
- `node docs/capture_sop_shots.mjs` — refresh the SOP screenshots (app must be running;
  set `PW_BASE_URL`, and `TZ` on the server so times look right)
- `python3 docs/build_sop.py` — regenerate the SOP PDF (`docs/Radio-Scanner-Checkout-SOP.pdf`)
- `python3 docs/build_sop_es.py` — regenerate the Spanish SOP (`docs/Radio-Scanner-Checkout-SOP-ES.pdf`)
- `npx prisma studio` — inspect the database (devices, events, workers)

## Deploy on Render (Blueprint)

The repo includes a `render.yaml` Blueprint that provisions the web service **and** a
PostgreSQL database together.

1. In [Render](https://render.com): **New → Blueprint**, connect this repo, pick `main`, and
   **Apply**. Render creates the `radio-scanner-checkout` web service plus the `device-db`
   Postgres, wiring `DATABASE_URL` automatically.
2. On first deploy the app applies migrations and seeds the fleet, then serves. Sign in with
   the default PINs and change them.

## Deploy on Railway

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** →
   `radio-scanner-checkout`.
2. **New → Database → Add PostgreSQL**.
3. App service → **Variables** → add **`DATABASE_URL`** = `${{Postgres.DATABASE_URL}}` and
   **`TZ`** = your warehouse's timezone (e.g. `America/New_York`).
4. Railway builds with `npm run build`, then runs `npm run start:prod` (migrate → seed →
   serve). Open **Settings → Networking → Generate Domain** for your URL.

## Audit log

Every transition writes an immutable `DeviceEvent` (device, action, from/to status, worker,
timestamp, note — the return checklist answers are stored in the note). View a single
device's history at `/device/<label>`, or export the full log to CSV from Admin
(`/api/export`).

## Bulk-add workers (CSV)

Under **Admin → Add a worker** you can upload a CSV with columns `name,pin,roles`; `roles`
accepts `OPERATOR`, `SUPERVISOR`, `ADMIN`, separated by `;`, `|`, or spaces. Rows with a
duplicate or invalid PIN are skipped and reported.

## Teams notifications

Admins can paste a Teams webhook URL (Workflows or legacy Incoming Webhook) in
**Admin → Advanced** and choose alerts: **damaged returns** (live), **checkouts** and
**check-ins** (live, off by default), and the **overdue sweep** (needs a scheduled job).
**Send test message** confirms the connection.

## Testing

Playwright end-to-end tests cover kiosk access and bilingual copy, the supervisor/admin
gate, the kiosk checkout → return round trip, the charger requirement, the holder-only
return rule, the damaged → supervisor-return path, end-of-shift due times, supervisor
permissions, and adding a device.

```bash
npm run build
npm run test:e2e                                   # Playwright starts the server itself
PW_BASE_URL=http://localhost:3000 npm run test:e2e # or against a running dev server
```

CI runs them on every push/PR via `.github/workflows/e2e.yml`.

## Database backups

```bash
npm run db:backup            # writes ./backups/device-backup-<timestamp>.sql.gz
BACKUP_DIR=/mnt/nas npm run db:backup
```

## Ideas reserved for later

- Barcode scanning — the schema already has a `scanCode` field per device.
- A scheduled job to drive the Teams **overdue sweep** on a timer.
