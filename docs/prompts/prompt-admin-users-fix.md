# Prompt: Admin Users Page — Missing Columns Fix
# Model: OPUS
# Launch: Read docs/prompts/prompt-admin-users-fix.md and execute fully through to deployment.
# TYPE: CODE FIX

---

## CONTEXT

The admin Users page at /admin/users is missing several columns that were
specified in the original admin design and partially implemented in Prompt V.
This session completes all missing columns and fixes broken data.

---

## MANDATORY PRE-FLIGHT

Read these before touching anything:
- CLAUDE.md — project context, RPi5 setup
- docs/agents/testing.md — MANDATORY
- docs/agents/deployment.md — MANDATORY
- docs/agents/ui-guardian.md — Trattoria design system

Audit the live schema before writing any code:
```bash
ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
  -c '\d user_profiles'"

ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
  -c 'SELECT table_name FROM information_schema.tables
      WHERE table_name LIKE '"'"'%usage%'"'"'
         OR table_name LIKE '"'"'%cost%'"'"'
         OR table_name LIKE '"'"'%ai_log%'"'"'
         OR table_name LIKE '"'"'%throttle%'"'"';'"

ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
  -c 'SELECT column_name FROM information_schema.columns
      WHERE table_name = '"'"'user_profiles'"'"'
      ORDER BY ordinal_position;'"
```

Read `apps/web/app/admin/users/page.tsx` fully before making any changes.
Understand exactly what is currently being queried and rendered.

---

## ISSUES TO FIX

### FIX 1 — Display Name showing "Chef" for everyone

**Symptom:** Every user shows "Chef" as their display name.

**Diagnosis:** `display_name` is null in `user_profiles` for most users. The
page is falling back to a hardcoded "Chef" string.

**Fix:**
- Check what the user_profiles query returns for display_name
- If display_name is null, fall back to: username → email prefix → "User"
  (never a hardcoded role label like "Chef")
- Verify: does `user_profiles` have a `full_name` or `name` column that
  should be used instead of or alongside `display_name`?

---

### FIX 2 — Avatar column missing

**Symptom:** No avatar shown in the user table row.

**Fix:**
- Add a small avatar circle (32px) at the start of each user row
- Use the same avatar URL pattern as the fixed sidebar (Nutrition-1 used
  `proxyIfNeeded()` — find that pattern and use it here)
- Fall back to a letter initial if no avatar

---

### FIX 3 — Online indicator missing

**Symptom:** No green/grey dot indicating online status.

**Fix:**
- Add a green dot (🟢) next to username if `last_seen_at > NOW() - 5 minutes`
- Grey dot if offline
- If `last_seen_at` column does not exist on `user_profiles`, check if a
  heartbeat API exists (`/api/user/heartbeat`) and whether `last_seen_at`
  is being written
- If the heartbeat is not running: add a migration to ensure `last_seen_at`
  column exists, and note in DONE.md that the heartbeat client-side effect
  needs to be verified separately

---

### FIX 4 — Last Active column showing "Never"

**Symptom:** Last Active shows "Never" for all users.

**Root cause:** Either `last_seen_at` is not being written (heartbeat not firing)
or the column doesn't exist.

**Fix:**
- Confirm `last_seen_at` column exists (from schema audit above)
- If it exists but is always null: the heartbeat isn't running. Add a note
  to DONE.md. Display "Never" is correct for now — the column will populate
  once the heartbeat is verified.
- If it doesn't exist: add it via migration.
- Format when populated: `MM/DD/YY HH:MM`

---

### FIX 5 — Last Login column missing

**Symptom:** No Last Login column in the table.

**Fix:**
- Add Last Login column using `auth.users.last_sign_in_at`
- This requires joining auth.users — use the service role client
- Format: `MM/DD/YY HH:MM`, show "Never" if null

---

### FIX 6 — Login Count column missing

**Symptom:** No Login Count column.

**Fix:**
- Check if `login_count` column exists on `user_profiles`
- If yes: add column to table display
- If no: add migration `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;`
  and note that it will show 0 until the login handler increments it

