# ChefsBook — Session: Cloudflare Tunnel Setup (chefsbk.app)
# Purpose: Expose RPi5 services publicly via chefsbk.app
# Target: RPi5 (via SSH) + Cloudflare dashboard

---

## CONTEXT

`chefsbk.app` has been registered on Cloudflare. This session configures a Cloudflare
Tunnel on the RPi5 so the ChefsBook web app and Supabase API are publicly accessible
without opening any ports on the home router.

Architecture:
```
Internet → chefsbk.app (Cloudflare DNS)
         → Cloudflare Edge (SSL)
         → Cloudflare Tunnel (outbound from RPi5)
         → RPi5 localhost:3000 (Next.js web app)
         → RPi5 localhost:8000 (Supabase API)
```

SSH access: `ssh rasp@rpi5-eth` (Tailscale must be active on the Windows PC)

Work through all phases in order. Do not skip ahead. Confirm each phase succeeds
before moving to the next.

---

## PHASE 1 — Install cloudflared on RPi5

```bash
ssh rasp@rpi5-eth
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

Confirm version prints correctly before continuing.

---

## PHASE 2 — Authenticate cloudflared

```bash
cloudflared tunnel login
```

This prints a URL. You cannot open it from the Pi — copy the URL and present it clearly
to the user with the message:

"Please open this URL in your browser and authorize chefsbk.app:
[URL HERE]
Then press Enter here to continue."

Wait for the user to confirm they have authorized before proceeding.
The Pi will save a certificate to `~/.cloudflared/cert.pem` after authorization.

---

## PHASE 3 — Create the tunnel

```bash
cloudflared tunnel create chefsbook
```

Capture and save the tunnel ID from the output — it looks like:
`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

You will need this ID in Phase 4. Store it in a variable for use in subsequent commands.

---

## PHASE 4 — Create tunnel config

Create `~/.cloudflared/config.yml` with the tunnel ID from Phase 3:

```yaml
tunnel: [TUNNEL_ID]
credentials-file: /home/rasp/.cloudflared/[TUNNEL_ID].json

ingress:
  - hostname: chefsbk.app
    service: http://localhost:3000
  - hostname: www.chefsbk.app
    service: http://localhost:3000
  - hostname: api.chefsbk.app
    service: http://localhost:8000
  - service: http_status:404
```

Replace [TUNNEL_ID] with the actual ID from Phase 3 in both places.

---

## PHASE 5 — Add DNS records

```bash
cloudflared tunnel route dns chefsbook chefsbk.app
cloudflared tunnel route dns chefsbook www.chefsbk.app
cloudflared tunnel route dns chefsbook api.chefsbk.app
```

All three must succeed before continuing.

---

## PHASE 6 — Build and start Next.js

```bash
cd /mnt/chefsbook/apps/web
npm run build
```

If build fails, read the error and fix it before continuing. Common issues:
- Environment variables missing — check .env.local exists
- TypeScript errors — fix them
- Out of memory on Pi — add `NODE_OPTIONS=--max-old-space-size=512 npm run build`

---

## PHASE 7 — Install PM2 and run Next.js as a service

```bash
npm install -g pm2
cd /mnt/chefsbook/apps/web
pm2 start npm --name "chefsbook-web" -- start
pm2 startup
```

`pm2 startup` prints a command starting with `sudo env PATH=...`
Run that printed command exactly as shown.

Then:
```bash
pm2 save
pm2 status
```

Confirm `chefsbook-web` shows `online` before continuing.

---

## PHASE 8 — Install and start cloudflared as a service

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

Confirm status shows `active (running)`.

---

## PHASE 9 — Verify tunnel is working

Test locally on the Pi first:
```bash
curl -I http://localhost:3000
```
Should return HTTP 200.

Then present these URLs to the user to test from their browser:
```
https://chefsbk.app
https://www.chefsbk.app
https://api.chefsbk.app/rest/v1/
```

Ask the user: "Please open https://chefsbk.app in your browser. Does the ChefsBook
web app load? Reply yes or no."

Wait for confirmation before declaring success.

---

## PHASE 10 — Update CLAUDE.md and environment

Once confirmed working, update the following:

In `apps/mobile/.env.production` (create if not exists):
```
EXPO_PUBLIC_SUPABASE_URL=https://api.chefsbk.app
EXPO_PUBLIC_APP_URL=https://chefsbk.app
```

In `apps/web/.env.local`, add:
```
NEXT_PUBLIC_APP_URL=https://chefsbk.app
```

In CLAUDE.md, add under infrastructure section:
```
## Public URLs
- Web app: https://chefsbk.app (Cloudflare Tunnel → RPi5 port 3000)
- API: https://api.chefsbk.app (Cloudflare Tunnel → RPi5 port 8000)
- Tunnel name: chefsbook
- PM2 process: chefsbook-web
- Restart web: pm2 restart chefsbook-web
- Restart tunnel: sudo systemctl restart cloudflared
- Tunnel logs: journalctl -u cloudflared -n 50
- Web logs: pm2 logs chefsbook-web
```

---

## TROUBLESHOOTING — if anything fails

**Tunnel not connecting:**
```bash
journalctl -u cloudflared -n 50
```

**Next.js 502 Bad Gateway:**
```bash
pm2 status
pm2 restart chefsbook-web
pm2 logs chefsbook-web --lines 30
```

**DNS not resolving:**
Wait 2 minutes — Cloudflare propagates fast but not instant.
Test: `nslookup chefsbk.app 1.1.1.1`

**Port 3000 already in use:**
```bash
sudo lsof -i :3000
sudo kill -9 [PID]
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] cloudflared installed on RPi5
- [ ] Tunnel authenticated (user authorized in browser)
- [ ] Tunnel `chefsbook` created with known ID
- [ ] config.yml written with correct tunnel ID
- [ ] DNS records created for chefsbk.app, www, api subdomains
- [ ] Next.js builds successfully
- [ ] PM2 running chefsbook-web (online status)
- [ ] cloudflared running as systemd service (active status)
- [ ] User confirmed https://chefsbk.app loads in browser
- [ ] CLAUDE.md updated with public URLs and restart commands
- [ ] .env files updated with public URLs
- [ ] Run /wrapup to update DONE.md
