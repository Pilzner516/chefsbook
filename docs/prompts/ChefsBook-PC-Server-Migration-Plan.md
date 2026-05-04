# ChefsBook — PC Server Migration Plan
## AMD Ryzen 5 3600 replacing Raspberry Pi 5

**Prepared:** April 30, 2026  
**Goal:** Replace `rpi5-eth` (100.110.47.62) with `luxlabs-pc` as the ChefsBook production server  
**Approach:** Parallel setup → data migration → cutover → Pi continues running other projects  
**Estimated total time:** 3–4 hours hands-on across two evenings

---

## Naming Conventions

| Thing | Name | Notes |
|-------|------|-------|
| Machine hostname | `luxlabs-pc` | The physical PC — may run multiple projects |
| SSH user | `luxlabs` | Machine-level user, not project-specific |
| ChefsBook working dir | `/opt/luxlabs/chefsbook/` | Project-scoped under the luxlabs namespace |
| ChefsBook PM2 processes | `chefsbook-web`, `chefsbook-staging` | Project-scoped |
| Future projects | `/opt/luxlabs/<projectname>/` | Same pattern for any new project |
| Supabase ports | ChefsBook: 8000 | Next project uses 8001, etc. |

---

## What's Running on the Pi Today

From `CLAUDE.md` — everything that needs to move:

| Service | Current location | Port |
|---------|-----------------|------|
| Supabase (Kong gateway) | rpi5-eth | 8000 |
| PostgreSQL | rpi5-eth | 5432 |
| Supabase Studio | rpi5-eth | 3000 (internal) |
| Next.js web app (production) | rpi5-eth | 3000 (via PM2) |
| Next.js web app (staging) | rpi5-eth | 3001 |
| Cloudflare Tunnel | rpi5-eth | → chefsbk.app |
| Storage (54GB USB drive) | /mnt/chefsbook/ | — |

**Note:** The Pi continues running its other projects. Only ChefsBook services move to `luxlabs-pc`.

---

## Phase 1: Prepare the PC (Evening 1, ~90 minutes)

### Step 1 — Install Ubuntu Server 24.04 LTS

Download Ubuntu Server 24.04 LTS from ubuntu.com and flash to a USB stick using Balena Etcher.

Boot from USB and install. During setup:
- Hostname: `luxlabs-pc`
- Username: `luxlabs`
- Enable OpenSSH during install
- No desktop environment — server only
- Partition: use the full 2TB for the OS and data

After install, confirm SSH works from your dev machine:
```bash
ssh luxlabs@luxlabs-pc.local
```

---

### Step 2 — Assign a Static Local IP

On your router, assign a static DHCP lease to the PC's MAC address. Choose something clean like `192.168.1.100`. Write it down — you'll need it throughout.

Confirm it's working:
```bash
ssh luxlabs@192.168.1.100
```

---

### Step 3 — Install Core Dependencies

SSH into the PC and run:

```bash
# Update
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # should show v22.x
npm --version

# Install global tools
sudo npm install -g pm2 turbo

# Install Docker
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add luxlabs user to docker group (no sudo needed for docker commands)
sudo usermod -aG docker luxlabs
newgrp docker

# Verify Docker
docker --version
docker compose version  # v2 syntax — no hyphen

# Install git and postgresql-client (for pg_dump/restore)
sudo apt install -y git postgresql-client
```

---

### Step 4 — Install Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

A URL will appear — open it in your browser and authenticate. Once connected, `luxlabs-pc` gets a Tailscale IP. Note this IP — it replaces `100.110.47.62` everywhere in ChefsBook config.

Confirm from your dev machine:
```bash
ping luxlabs-pc  # should resolve via Tailscale
```

---

### Step 5 — Create the LuxLabs Directory Structure

```bash
# Top-level namespace for all LuxLabs projects
sudo mkdir -p /opt/luxlabs/chefsbook
sudo chown -R luxlabs:luxlabs /opt/luxlabs
cd /opt/luxlabs/chefsbook

# Clone the ChefsBook repo
git clone <your-repo-url> repo
cd repo

# Install dependencies
npm install
```

The directory structure going forward:
```
/opt/luxlabs/
├── chefsbook/
│   ├── repo/          ← ChefsBook monorepo
│   ├── supabase/      ← Supabase docker-compose + config
│   ├── data/          ← Storage (recipe images, cookbook files)
│   ├── backups/       ← Automated pg_dump files
│   ├── deploy-staging.sh
│   └── deploy-production.sh
└── <future-project>/  ← Next project goes here
    ├── repo/
    ├── supabase/      ← Different ports (8001, 5433, etc.)
    └── data/
```

