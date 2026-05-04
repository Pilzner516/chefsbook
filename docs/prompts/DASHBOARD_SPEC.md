# DASHBOARD_SPEC.md
# LuxLabs System Monitor Dashboard — `/ralph` Mission Spec

## Mission

Build and deploy a self-contained web-based system monitoring dashboard for `luxlabs-pc`
that runs as a PM2 service and is accessible from any device on LAN or Tailscale.

Ralph must persist until every acceptance criterion below is satisfied and verified
against the live server. No partial completion.

---

## Context

- **Server**: `luxlabs-pc` — Ubuntu Server 24.04, no desktop environment, AMD Ryzen 5 3600
- **SSH**: `luxlabs@luxlabs-pc` (or Tailscale IP)
- **Install path**: `/opt/luxlabs/dashboard/`
- **PM2 user**: `luxlabs`
- **Dashboard port**: `9000`
- **App it monitors**: ChefsBook — PM2 procs `chefsbook-web` / `chefsbook-staging`, Supabase on port 8000, Postgres on 5432
- **Database**: Postgres at `localhost:5432`, user `supabase_admin`, db `postgres`
  - `DATABASE_URL` must be passed as PM2 env var — read from `/opt/luxlabs/chefsbook/repo/.env.local`
  - Extract with: `grep POSTGRES_PASSWORD /opt/luxlabs/chefsbook/repo/.env.local`
  - Then construct: `postgresql://supabase_admin:<pw>@localhost:5432/postgres`
- **LuxLabs directory pattern**: `/opt/luxlabs/<project>/` — dashboard is `/opt/luxlabs/dashboard/`

---

## Stack

- **Backend**: Node.js (no framework bloat — plain `http` or minimal Express), single `server.js`
- **Frontend**: Single `public/index.html` — no build step, no bundler, vanilla JS + CSS
- **DB client**: `pg` npm package for Postgres queries
- **Process manager**: PM2 (already installed globally)
- **Dependencies**: `express`, `cors`, `pg` only

---

## File Structure

```
/opt/luxlabs/dashboard/
├── server.js          ← Express backend, all API routes
├── package.json
├── public/
│   └── index.html     ← Complete dashboard UI
└── setup.sh           ← Idempotent install/update script
```

---

## Backend API Routes

All routes return JSON. All shell commands use `child_process.exec` with 5s timeout.
Postgres queries use a `pg.Pool` with max 3 connections.

### GET /api/system
Shell sources:
- CPU %: parse `/proc/stat` (idle/total ratio)
- RAM: parse `/proc/meminfo` (MemTotal, MemAvailable)
- Load: parse `/proc/loadavg`
- Uptime: `uptime -p`
- Hostname: `hostname`
- Top 5 procs by CPU: `ps aux --sort=-%cpu`

Response shape:
```json
{
  "cpu": 12.4,
  "ram": { "used": 2048, "total": 16384, "pct": 12.5 },
  "load": { "1m": 0.5, "5m": 0.4, "15m": 0.3 },
  "uptime": "2 days, 4 hours",
  "hostname": "luxlabs-pc",
  "processes": [{ "user": "luxlabs", "cpu": 2.1, "cmd": "node" }]
}
```

### GET /api/network
Shell sources:
- LAN IP: `ip -4 addr show` (first non-loopback)
- Tailscale: `tailscale status --json`
- Ping 1.1.1.1 and 8.8.8.8: `ping -c 1 -W 2`
- chefsbk.app response time: `curl -o /dev/null -s -w "%{time_total}" --max-time 5 https://chefsbk.app`
- Bandwidth totals: `/proc/net/dev` (look for eth0 / ens* / enp*)
- SSH sessions: `ss -tnp | grep ':22' | grep ESTAB | wc -l`

### GET /api/chefsbook
Shell sources:
- PM2 processes: `pm2 jlist`
- Port checks (3000, 3001, 8000, 5432): `ss -tlnp | grep :<port>`
- Docker containers: `docker ps --format '{{.Names}}|{{.Status}}|{{.Image}}'`

