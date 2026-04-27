# deployment — ChefsBook Deployment Agent
# Read this file at the end of EVERY web session before /wrapup.
# Never declare a web session done without completing this checklist.

## YOUR ROLE
You own the deployment step. Every change to apps/web MUST be deployed to RPi5
and verified live before the session is complete. A session that builds but does
not deploy has not delivered anything to the user.

---

## MANDATORY DEPLOYMENT STEPS

Run these in order after every web code change:

### Step 1 — Push changes
Ensure all changes are committed and pushed to the repo that the Pi pulls from.

### Step 2 — Pull and build on RPi5

**CRITICAL**: Use the deploy script (handles all cleanup automatically):
```bash
ssh rasp@rpi5-eth "/mnt/chefsbook/deploy-staging.sh"
```

**Or manual build** (if deploy script unavailable):
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull

# MANDATORY pre-build clean (prevents duplicate React crash):
rm -rf apps/web/node_modules/react apps/web/node_modules/react-dom .next

# Build with increased memory for arm64:
cd apps/web
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -30
```

**DO NOT** run `npm install` in apps/web or repo root on Pi — blocked by EOVERRIDE conflict.

**If build fails:**
- Read the FULL error output (not just tail — scroll up if needed)
- Fix the error before continuing
- Do NOT restart PM2 with a failed build — it will crash the live site
- Common failures:
  - Missing package: `npm install [package-name]` then rebuild
  - TypeScript error: fix the type error, commit, pull, rebuild
  - React duplicate: `npm install react@19.1.0 react-dom@19.1.0 --legacy-peer-deps`
  - Missing env var: check `apps/web/.env.local` on the Pi

**If build succeeds (exit code 0):**
Proceed to Step 3.

### Step 3 — Restart PM2
```bash
pm2 restart chefsbook-web
pm2 status
```
Confirm status shows `online`. If it shows `errored`, run:
```bash
pm2 logs chefsbook-web --lines 20
```
Fix the error and restart again.

### Step 4 — Post-deploy smoke test
Wait 10 seconds after restart, then verify key pages load:
```bash
curl -I https://chefsbk.app/
curl -I https://chefsbk.app/dashboard
curl -I https://chefsbk.app/auth
```
All must return HTTP 200 or 307 (redirect). Any 500 means the deploy broke something.

### Step 5 — Test the specific feature you built
Run the feature-specific test from .claude/agents/testing.md.
This is not optional — confirm the feature works on the live site.

---

## COMMON BUILD FAILURES AND FIXES

| Error | Fix |
|-------|-----|
| `Module not found: Can't resolve '@react-pdf/renderer'` | `npm install @react-pdf/renderer` on Pi then rebuild |
| `Cannot read properties of undefined (reading 'os')` | SWC lockfile issue — `rm -rf node_modules/.cache && npm install --legacy-peer-deps` |
| `Cannot read properties of null (reading 'useContext')` | Duplicate React — `npm install react@19.1.0 react-dom@19.1.0 --legacy-peer-deps` then `npm dedupe` |
| TypeScript errors | Fix the type error in the source, commit, pull, rebuild |
| `ENOSPC: no space left on device` | Pi disk full — `df -h` to check, clear old builds: `rm -rf .next` |
| Port 3000 already in use after restart | `sudo lsof -i :3000` then kill the PID |
| `Failed to patch lockfile [TypeError: Cannot read properties of undefined (reading 'os')]` | SWC lockfile issue on arm64 — **NON-FATAL**, build still compiles via SWC in ~27s. Ignore this warning. |

---

## ENVIRONMENT VARIABLES

If a new env var was added during this session, it must also be added to
`apps/web/.env.local` on the Pi:
```bash
ssh rasp@rpi5-eth
nano /mnt/chefsbook/repo/apps/web/.env.local
# Add the new variable, save, then rebuild
```

---

## DEPLOYMENT CHECKLIST

```
□ All code committed and pushed to repo
□ git pull succeeded on RPi5
□ npm run build succeeded (exit code 0, no errors in output)
□ pm2 restart chefsbook-web — status shows "online"
□ curl -I https://chefsbk.app/ returns 200 or 307
□ Feature-specific test passed on live site (not localhost)
□ If new env vars: added to .env.local on Pi before build
```

---

## IF YOU CANNOT DEPLOY

If SSH to RPi5 is unavailable (Tailscale down, Pi offline):
1. Note in DONE.md: "Deployment pending — RPi5 unreachable"
2. Do NOT mark the session complete
3. The session is only done when the feature is live at chefsbk.app