---

### Step 6 — Set Up Supabase

Copy the Supabase config from the Pi:

```bash
# From your dev machine
scp -r rasp@rpi5-eth:/mnt/chefsbook/supabase/ \
    luxlabs@192.168.1.100:/opt/luxlabs/chefsbook/
```

On the PC, start Supabase:

```bash
ssh luxlabs@luxlabs-pc
cd /opt/luxlabs/chefsbook/supabase
docker compose up -d

# Verify all containers are running
docker compose ps
```

All containers should show "Up". Check Supabase Studio is accessible:
```
http://192.168.1.100:8000
```

**At this point the PC Supabase has an empty database. The Pi is still live and serving production. Do not switch anything over yet.**

---

### Step 7 — Copy Environment Variables

```bash
# From your dev machine, copy .env.local from Pi to PC
scp rasp@rpi5-eth:/mnt/chefsbook/repo/.env.local \
    luxlabs@192.168.1.100:/opt/luxlabs/chefsbook/repo/

# Copy deploy scripts
scp rasp@rpi5-eth:/mnt/chefsbook/deploy-staging.sh \
    luxlabs@192.168.1.100:/opt/luxlabs/chefsbook/
scp rasp@rpi5-eth:/mnt/chefsbook/deploy-production.sh \
    luxlabs@192.168.1.100:/opt/luxlabs/chefsbook/
```

Edit `.env.local` on the PC and verify these key lines are correct:

```bash
nano /opt/luxlabs/chefsbook/repo/.env.local
```

```bash
# Web public URL — unchanged, Cloudflare handles routing
NEXT_PUBLIC_SUPABASE_URL=https://api.chefsbk.app

# Server-to-server internal — stays localhost
SUPABASE_URL=http://localhost:8000
```

Everything else copies over from the Pi unchanged.

---

### Step 8 — Install Cloudflare Tunnel

```bash
# Install cloudflared on luxlabs-pc
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
    -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Copy tunnel credentials from Pi (from your dev machine)
scp -r rasp@rpi5-eth:/home/rasp/.cloudflared/ \
    luxlabs@192.168.1.100:/home/luxlabs/

# Verify config points to localhost (correct for the PC)
cat /home/luxlabs/.cloudflared/config.yml
```

The config.yml ingress rules (`localhost:3000` for web, `localhost:8000` for API) are correct as-is. No changes needed.

**Do not start the tunnel yet.** The Pi tunnel is still live.

---

## Phase 2: Data Migration (Evening 1 continued, ~45 minutes)

The Pi stays live and serves production throughout this entire phase.

### Step 9 — Export PostgreSQL from Pi

```bash
ssh rasp@rpi5-eth

pg_dump postgresql://supabase_admin:<your-pg-password>@localhost:5432/postgres \
  --no-owner \
  --no-acl \
  -Fc \
  -f /tmp/chefsbook_$(date +%Y%m%d_%H%M).dump

# Verify the file exists and has a reasonable size
ls -lh /tmp/chefsbook_*.dump
```

---

### Step 10 — Transfer Database Dump to PC

```bash
# From your dev machine
scp rasp@rpi5-eth:/tmp/chefsbook_*.dump \
    luxlabs@192.168.1.100:/tmp/
```

---

### Step 11 — Restore Database on PC

```bash
ssh luxlabs@luxlabs-pc

pg_restore \
  -d postgresql://supabase_admin:<your-pg-password>@localhost:5432/postgres \
  --no-owner \
  --no-acl \
  /tmp/chefsbook_*.dump

# Verify row counts match the Pi
psql postgresql://supabase_admin:<pw>@localhost:5432/postgres \
  -c "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 20;"
```

Cross-check the top table counts against the Pi — they should match.

---

### Step 12 — Migrate Storage (54GB)

```bash
# Sync all recipe images and cookbook files from Pi to PC
# Run from your dev machine
rsync -avz --progress \
  rasp@rpi5-eth:/mnt/chefsbook/data/ \
  luxlabs@192.168.1.100:/opt/luxlabs/chefsbook/data/

# Verify sizes match
ssh rasp@rpi5-eth "du -sh /mnt/chefsbook/data/"
ssh luxlabs@luxlabs-pc "du -sh /opt/luxlabs/chefsbook/data/"
```