### GET /api/infrastructure
Shell sources:
- Disk: `df -h /`
- CPU temp: `/sys/class/thermal/thermal_zone0/temp` (divide by 1000) or `sensors`
- Systemd service status for: `docker`, `tailscaled`, `cron`, `cloudflared`, PM2

### GET /api/supabase
Postgres queries (skip gracefully if `DATABASE_URL` not set):
- DB size: `SELECT pg_size_pretty(pg_database_size('postgres'))`
- Connection states: `SELECT state, count(*) FROM pg_stat_activity GROUP BY state`
- Active queries: `SELECT pid, now()-query_start AS duration, query, state FROM pg_stat_activity WHERE state='active' AND query NOT ILIKE '%pg_stat_activity%'`
- Table stats: `SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(...)) FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY n_live_tup DESC LIMIT 8`

### GET /api/live
Postgres queries (skip gracefully if `DATABASE_URL` not set):
- Online users (last 5 min): `SELECT count(*) FROM public.user_profiles WHERE last_seen_at > now() - interval '5 minutes'`
- Total users: `SELECT count(*) FROM auth.users`
- Active sessions: `SELECT count(*) FROM auth.sessions WHERE not_after > now()`
- Realtime conns: `SELECT count(*) FROM pg_stat_activity WHERE application_name ILIKE '%realtime%' OR application_name ILIKE '%postgrest%'`
- AI activity feed (last 12): `SELECT action, model, cost_usd, created_at FROM public.ai_usage_log ORDER BY created_at DESC LIMIT 12`
- Daily stats: recipes created today, AI calls (24h), AI calls (1h), AI cost (24h)

### GET /api/alerts
Derives alerts from thresholds:
- CPU > 85% → critical, > 65% → warning
- RAM > 90% → critical, > 75% → warning
- Disk > 90% → critical, > 75% → warning
- Temp > 80°C → critical, > 65°C → warning
- Tailscale down → critical
- Docker service inactive → critical
- No alerts → `{ level: "ok", msg: "All systems nominal" }`

### GET /api/activity
- Recent logins: `last -n 6 | head -6`
- PM2 log tail: `pm2 logs --nostream --lines 8`

---

## Frontend UI

Single `public/index.html` — no external JS frameworks, no build step.

### Design Language
- Dark industrial control room aesthetic
- Background: `#080b0f`, panels: `#0d1117`, borders: `#1a2332`
- Accent colors: green `#00ff88`, amber `#ffb830`, red `#ff3b5c`, blue `#4da6ff`, purple `#b06fff`, cyan `#00d4ff`
- Typography: `Share Tech Mono` (Google Fonts) for values/data, `Rajdhani` for labels
- Scanline overlay via CSS `repeating-linear-gradient`
- Animated pulse dots for service status

### Layout
3×3 CSS grid filling `100vh`. Each cell is a panel.

| Col 1 | Col 2 | Col 3 |
|-------|-------|-------|
| System Vitals | ChefsBook Health | Live Connections |
| Network | Supabase | Infrastructure |
| Activity Feed | Alerts | System Log |

### Header (above grid)
- Left: `LUXLABS // <hostname>` logo
- Center: `LAN <ip>` · `TS <tailscale-ip>` · `PING <ms>` · `SSH <count>` · `UP <uptime>` · `●ALIVE` heartbeat ring
- Right: live HH:MM:SS clock

### Panel: System Vitals
- CPU% bar (green → amber → red based on thresholds)
- RAM used/total bar
- Load average 1m / 5m / 15m (three large numbers)
- Top 5 processes table: name + CPU%

### Panel: ChefsBook Health
- PM2 process list: dot indicator, name, status, memory, restart count
- Port grid (2×2): 3000 (Web), 3001 (Staging), 8000 (Supabase), 5432 (Postgres) — green/red chip
- Docker container count

