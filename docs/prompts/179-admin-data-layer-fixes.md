# ChefsBook — Session 179: Admin Data Layer Fixes
# Depends on: Sessions 162, 166, 167 (ai_usage_log, /admin/costs, activity feed exist)
# Target: packages/db, apps/web/app/api (surgical fixes only)

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, .claude/agents/deployment.md,
.claude/agents/ai-cost.md, and .claude/agents/feature-registry.md before starting.
Run all pre-flight checklists.

The ai_usage_log table, logAiCall(), /admin/costs, and activity feed are all live
from sessions 162/166/167. This session fixes four specific data quality gaps
identified by audit. No new pages. No UI changes. Data layer only.

Work through all 4 parts in order. Verify each before moving to the next.

---

## PART 1 — Add success + duration_ms to ai_usage_log

### Why
ai_usage_log has no success column and no duration_ms column. Failed AI calls
cost tokens but are invisible. Latency per function cannot be tracked.

### Step 1 — Check the current schema first
```bash
ssh rasp@rpi5-eth
psql $DATABASE_URL -c "\d ai_usage_log"
```
Confirm that success and duration_ms do NOT already exist before proceeding.
If they already exist, skip Part 1 entirely and note it in the wrapup.

### Step 2 — Create migration
File: supabase/migrations/046_ai_usage_log_extend.sql

```sql
ALTER TABLE ai_usage_log
  ADD COLUMN IF NOT EXISTS success BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

CREATE INDEX IF NOT EXISTS ai_usage_log_success_idx
  ON ai_usage_log (success, created_at DESC);

UPDATE ai_usage_log SET success = true WHERE success IS NULL;
```

Apply to RPi5:
```bash
psql $DATABASE_URL -f supabase/migrations/046_ai_usage_log_extend.sql
docker restart supabase-rest
```

Verify:
```bash
psql $DATABASE_URL -c "\d ai_usage_log" | grep -E "success|duration_ms"
# Must show both columns before continuing
```

### Step 3 — Update logAiCall() signature
File: packages/db/src/queries/aiUsage.ts

Add success and durationMs to the params interface and INSERT statement:

```ts
export async function logAiCall(params: {
  userId?: string | null
  action: string
  model: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  recipeId?: string | null
  metadata?: Record<string, unknown>
  success?: boolean           // NEW — default true
  durationMs?: number | null  // NEW — default null
}): Promise<void>
```

Update the INSERT to include success and duration_ms.
Default success to true if not passed so all existing call sites compile
without changes.

---

## PART 2 — Fix null user_id at call sites

### Why
5 of 11 logAiCall call sites pass userId: null (hardcoded). The throttle
system and per-user cost attribution in /admin/costs are blind to these actions.

### Identify which routes still have null userId
Run this first to see the current state:
```bash
grep -n "userId.*null\|userId: null" apps/web/app/api/speak/route.ts \
  apps/web/app/api/import/url/route.ts \
  apps/web/app/api/recipes/auto-tag/route.ts \
  apps/web/app/api/recipes/check-image/route.ts \
  apps/web/app/api/recipes/finalize/route.ts
```

For each route that shows userId: null, apply this fix:

```ts
// At the top of the handler, before the AI call:
const { data: { session } } = await supabase.auth.getSession()
const userId = session?.user?.id ?? null
```

Then pass userId to logAiCall instead of null.

Routes to check and fix (only fix those that actually have the null problem —
do not touch routes that already pass a real userId):
- apps/web/app/api/speak/route.ts
- apps/web/app/api/import/url/route.ts (two logAiCall calls)
- apps/web/app/api/extension/import/route.ts
- apps/web/app/api/recipes/auto-tag/route.ts
- apps/web/app/api/recipes/check-image/route.ts
- apps/web/app/api/recipes/finalize/route.ts

Do not refactor or touch anything else in these files.

---

## PART 3 — Add timing to all call sites + add success/durationMs