Update the Supabase docker-compose on the PC to point storage at the new path:

```bash
ssh luxlabs@luxlabs-pc
nano /opt/luxlabs/chefsbook/supabase/docker-compose.yml

# Find the storage volume mount and update:
# FROM: - /mnt/chefsbook/data:/var/lib/storage
# TO:   - /opt/luxlabs/chefsbook/data:/var/lib/storage

docker compose -f /opt/luxlabs/chefsbook/supabase/docker-compose.yml down
docker compose -f /opt/luxlabs/chefsbook/supabase/docker-compose.yml up -d
```

---

### Step 13 — Smoke Test the PC Stack

Verify everything works on the PC while the Pi is still live:

```bash
ssh luxlabs@luxlabs-pc

# Build the web app
# Note: 4096MB is fine on 32GB — no Pi memory constraints here
cd /opt/luxlabs/chefsbook/repo
NODE_OPTIONS=--max-old-space-size=4096 npx next build --no-lint

# Start with PM2 using ChefsBook-scoped process names
pm2 start ecosystem.config.js
pm2 status
# Should show: chefsbook-web (online), chefsbook-staging (online)

# Test local response
curl http://localhost:3000    # → HTML
curl http://localhost:8000/rest/v1/ -H "apikey: <anon-key>"  # → JSON
```

Open Supabase Studio on the PC (`http://192.168.1.100:8000`) and spot-check:
- Recipe count matches Pi
- A few recipe images load correctly
- Auth users table has the right number of users

---

## Phase 3: Cutover (Evening 2, ~30 minutes)

Plan for a 15-minute maintenance window. Best time: midnight or early morning.

### Step 14 — Final Sync (immediately before cutover)

```bash
# Final pg_dump on Pi — catches any data created since Step 9
ssh rasp@rpi5-eth "pg_dump postgresql://supabase_admin:<pw>@localhost:5432/postgres \
  --no-owner --no-acl -Fc -f /tmp/chefsbook_final.dump"

scp rasp@rpi5-eth:/tmp/chefsbook_final.dump \
    luxlabs@192.168.1.100:/tmp/

# Final storage rsync — catches any new uploads since Step 12
rsync -avz --progress \
  rasp@rpi5-eth:/mnt/chefsbook/data/ \
  luxlabs@192.168.1.100:/opt/luxlabs/chefsbook/data/

# Restore final dump on PC
ssh luxlabs@luxlabs-pc
pg_restore \
  -d postgresql://supabase_admin:<pw>@localhost:5432/postgres \
  --no-owner --no-acl --clean --if-exists \
  /tmp/chefsbook_final.dump
```

---

### Step 15 — Cutover Sequence (in order, don't deviate)

```
1. [ ] Put site into maintenance mode
        → Update Cloudflare to return a maintenance page temporarily

2. [ ] Stop ChefsBook PM2 processes on Pi (other Pi projects unaffected)
        ssh rasp@rpi5-eth "pm2 stop chefsbook-web chefsbook-staging"

3. [ ] Stop ChefsBook Cloudflare Tunnel on Pi
        ssh rasp@rpi5-eth "sudo systemctl stop cloudflared"
        NOTE: Only stops the ChefsBook tunnel — other Pi services unaffected

4. [ ] Start Cloudflare Tunnel on luxlabs-pc
        ssh luxlabs@luxlabs-pc
        sudo cloudflared service install
        sudo systemctl start cloudflared

5. [ ] Verify tunnel is routing to luxlabs-pc
        curl -I https://chefsbk.app
        → Should return 200

6. [ ] Lift maintenance mode
        → Revert Cloudflare maintenance page

7. [ ] Run smoke tests (Step 16 below)

8. [ ] Configure PM2 to auto-start on luxlabs-pc reboot
        ssh luxlabs@luxlabs-pc "pm2 startup && pm2 save"

9. [ ] Configure cloudflared to auto-start on luxlabs-pc reboot
        ssh luxlabs@luxlabs-pc "sudo systemctl enable cloudflared"
```

---

### Step 16 — Post-Cutover Smoke Tests

```bash
# Web app
curl -I https://chefsbk.app                      # → 200
curl -I https://chefsbk.app/login                # → 200

# API
curl https://api.chefsbk.app/rest/v1/ \
  -H "apikey: <anon-key>"                         # → JSON

# Storage (use a real image path from your DB)
curl -I "https://api.chefsbk.app/storage/v1/object/public/recipe-images/<real-path>"
# → 200 with image content-type
```