### Panel: Live Connections
- 4 KPI cards (large numbers): Online Now (green), Auth Sessions (blue), Total Users (purple), Realtime Conns (cyan)
- Today stats: Recipes Added, AI Calls (24h), AI Calls (1h), AI Cost (24h)

### Panel: Network
- KV rows: Tailscale IP, TS Peers, 1.1.1.1 ping, 8.8.8.8 ping, chefsbk.app response, SSH sessions
- Bandwidth RX / TX (session totals from /proc/net/dev)

### Panel: Supabase
- DB size, connection count
- Visual dot grid: one dot per connection, green = active, grey = idle
- Active queries (if any): duration + truncated query text
- Table list: name, row count, size, mini bar chart

If `DATABASE_URL` not configured: show setup instructions instead of data.

### Panel: Infrastructure
- Disk usage bar
- CPU temperature with color coding
- Service status list: Docker, Tailscale, Cron, Cloudflared, PM2 — animated pulse dot

### Panel: Activity Feed
- Scrolling list of recent AI events from `ai_usage_log`
- Each row: time ago · action type (color coded) · model (shortened) · cost
- Heartbeat ring animation in panel title — this is the "server is alive" indicator

### Panel: Alerts
- Alert badges: OK (green), WARNING (amber), CRITICAL (red)
- Derived from threshold checks across all panels

### Panel: System Log
- Recent SSH logins (from `last`)
- PM2 log tail (last 5 lines)

---

## Burn-in Prevention & Screensaver

### Pixel Drift (always active while dashboard visible)
Every 2 minutes, shift the entire `<header>` + `<main>` by 1–2px in a slow 8-position random walk:
```
[0,0] → [1,2] → [2,1] → [2,-1] → [1,-2] → [-1,-2] → [-2,-1] → [-2,1] → [-1,2] → repeat
```
Applied via CSS `transform: translate(Xpx, Ypx)` with 8s transition.

### Panel Spotlight Rotation (always active)
Every 45 seconds, apply a `.spotlight` class to one panel (slightly lighter background `#111820`), cycling through all 9 panels in order. Prevents any single panel from being at static brightness.

### Screensaver (after 3 minutes idle)
Idle = no mousemove, keydown, touchstart, wheel events.

On idle timeout:
- Fade in a full-screen black overlay (`#000`) over 2 seconds
- Display a large floating clock (`clamp(48px, 10vw, 100px)`) in dim green `rgba(0,255,136,0.2)`
- Clock drifts around screen via CSS animation on a 23-second path (prevents clock burn-in)
- Below clock: date in uppercase, dim; live CPU/RAM/Tailscale stats pulled from existing DOM
- "move mouse to wake" hint fades in/out at bottom

On any input event:
- Fade out overlay in 0.4 seconds
- Resume normal dashboard

---

## Refresh Intervals

| Endpoint | Interval |
|----------|----------|
| /api/system | 5s |
| /api/network | 10s |
| /api/chefsbook | 8s |
| /api/live | 8s |
| /api/supabase | 15s |
| /api/infrastructure | 15s |
| /api/alerts | 20s |
| /api/activity | 30s |

Intervals are staggered to avoid thundering herd. All fetches use `Promise.allSettled` on initial load.

---

## Display Setup (separate script)

`display-setup.sh` — configures OS-level monitor power management.

Two modes:

**`--kiosk` (default)**
- Installs: `xorg`, `chromium-browser`, `unclutter`, `x11-xserver-utils`
- Creates `/usr/local/bin/luxlabs-kiosk.sh`: starts X, configures DPMS via `xset`, launches Chromium in `--kiosk` mode pointing at `http://localhost:9000`
- DPMS settings: standby 180s, off 300s
- Creates `/etc/systemd/system/luxlabs-kiosk.service` — auto-starts on boot after `luxlabs-dashboard` PM2 service
- Hides cursor after 3s inactivity via `unclutter`

**`--tty-only`**
- No X11 installation
- Configures framebuffer blanking via `setterm`
- Creates systemd service to apply blanking settings on boot

---

## Setup Script (`setup.sh`)

