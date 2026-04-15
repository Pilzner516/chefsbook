# ChefsBook — Session 61: Fix Supabase Realtime WebSocket via Cloudflare Tunnel
# Source: Mixed content error — ws:// blocked on HTTPS page
# Target: RPi5 Cloudflare Tunnel config + apps/web Supabase client

---

## ROOT CAUSE

The shopping list page uses Supabase Realtime which connects via WebSocket.
The Supabase client is configured with `http://100.110.47.62:8000` as the URL.
When the web app runs on `https://chefsbk.app`, the browser blocks the WebSocket
connection to `ws://100.110.47.62:8000` as mixed content.

The fix: route Supabase Realtime through the Cloudflare Tunnel so it uses
`wss://api.chefsbk.app` — a secure WebSocket connection.

Read .claude/agents/testing.md and .claude/agents/deployment.md before starting.

---

## STEP 1 — Verify Cloudflare Tunnel config

```bash
ssh rasp@rpi5-eth
cat ~/.cloudflared/config.yml
```

The current config should have:
```yaml
ingress:
  - hostname: api.chefsbk.app
    service: http://localhost:8000
```

Cloudflare Tunnel supports WebSocket upgrades automatically on HTTP services.
The `http://localhost:8000` service will handle both HTTP and WebSocket (ws://)
connections — Cloudflare upgrades them to HTTPS/WSS automatically.

No change needed to the tunnel config itself. The tunnel already supports
WebSocket. The issue is the Supabase client URL.

---

## STEP 2 — Update Supabase client URL in apps/web

Find where the Supabase client is created for the web app.
Check these files:
```bash
grep -rn "100.110.47.62\|SUPABASE_URL\|createClient" \
  apps/web --include="*.ts" --include="*.tsx" -l
grep -rn "100.110.47.62\|SUPABASE_URL" \
  apps/web/.env.local apps/web/.env apps/web/.env.production 2>/dev/null
```

The Supabase URL for the web app must be `https://api.chefsbk.app` not
`http://100.110.47.62:8000`. When the Supabase client uses the HTTPS URL,
it automatically connects Realtime via `wss://api.chefsbk.app` instead of
`ws://100.110.47.62:8000`.

Update `apps/web/.env.local` on the Pi:
```bash
ssh rasp@rpi5-eth
nano /mnt/chefsbook/repo/apps/web/.env.local
```

Change:
```
NEXT_PUBLIC_SUPABASE_URL=http://100.110.47.62:8000
```
To:
```
NEXT_PUBLIC_SUPABASE_URL=https://api.chefsbk.app
```

Also update in the repo's `.env` files so future deployments use the correct URL:
- `apps/web/.env.local` (on Pi — do this first)
- `apps/web/.env.production` (in repo — commit this)

---

## STEP 3 — Verify the tunnel handles Supabase correctly

Test that `api.chefsbk.app` responds correctly to Supabase API requests:
```bash
curl -H "apikey: [anon_key]" https://api.chefsbk.app/rest/v1/recipes?limit=1
```
Should return JSON. If it does, the HTTP routing is working.

Test WebSocket upgrade:
```bash
curl -I -H "Connection: Upgrade" -H "Upgrade: websocket" \
  https://api.chefsbk.app/realtime/v1/websocket
```
Should return `101 Switching Protocols` or similar. If it returns 200 or an
error, the tunnel may need a WebSocket-specific configuration.

### If WebSocket upgrade fails — update tunnel config

Add `originRequest` to the ingress rule for `api.chefsbk.app`:
```yaml
ingress:
  - hostname: api.chefsbk.app
    service: http://localhost:8000
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s
      tcpKeepAlive: 30s
      keepAliveTimeout: 90s
      keepAliveConnections: 100
```

Restart the tunnel after any config change:
```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

---

## STEP 4 — Rebuild and deploy

After updating the env var on the Pi:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo/apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## STEP 5 — Verify fix

Open chefsbk.app in the browser with DevTools open (F12 → Console tab).
Navigate to the shopping list page.

You should see:
- NO mixed content errors
- NO WebSocket errors
- The shopping list page opens correctly

Confirm the WebSocket connects via WSS:
In DevTools → Network tab → filter by "WS" — you should see a connection to
`wss://api.chefsbk.app/realtime/v1/websocket` with status 101.

Also test other pages that use Realtime:
- Shopping list detail (items update in real time)
- Recipe detail (if it has Realtime subscriptions)

---

## STEP 6 — Update CLAUDE.md

Add to the infrastructure section:
```markdown
## Supabase Realtime (WebSocket)
- Web app must use NEXT_PUBLIC_SUPABASE_URL=https://api.chefsbk.app
- DO NOT use http://100.110.47.62:8000 in web app — causes mixed content error
- Cloudflare Tunnel handles WebSocket upgrades automatically (ws → wss)
- Mobile app uses http://100.110.47.62:8000 directly (no HTTPS requirement)
```

---

## COMPLETION CHECKLIST

- [ ] Cloudflare Tunnel config verified — WebSocket support confirmed
- [ ] NEXT_PUBLIC_SUPABASE_URL updated to https://api.chefsbk.app in .env.local on Pi
- [ ] .env.production updated in repo with https://api.chefsbk.app
- [ ] curl test confirms api.chefsbk.app returns Supabase API responses
- [ ] WebSocket upgrade test confirms wss:// connection works
- [ ] Web app rebuilt with new env var
- [ ] Shopping list page opens without crash on chefsbk.app
- [ ] No mixed content errors in browser console
- [ ] DevTools Network WS tab shows wss://api.chefsbk.app connection
- [ ] CLAUDE.md updated with Supabase Realtime note
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