Manually verify in browser:
- [ ] Can log in
- [ ] Recipe images load
- [ ] Can create/edit a recipe
- [ ] PDF export works
- [ ] Staging (`http://192.168.1.100:3001`) still works

**Rollback if anything looks wrong:** Stop luxlabs-pc tunnel → restart Pi tunnel → restart ChefsBook PM2 on Pi. Back to normal in under 2 minutes.

---

## Phase 4: Update All References (Evening 2 continued, ~45 minutes)

### Step 17 — Update CLAUDE.md

Replace every Pi reference that pertains to ChefsBook:

| Old | New |
|-----|-----|
| `rpi5-eth` | `luxlabs-pc` |
| `100.110.47.62` | `<luxlabs-pc Tailscale IP>` |
| `rasp@rpi5-eth` | `luxlabs@luxlabs-pc` |
| `/mnt/chefsbook/` | `/opt/luxlabs/chefsbook/` |

Updated infrastructure section for CLAUDE.md:
```markdown
## Infrastructure

- **Supabase**: Self-hosted on luxlabs-pc at http://<tailscale-ip>:8000
- **Supabase Studio**: http://<tailscale-ip>:8000 (login: supabase)
- **Postgres**: port 5432 on luxlabs-pc (internal only)
- **Next.js web**: PM2 on luxlabs-pc, served via Cloudflare Tunnel → chefsbk.app
- **Storage**: /opt/luxlabs/chefsbook/data/
- **SSH**: luxlabs@luxlabs-pc (or luxlabs@<tailscale-ip>)
```

Updated DB migration commands for CLAUDE.md:
```bash
# Apply a migration file
ssh luxlabs@luxlabs-pc "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres \
  -f /opt/luxlabs/chefsbook/repo/supabase/migrations/<file>.sql"

# Restart PostgREST schema cache
ssh luxlabs@luxlabs-pc "docker restart supabase-rest"

# Inspect table schema
ssh luxlabs@luxlabs-pc "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres \
  -c '\d tablename'"
```

Updated web staging section for CLAUDE.md:
```markdown
### Web Staging (luxlabs-pc)
URL: http://<tailscale-ip>:3001
Deploy: ssh luxlabs@luxlabs-pc && /opt/luxlabs/chefsbook/deploy-staging.sh
```

---

### Step 18 — Update Android APK (network_security_config.xml)

```xml
<!-- apps/mobile/android/app/src/main/res/xml/network_security_config.xml -->
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">localhost</domain>
    <domain includeSubdomains="false">10.0.2.2</domain>
    <domain includeSubdomains="false"><luxlabs-pc Tailscale IP></domain>
    <!-- Remove: 100.110.47.62 -->
  </domain-config>
</network-security-config>
```

Update `.env.staging`:
```bash
# apps/mobile/.env.staging
EXPO_PUBLIC_SUPABASE_URL=http://<luxlabs-pc Tailscale IP>:8000
```

Build and install updated staging APK:
```bash
cd apps/mobile
EXPO_PUBLIC_APP_VARIANT=staging npx expo run:android --variant release
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

### Step 19 — Update deploy-staging.sh

```bash
ssh luxlabs@luxlabs-pc
nano /opt/luxlabs/chefsbook/deploy-staging.sh

# Replace /mnt/chefsbook/ → /opt/luxlabs/chefsbook/
# Replace rasp@ → luxlabs@
# Replace rpi5-eth → luxlabs-pc
```

---

### Step 20 — Update the Voice Integration Plan

In `ChefsBook-Voice-and-Infrastructure-Plan.md`, mark the INFRA sessions (INFRA-1, INFRA-2, INFRA-3) as complete and replace all Mac Mini references with `luxlabs-pc`. Rename `mac-mini-migration.md` agent to `server-migration.md` and update its contents to reflect the actual setup.

---

## Phase 5: Set Up Automated Backups

Do this before considering the migration finished.

```bash
ssh luxlabs@luxlabs-pc

cat > /opt/luxlabs/chefsbook/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M)
BACKUP_DIR="/opt/luxlabs/chefsbook/backups"
BACKUP_FILE="$BACKUP_DIR/chefsbook_$DATE.dump"
mkdir -p $BACKUP_DIR