### Why
No logAiCall call currently passes durationMs. Without it the latency columns
in /admin/costs will be empty.

For every existing logAiCall call site (all 11), add:
1. `const t0 = Date.now()` immediately before the AI call
2. Wrap the AI call in try/catch
3. On success: pass `success: true, durationMs: Date.now() - t0`
4. On catch: call logAiCall with `success: false, durationMs: Date.now() - t0`,
   then re-throw the original error

Pattern:
```ts
const t0 = Date.now()
let aiResult
try {
  aiResult = await someAiFunction(...)
} catch (err) {
  await logAiCall({ ..., success: false, durationMs: Date.now() - t0 })
  throw err
}
await logAiCall({ ..., success: true, durationMs: Date.now() - t0 })
```

Apply this pattern to all 11 existing call sites.
If a route already wraps in try/catch, fit the timing into that existing
structure — do not add a second try/catch block.

---

## PART 4 — Add logging to regenerate-image route

### Why
apps/web/app/api/recipes/regenerate-image/route.ts has zero logAiCall calls.
Image regen costs (Flux) are invisible in /admin/costs.

Check the file first:
```bash
grep -n "logAiCall" apps/web/app/api/recipes/regenerate-image/route.ts
# Should return 0 results — confirming the gap
```

Then add:
- Import logAiCall from packages/db
- Extract userId from session at handler start
- Extract recipeId from request params
- Record t0 before the image generation call
- After generation (in try/catch), call logAiCall with:
  - action: 'regenerate_image'
  - model: check the existing model string used in this file (likely 'flux-schnell'
    or 'flux-dev' — use whatever is already there, do not change the model)
  - tokensIn: 0
  - tokensOut: 0
  - costUsd: use the same cost constant already used in generate-image/route.ts
    (check that file for the value — do not invent a new number)
  - recipeId
  - userId
  - success: true/false
  - durationMs: Date.now() - t0

---

## PART 5 — Real system health endpoint

### Why
The 4 status dots on /admin overview (database, anthropic, replicate, storage)
are hardcoded strings — they always show green regardless of actual state.
Session 167 added the UI row but the data behind it is fake.

### Create: apps/web/app/api/admin/system-health/route.ts

Admin-only route. Verify admin role before proceeding (check admin_users table
via service role client, same pattern as other /api/admin routes).

Run all checks in parallel with Promise.allSettled. Cache result in module-level
variable for 60 seconds to avoid shelling out on every auto-refresh.

**database** — run `SELECT 1` via Supabase service client.
Return: `{ status: 'online' | 'error', latencyMs: number }`

**anthropic** — GET https://api.anthropic.com/v1/models with Authorization header
using ANTHROPIC_API_KEY env var. 5s timeout. 200 = online.
Return: `{ status: 'online' | 'error', latencyMs: number }`

**replicate** — reuse the existing pattern from admin/page.tsx systemStatus check
(GET api.replicate.com/v1/account, 5s timeout).
Return: `{ status: 'online' | 'error', latencyMs: number }`

**disk** — shell exec: `df -h /mnt/chefsbook`
Parse Use% and Avail from output.
Return: `{ usedPercent: number, availGb: string, status: 'ok' | 'warning' | 'critical' }`
Thresholds: warning >75%, critical >90%.

**memory** — shell exec: `free -m`
Parse total and available MB.
Return: `{ usedPercent: number, availMb: number, status: 'ok' | 'warning' | 'critical' }`
Thresholds: warning >80%, critical >95%.

**pm2** — shell exec: `pm2 jlist`
Parse JSON. Find process named 'chefsbook-web'.
Return: `{ status: 'online' | 'stopped' | 'error', uptimeMs: number, restarts: number }`
If pm2 fails or process not found: `{ status: 'error' }`

