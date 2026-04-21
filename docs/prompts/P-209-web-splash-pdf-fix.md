# P-209 — Web: Splash Flash Fix + PDF Export Pro Plan Fix

## WAVE 1 — Runs in parallel with P-205 and P-208
## Web only — no mobile file conflicts

---

## SESSION START

```bash
git pull origin main
```

Read agents in this order:
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md` (full)
3. `DONE.md`
4. `.claude/agents/testing.md` (MANDATORY)
5. `.claude/agents/feature-registry.md` (MANDATORY)
6. `.claude/agents/ui-guardian.md` (MANDATORY)
7. `.claude/agents/deployment.md` (MANDATORY — web session)

Run ALL pre-flight checklists before proceeding.

---

## Context
QA report 4/20/2026 Items 4 and 11. Both are web-side fixes. Do not touch mobile files.

---

## PART A — Web Splash: Tiny Hat Icon Flashes Before Branded Landing Page

### Problem
When the web app loads, a tiny hat/favicon icon is briefly visible before the branded splash renders. The full splash (cream background, large chef hat, "ChefsBook" wordmark, welcome message) should be visible immediately.

### Pre-Flight Investigation (before coding)

Read and understand:
- `apps/web/app/` — look for `loading.tsx`, root `page.tsx`, and any existing splash component
- `apps/web/public/` — inventory all static assets, especially logo/hat images
- `apps/web/app/layout.tsx` — root layout and loading states

Determine what is causing the flash. The favicon in the browser tab is expected and acceptable — fix only the page content flash.

### Fix Requirements

1. **`apps/web/app/loading.tsx`** — create or update to render the branded splash immediately as the Next.js suspense fallback:
   - Background: cream `#faf7f0`, 100vw × 100vh
   - Center: chef hat logo (from `public/` — do NOT use a remote URL)
   - Below logo: "ChefsBook" in serif font (Georgia or existing brand font), large
   - Below wordmark: "Welcome to ChefsBook" tagline, smaller weight
   - Pure static HTML/CSS — zero network calls required to render

2. **Offline-capable** — all assets must be served from `public/`. If the logo currently loads from a CDN or remote URL, copy it to `public/` and reference it locally. The splash must render with network set to Offline in DevTools.

3. **Preserve any existing timer** — if the current implementation has a timed hold, keep it. Do not add a timer if one does not exist.

4. **Static asset check** — confirm chef hat / logo PNG or SVG exists in `apps/web/public/`. If missing, copy from `apps/mobile/assets/` (the session 203 splash used a chef-hat asset at 160×160).

5. Do NOT change the favicon.

### Verification
- Load `https://chefsbk.app` with Chrome DevTools → Network → Slow 3G throttle
- Confirm cream background + logo + wordmark + tagline visible immediately during load
- Set DevTools → Offline → reload — confirm splash renders with no network
- Screenshot showing the splash during a throttled load

Deploy to staging before marking done:
```bash
ssh rasp@rpi5-eth "/mnt/chefsbook/deploy-staging.sh"
```
Test on `http://100.110.47.62:3001` before pushing to production.

---

## PART B — PDF Export Gated for Pro User (a@aol.com)

### Problem
PDF export shows a Pro plan gate for `a@aol.com` (pilzner, super_admin) who IS on a Pro plan.

### Step 1 — Investigate before touching any code

```bash
ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres -c \"SELECT id, email, plan FROM user_profiles WHERE email = 'a@aol.com';\""
```

Also find the PDF plan gate in `apps/web/`:
```bash
grep -r "pdf\|plan.*pro\|pro.*plan" apps/web/app/recipe --include="*.tsx" --include="*.ts" -l
```

Document what you find: is this a data problem (wrong plan value in DB) or a code problem (wrong check)?

### Fix

**If plan column is wrong in DB (most likely):**
```sql
UPDATE user_profiles SET plan = 'pro' WHERE email = 'a@aol.com';
```
Verify:
```sql
SELECT email, plan FROM user_profiles WHERE email = 'a@aol.com';
```

**If the plan check code is wrong:** make a minimal targeted fix. Do not refactor the plan check system.

**If admin users need a blanket bypass:** add: if user has a row in `admin_users`, allow PDF regardless of plan. Follow the same admin-bypass pattern used elsewhere in admin routes.

After the fix:
- Confirm PDF works for `a@aol.com`
- Confirm PDF is still gated for a known Free-plan user

### Verification
- psql showing `a@aol.com` has `plan = 'pro'`
- Screenshot of PDF successfully downloading for `a@aol.com` on web
- Screenshot of PDF still gated for a Free user

---

## Web Build and Deploy
After both parts verified, follow `deployment.md` for full web build:
```bash
# On RPi5
rm -rf apps/web/node_modules/react apps/web/node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npx next build --no-lint
```
Then deploy staging, verify, deploy production.

---

## Session Close
```
/wrapup
```
Wrapup requires: throttled-load screenshot for splash, Offline-mode screenshot for splash, psql output for PDF plan fix, PDF download screenshot, Free-user gate screenshot.

---

## Guardrails
- git pull before starting
- Do NOT touch mobile files
- Do NOT change the favicon
- Do NOT remove the PDF plan gate — fix only for legitimate Pro users
- Do NOT refactor the plan check system
- All splash assets must be local to `public/` — no CDN or remote URLs
- Deploy to staging and verify BEFORE marking done
- Follow `deployment.md` for all web deployment steps