Must be idempotent — safe to re-run for updates.

Steps:
1. `sudo mkdir -p /opt/luxlabs/dashboard && sudo chown luxlabs:luxlabs /opt/luxlabs/dashboard`
2. Copy files to install dir
3. `npm install --omit=dev`
4. Auto-detect DATABASE_URL:
   - Try `grep DATABASE_URL /opt/luxlabs/chefsbook/repo/.env.local`
   - Try constructing from `grep POSTGRES_PASSWORD /opt/luxlabs/chefsbook/repo/.env.local`
   - If not found, prompt user (or skip — Supabase panels show setup instructions)
5. `pm2 delete luxlabs-dashboard || true`
6. Start with PM2: `DATABASE_URL=<url> pm2 start server.js --name luxlabs-dashboard --cwd /opt/luxlabs/dashboard`
7. `pm2 save`
8. Print access URLs: localhost:9000, LAN IP:9000, Tailscale IP:9000

---

## Acceptance Criteria

Ralph must verify ALL of the following before marking the mission complete:

### Backend
- [ ] `node server.js` starts without errors
- [ ] `GET /api/system` returns valid JSON with cpu, ram, load, processes
- [ ] `GET /api/network` returns valid JSON with lan, tailscale, ping
- [ ] `GET /api/chefsbook` returns valid JSON with pm2, ports, containers
- [ ] `GET /api/infrastructure` returns valid JSON with disk, tempC, services
- [ ] `GET /api/alerts` returns valid JSON with alerts array
- [ ] `GET /api/activity` returns valid JSON with logs, logins
- [ ] `GET /api/supabase` returns `{ configured: false }` when DATABASE_URL not set (no crash)
- [ ] `GET /api/live` returns `{ configured: false }` when DATABASE_URL not set (no crash)
- [ ] All routes handle shell command failures gracefully (no 500s on command not found)
- [ ] Server listens on `0.0.0.0:9000`

### Frontend
- [ ] `index.html` loads without JS errors in browser console
- [ ] All 9 panels render with correct titles and color accents
- [ ] Header shows hostname, clock ticks every second
- [ ] Gauge bars animate on data load
- [ ] Service status dots pulse correctly (green = active)
- [ ] Supabase panel shows setup message when DATABASE_URL missing (not blank/error)
- [ ] Live Connections panel shows `?` values when DATABASE_URL missing (not blank/error)

### Screensaver
- [ ] After 3 minutes of no input, black overlay fades in
- [ ] Floating clock is visible and ticking
- [ ] Mouse movement dismisses screensaver within 0.5s
- [ ] Panel spotlight cycles every 45s while awake

### Deploy
- [ ] `setup.sh` runs to completion without errors
- [ ] PM2 shows `luxlabs-dashboard` with status `online` after setup
- [ ] `pm2 save` persists across reboots
- [ ] Dashboard accessible at `http://localhost:9000`

### Display setup
- [ ] `display-setup.sh --tty-only` completes and enables systemd service
- [ ] `display-setup.sh --kiosk` completes (if X11 packages available)

---

## What Ralph Must NOT Do

- Do not install Postgres, Docker, Supabase, or any ChefsBook services
- Do not touch `/opt/luxlabs/chefsbook/` or its contents
- Do not modify `CLAUDE.md`, `DONE.md`, or any ChefsBook source files
- Do not run `npm install` in the ChefsBook repo
- Do not add entries to DONE.md (this is an infrastructure tool, not a ChefsBook feature)
- Do not use React, Vue, or any frontend framework — vanilla JS only
- Do not add more than 3 npm dependencies (express, cors, pg)

---

## Deliverable

A tarball `luxlabs-dashboard.tar.gz` in the working directory containing:
```
luxlabs-dashboard/
├── server.js
├── package.json
├── public/
│   └── index.html
├── setup.sh
└── display-setup.sh
```

Plus a `DEPLOY.md` with the exact copy-paste commands to deploy from dev machine to `luxlabs-pc`.