Shell exec pattern:
```ts
import { execSync } from 'child_process'
try {
  const out = execSync('df -h /mnt/chefsbook', { timeout: 3000 }).toString()
  // parse out
} catch {
  return { status: 'error' }
}
```

Response shape:
```json
{
  "database":  { "status": "online", "latencyMs": 12 },
  "anthropic": { "status": "online", "latencyMs": 340 },
  "replicate": { "status": "online", "latencyMs": 210 },
  "disk":      { "usedPercent": 42, "availGb": "33G", "status": "ok" },
  "memory":    { "usedPercent": 61, "availMb": 1640, "status": "ok" },
  "pm2":       { "status": "online", "uptimeMs": 86400000, "restarts": 0 }
}
```

### Wire into admin overview
File: apps/web/app/admin/page.tsx

Replace the current hardcoded systemStatus fetch with a fetch to
/api/admin/system-health. Update the status row rendering to show:
- For database/anthropic/replicate: 🟢 online / 🔴 error + latency in ms
- For disk/memory: 🟢 ok / 🟡 warning / 🔴 critical + the usedPercent and
  avail values as subtext
- For pm2: 🟢 online / 🔴 stopped/error + uptime as "Xh Ym" + restart count

If the endpoint returns an error or times out, show 🔴 for all indicators
rather than silently hiding the row.

---

## VERIFICATION CHECKLIST

Do not mark done until every check passes.

### Part 1 — Schema
```bash
psql $DATABASE_URL -c "\d ai_usage_log" | grep -E "success|duration_ms"
# Must show both columns
```

### Part 2 — No more null userId
```bash
grep -rn "userId: null" apps/web/app/api/ | grep logAiCall
# Must return 0 results
```

### Part 3 — All call sites pass durationMs
```bash
grep -rn "durationMs" apps/web/app/api/ | grep logAiCall
# Must show entries for all 11 call sites
```

### Part 4 — regenerate-image logs
```bash
grep -n "logAiCall" apps/web/app/api/recipes/regenerate-image/route.ts
# Must return at least 1 result
```

### Part 5 — Real health endpoint
```bash
# Trigger a real import on chefsbk.app while logged in, then:
psql $DATABASE_URL -c "
  SELECT action, model, user_id, success, duration_ms, cost_usd
  FROM ai_usage_log
  ORDER BY created_at DESC
  LIMIT 5;
"
# user_id must NOT be null for the import_url row
# duration_ms must NOT be null
# success must be true

# Health endpoint (get admin cookie from browser DevTools):
curl -s https://chefsbk.app/api/admin/system-health \
  -H "Cookie: <admin-session-cookie>" | jq .
# Must return all 6 keys with real values — not hardcoded strings
# disk.usedPercent and memory.usedPercent must be non-zero numbers
```

### Type check
```bash
cd apps/web && npx tsc --noEmit
# Must pass clean
```

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
rm -rf apps/web/.next
cd apps/web
NODE_OPTIONS=--max-old-space-size=1024 npx next build --no-lint 2>&1 | tail -20
# Exit code must be 0 before restarting PM2
pm2 restart chefsbook-web
```

Verify after restart:
```bash
curl -o /dev/null -s -w "%{http_code}" https://chefsbk.app/admin
# Must return 200
```

---

## COMPLETION CHECKLIST

- [ ] Migration 046 applied — success + duration_ms columns exist in ai_usage_log
- [ ] logAiCall() signature accepts success and durationMs
- [ ] All call sites pass real userId (zero hardcoded nulls)
- [ ] All call sites pass success and durationMs (timing wrapped in try/catch)
- [ ] regenerate-image route calls logAiCall
- [ ] /api/admin/system-health returns live data for all 6 checks
- [ ] Admin overview status row shows real data (not hardcoded strings)
- [ ] Live import test shows non-null user_id + duration_ms in DB
- [ ] tsc --noEmit passes clean on apps/web
- [ ] Deployed to RPi5 — chefsbk.app and /admin both HTTP 200
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