pg_dump postgresql://supabase_admin:<pw>@localhost:5432/postgres \
  --no-owner --no-acl -Fc \
  -f $BACKUP_FILE

# Keep only last 7 days locally
find $BACKUP_DIR -name "*.dump" -mtime +7 -delete

echo "Backup complete: $BACKUP_FILE ($(du -sh $BACKUP_FILE | cut -f1))"
EOF

chmod +x /opt/luxlabs/chefsbook/backup.sh

# Schedule daily at 2am
crontab -e
# Add: 0 2 * * * /opt/luxlabs/chefsbook/backup.sh >> /var/log/chefsbook-backup.log 2>&1
```

Optional offsite sync to Backblaze B2 (~$0.006/GB/month):
```bash
sudo apt install -y rclone
rclone config  # follow prompts for B2 credentials

# Add to backup.sh after the pg_dump line:
# rclone sync $BACKUP_DIR remote:luxlabs-chefsbook-backups
```

---

## Phase 6: Clean Up ChefsBook from Pi (30 days later)

The Pi keeps running its other projects. You're just removing the ChefsBook-specific services.

```bash
# Final safety backup from Pi
ssh rasp@rpi5-eth "pg_dump postgresql://supabase_admin:<pw>@localhost:5432/postgres \
  --no-owner --no-acl -Fc -f ~/chefsbook_final_archive.dump"
scp rasp@rpi5-eth:~/chefsbook_final_archive.dump ~/backups/

# Stop and remove ChefsBook Docker stack from Pi
# (leaves all other Pi projects completely untouched)
ssh rasp@rpi5-eth "cd /mnt/chefsbook/supabase && docker compose down"

# Remove ChefsBook from Pi's PM2
ssh rasp@rpi5-eth "pm2 delete chefsbook-web chefsbook-staging && pm2 save"

# Optionally reclaim disk space on Pi
# ssh rasp@rpi5-eth "sudo rm -rf /mnt/chefsbook/data"
```

The Pi continues running everything else, completely undisturbed.

---

## Key Differences: PC vs Pi (Reference)

| Item | Pi (rpi5-eth) | luxlabs-pc |
|------|--------------|------------|
| Next.js build memory | `--max-old-space-size=1024` | `--max-old-space-size=4096` or no limit |
| Docker syntax | `docker-compose` (v1) | `docker compose` (v2, no hyphen) |
| Project path | `/mnt/chefsbook/` | `/opt/luxlabs/chefsbook/` |
| SSH | `rasp@rpi5-eth` | `luxlabs@luxlabs-pc` |
| Architecture | ARM64 | x86_64 (amd64) |
| SWC ARM warning on build | Present (non-fatal) | Gone — clean builds |
| Docker image compatibility | ARM images only | All images work natively |
| Multi-project support | Single project | `/opt/luxlabs/<project>/` pattern |

---

## Claude Code Session Required After Migration

**Session: INFRA-PC-CUTOVER**  
Agents: `testing.md`, `deployment.md`, `feature-registry.md`

Tasks:
- Update all `rpi5-eth` / `100.110.47.62` / `rasp@` / `/mnt/chefsbook/` references in CLAUDE.md
- Update `network_security_config.xml` with luxlabs-pc Tailscale IP
- Update `deploy-staging.sh` with new paths and SSH user
- Rename `mac-mini-migration.md` → `server-migration.md`, update contents
- Add new CLAUDE.md agent lookup table rows for voice and server migration agents
- Verify `npx tsc --noEmit` passes on both apps
- Redeploy to luxlabs-pc and confirm `https://chefsbk.app` returns 200
- Add INFRA-PC-CUTOVER to DONE.md

---

## Summary

| Phase | When | Time | Pi impact |
|-------|------|------|-----------|
| Phase 1: PC setup | Evening 1 | ~90 min | None |
| Phase 2: Data migration | Evening 1 | ~45 min | None — Pi still live |
| Phase 3: Cutover | Evening 2 | ~30 min | Only ChefsBook services stop |
| Phase 4: Update references | Evening 2 | ~45 min | None |
| Phase 5: Automated backups | Evening 2 | ~15 min | None |
| Phase 6: Pi ChefsBook cleanup | 30 days later | ~15 min | Other Pi projects untouched |

---

*The Pi continues running its other projects throughout and after this migration. Only ChefsBook services transfer to luxlabs-pc. For future projects on luxlabs-pc, follow the same `/opt/luxlabs/<projectname>/` pattern with incremented ports.*