---

### FIX 7 — Recipes count column missing

**Symptom:** No recipe count per user.

**Fix:**
- Add Recipes column showing COUNT of recipes owned by each user
- Query: `COUNT(recipes.id) WHERE recipes.user_id = user_profiles.id`
- This can be a subquery or a JOIN — use whichever fits the existing query pattern
- Show as a plain number, clickable to filter the Recipes admin page by that user (optional — do if easy)

---

### FIX 8 — Cost column always $0.00

**Symptom:** Cost column shows $0.00 for all users.

**Diagnosis:** The column exists but the query isn't summing from the AI usage log table.

**Fix:**
1. Find the AI cost/usage log table (check schema audit results above)
2. If the table exists: SUM costs per user_id and display in Cost column
3. If no table exists: leave Cost as $0.00 and add a comment in the code
   — do not create a fake table

---

### FIX 9 — Throttle column showing `—`

**Symptom:** Throttle column shows `—` for all users.

**Diagnosis:** The throttle data isn't being joined into the query.

**Fix:**
1. Find where throttle limits are stored (check for a `user_throttle` or
   `ai_throttle` table, or a throttle column on `user_profiles`)
2. If table exists: JOIN it and display the throttle value
3. If throttle is stored differently (e.g. Redis, env config): display
   the plan-default throttle limit instead of a per-user value

---

## TABLE COLUMN ORDER (final desired state)

After all fixes, the Users table columns should be:

| Column | Source |
|--------|--------|
| ☐ | Checkbox |
| Avatar | user_profiles.avatar_url |
| User (name + @username + 🟢/⚫ dot) | user_profiles |
| Email | auth.users.email |
| Plan | user_profiles.plan |
| Image Quality | user_profiles.image_quality |
| Cost | SUM from ai_usage_log |
| Rev | (existing) |
| Delta | (existing) |
| Throttle | throttle table or plan default |
| Recipes | COUNT from recipes |
| Logins | user_profiles.login_count |
| Last Login | auth.users.last_sign_in_at |
| Last Active | user_profiles.last_seen_at |
| Role | admin_users.role |
| Tags | (existing) |
| 🚩 | flag indicator |

Opus: do not add columns that have no data source. If a column's data source
doesn't exist in the DB, note it in DONE.md as "pending data" and skip it —
do not show $0 or "Never" for columns that are structurally broken.

---

## GUARDRAILS

- Do not change any admin page other than /admin/users
- Do not change the NutritionCard, import pipeline, or any nutrition session work
- All DB queries must use the service role client (admin page pattern)
- If a column requires a new migration, apply it on RPi5 and verify before
  proceeding with the UI change
- Display names must never show a hardcoded role label ("Chef", "Member", etc.)

---

## VERIFICATION

TypeScript:
```bash
cd apps/web && npx tsc --noEmit   # zero errors
```

Live checks at https://chefsbk.app/admin/users:
1. Display names show actual names (not "Chef") or username fallback ✓
2. Avatar circle visible for users who have one ✓
3. Last Login column present with formatted dates ✓
4. Login Count column present ✓
5. Recipes column present with counts > 0 for active users ✓
6. Cost column — either real data or confirmed $0 because no log table exists ✓
7. Throttle — either real data or plan-default shown ✓
8. Last Active — either real data or "Never" with explanation in DONE.md ✓
9. Online dot — present (green/grey) ✓
10. psql verify one user's recipe count matches what's shown in the table

---

## DEPLOYMENT
Follow deployment.md. Build on RPi5, PM2 restart, smoke test.

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION ADMIN-USERS-FIX]`) must include:
- List every column fixed vs skipped (and why skipped)
- Which columns have real data vs placeholder ("Never", $0) and why
- Any migrations applied (with migration number)
- Whether heartbeat/last_seen_at is confirmed writing or still pending
- Whether AI cost log table was found (table name if yes, "not found" if no)
- tsc clean confirmed
- Deploy confirmed: HTTP 200
