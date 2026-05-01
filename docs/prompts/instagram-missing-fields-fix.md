# Prompt: ChefsBook — Instagram Import: Fix missing_fields Sync (Web Only)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/instagram-missing-fields-fix.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUG FIX — WEB ONLY

## Overview

58 instagram_export recipes have ingredients and steps correctly stored in
`recipe_ingredients` and `recipe_steps`, but their `missing_fields` column still
contains `{"ingredients (minimum 2)"}`. The "Missing ingredients" badge on recipe
cards reads `missing_fields` directly. The fix is to understand how `missing_fields`
is computed and re-run that computation for all instagram_export recipes.

This is web-only. Do NOT touch `apps/mobile` or `apps/extension`.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `CLAUDE.md`
- `DONE.md`
- `.claude/agents/testing.md`
- `.claude/agents/deployment.md`
- `.claude/agents/import-quality.md`
- `.claude/agents/data-flow.md`

Run ALL pre-flight checklists before writing any code.

---

## Confirmed DB state

```sql
-- 58 recipes have stale missing_fields despite having ingredients in recipe_ingredients
SELECT missing_fields, COUNT(*)
FROM recipes
WHERE source_type = 'instagram_export'
GROUP BY missing_fields;
-- Result:
-- {}                           | 14   ← correct
-- {"ingredients (minimum 2)"} | 58   ← stale, ingredients exist in recipe_ingredients
```

---

## Pre-flight: before writing any code

1. Find how `missing_fields` is computed and updated — check `import-quality.md` and
   search the codebase for where `missing_fields` is written. It is likely updated by
   `/api/recipes/finalize` or a similar completeness-check function.
2. Confirm whether `finalize` was called for instagram_export recipes during P-212
   process-jobs — if it was called before ingredients were inserted, `missing_fields`
   would have been set correctly at the time but become stale once ingredients landed.
3. Confirm the exact function/route responsible for recomputing `missing_fields` —
   this is what needs to be called for the 58 stuck recipes.

---

## The fix

### Part 1: Retroactive fix for 58 stuck recipes

Once you know the correct function/route that recomputes `missing_fields`, call it
for all 58 affected recipes. This can be done via:

- A one-time script run on RPi5
- A temporary admin API endpoint
- Direct psql UPDATE if `missing_fields` can be safely computed in SQL

Do whichever is cleanest given what the codebase already has. Do not invent new
infrastructure for a one-time fix.

### Part 2: Fix process-jobs route ordering

The root cause is that `/api/recipes/finalize` (or equivalent) was called BEFORE
ingredients were inserted in the `process-jobs` route. Fix the ordering in
`apps/web/app/api/import/instagram-export/process-jobs/route.ts`:

```
CORRECT ORDER:
1. Insert recipe_ingredients
2. Insert recipe_steps  
3. Update recipe (is_complete, description, cuisine, tags)
4. Call finalize / recompute missing_fields  ← must be LAST
```

Confirm this is the actual order and fix if not.

### Part 3: Verify finalize is called with correct context

The `finalize` route or function needs the user's auth context to correctly evaluate
`missing_fields`. If it's called server-side via supabaseAdmin in process-jobs, confirm
it has access to the correct user_id for the completeness check.

---

## Testing

After the retroactive fix:

```sql
SELECT missing_fields, COUNT(*)
FROM recipes
WHERE source_type = 'instagram_export'
GROUP BY missing_fields;
-- Expected: all rows show {} (empty missing_fields)
```

In the browser:
- My Recipes shows no "Missing ingredients" badge on instagram recipes
- Banner shows 0 draft recipes (or only genuinely incomplete ones)
- Opening an instagram recipe shows ingredients and steps

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5 via `deploy-staging.sh`.
No migrations needed — this is a data fix + route ordering fix.

---

## Wrapup

Follow `wrapup.md` fully.

- [ ] `tsc --noEmit` clean on `apps/web`
- [ ] psql confirms all instagram_export recipes have `missing_fields = {}`
- [ ] "Missing ingredients" badge gone from all instagram recipes in production
- [ ] `DONE.md` entry written
- [ ] Deployed and smoke-tested
- [ ] TYPE classification: BUG (finalize called before ingredients inserted)
