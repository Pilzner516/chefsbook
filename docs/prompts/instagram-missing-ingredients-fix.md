# Prompt: ChefsBook — Instagram Import: Fix "Missing Ingredients" Badge Display (Web Only)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/instagram-missing-ingredients-fix.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUG FIX — WEB ONLY

## Overview

Instagram imported recipes (source_type = 'instagram_export') show a "Missing ingredients"
badge on every recipe card in My Recipes, even though the ingredients and steps are
confirmed present in the database. The data is correct — this is purely a frontend
display/query problem.

This is web-only. Do NOT touch `apps/mobile` or `apps/extension`.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `CLAUDE.md`
- `DONE.md`
- `.claude/agents/testing.md`
- `.claude/agents/deployment.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/ui-guardian.md`

Run ALL pre-flight checklists before writing any code.

---

## Confirmed DB state (do not re-investigate these — they are verified)

- `recipe_ingredients`: 1036 rows, all with correct `user_id`, RLS policy correct
- `recipe_steps`: 465 rows present for instagram_export recipes
- `recipes.is_complete = true` for all 72 instagram_export recipes
- `_incomplete` tag removed from all instagram_export recipes
- No `ingredient_count` column on the `recipes` table
- The "Missing ingredients" badge is driven entirely by frontend logic

---

## The problem

The My Recipes page fetches recipe rows but does NOT include `recipe_ingredients` in
the query. The recipe card component checks if ingredients are present and shows
"Missing ingredients" when the array is empty or undefined — which it always is because
the query never fetched them.

The `process-jobs` route (P-212) inserted ingredients correctly via supabaseAdmin but
the client-side recipe fetch doesn't know to look for them.

---

## Pre-flight: before writing any code

1. Find the My Recipes page query — locate where recipes are fetched for the grid
   (likely `apps/web/app/dashboard/recipes/page.tsx` or a hook it calls)
2. Find the recipe card component that renders the "Missing ingredients" badge —
   identify exactly what prop or condition triggers it
3. Find the recipe detail page query — check if it also fails to load ingredients
   for instagram_export recipes or if it works correctly
4. Check whether any other recipe source types have this same problem or if it's
   specific to how instagram_export recipes were inserted

---

## What to fix

### Fix 1: Recipe card "Missing ingredients" badge

The badge condition is almost certainly one of:
- `recipe.ingredients.length === 0`
- `!recipe.ingredients || recipe.ingredients.length === 0`
- A `hasIngredients` boolean derived at fetch time

Find the condition and trace it back to the query. The fix is either:

**Option A** — Include ingredients in the recipe list query (simplest if the query
already supports it and ingredients are short):
```typescript
.select('*, recipe_ingredients(*), recipe_steps(*)')
```

**Option B** — Add a lightweight `has_ingredients` check to the query:
```typescript
.select('*, recipe_ingredients(id)')  // just fetch IDs to check existence
```

**Option C** — If the badge reads from a field set at save time, ensure
`process-jobs` sets that field when inserting ingredients.

Choose whichever option is consistent with how other import sources handle this.
Do not invent a new pattern — match what already exists for `url` or `scan` source
recipe cards.

### Fix 2: Recipe detail page

Verify the recipe detail page (`/dashboard/recipes/[id]`) correctly loads and
displays ingredients and steps for instagram_export recipes. If it also has the
same query gap, fix it here too.

### Fix 3: process-jobs route defensive update

After inserting ingredients and steps, the `process-jobs` route should explicitly
trigger whatever mechanism marks a recipe as having ingredients — whether that's
a field update, a function call, or a cache invalidation. This ensures future
imports don't hit the same display bug.

---

## Testing

1. Go to My Recipes — confirm "Missing ingredients" badge is gone from all
   instagram_export recipes
2. Open an individual instagram_export recipe — confirm ingredients and steps display
3. Confirm non-instagram recipes are unaffected
4. Confirm the badge still correctly appears on genuinely incomplete recipes (the
   2 remaining draft recipes)

### psql spot check (confirm data unchanged)

```sql
SELECT COUNT(*) FROM recipe_ingredients ri
JOIN recipes r ON r.id = ri.recipe_id
WHERE r.source_type = 'instagram_export';
-- Expected: 1036
```

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5 via `deploy-staging.sh`.
This is a frontend-only fix — no migrations needed.

---

## Wrapup

Follow `wrapup.md` fully.

- [ ] `tsc --noEmit` clean on `apps/web`
- [ ] "Missing ingredients" badge gone from all instagram recipes in production
- [ ] Recipe detail page shows ingredients and steps correctly
- [ ] `DONE.md` entry written
- [ ] Deployed to RPi5 and smoke-tested
- [ ] TYPE classification: BUG (display query not fetching related data)
