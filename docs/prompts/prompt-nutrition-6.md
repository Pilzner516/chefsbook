# Prompt: Nutrition-6 — Bulk Backfill
# Model: OPUS
# Launch: Read docs/prompts/prompt-nutrition-6.md and execute fully through to deployment.

---

## MANDATORY PRE-FLIGHT — READ BEFORE WRITING ANY CODE

**Project foundation:**
- CLAUDE.md
- docs/nutrition-design.md — Section 10 edge cases, Section 7 implementation order
- docs/agents/feature-registry.md
- docs/agents/ai-cost.md — rate limiting guidance
- docs/agents/testing.md
- docs/agents/deployment.md
- docs/agents/ui-guardian.md

**Codebase audit:**
- apps/web/app/admin/ — scan the admin directory, find the admin layout and nav
- apps/web/app/dashboard/ — find My Recipes page
- packages/ai/src/generateNutrition.ts — understand null return conditions
- apps/web/app/api/recipes/[id]/generate-nutrition/route.ts — existing generate route
- Check how many recipes currently lack nutrition:
  ```bash
  ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
    -c 'SELECT COUNT(*) as total,
               COUNT(*) FILTER (WHERE nutrition IS NULL) as needs_nutrition,
               COUNT(*) FILTER (WHERE nutrition IS NOT NULL) as has_nutrition
        FROM recipes;'"
  ```

---

## CONTEXT

Nutrition-1 through 5 built the card, auto-generation, search filters, meal plan
integration, and mobile parity. All new imports now auto-generate nutrition.

Nutrition-6 handles the existing recipe library — recipes imported before Nutrition-2
landed have no nutrition data. This session gives admins and users tools to backfill
them without manual effort on each recipe.

---

## SCOPE — THIS SESSION ONLY

**Build:**
1. Admin bulk generation page at `/admin/nutrition`
2. Background bulk generation API route
3. User-facing "Generate for all my recipes" banner on My Recipes page (if > 5 recipes lack nutrition)

**Do NOT build:**
- Any changes to NutritionCard, import pipeline, search, meal plan, or mobile
- Per-ingredient nutrition breakdown (future feature)

---

## 1. ADMIN BULK GENERATION PAGE

Create `/admin/nutrition` page. Add it to the admin nav (find where other admin
nav items are defined and follow that pattern).

**Page contents:**

```
Nutrition Management

[Stats card]
Total recipes:           1,247
With nutrition data:       892  (71%)
Needs generation:          355

[Bulk Generation]
Generate nutrition for all recipes that don't have it yet.
Processing rate: 1 recipe/second (Anthropic rate limit)
Estimated time: ~6 minutes for 355 recipes

[Generate All button]  [Status: idle / running / complete]

[Progress bar when running]
Processing: 127 / 355 recipes
Errors: 3 (recipes with no ingredients — skipped)

[Recent generations log — last 20]
Recipe title          Generated at         Confidence
Spaghetti Carbonara   2 minutes ago        0.92
...
```

### API route for bulk generation

Create `POST /api/admin/nutrition/bulk-generate`

- Admin only (verify via admin_users)
- Accepts optional `{ limit: number }` body param (default: process all)
- Queries all recipe IDs where nutrition IS NULL
- Processes them sequentially with 1 second delay between each
  (respect Anthropic rate limits — see ai-cost.md)
- For each recipe: fetch title + servings + ingredients, call generateNutrition(),
  save if non-null
- Returns a streaming response or uses Server-Sent Events so the admin page
  can show live progress — Opus: choose the right pattern for Next.js 15 App Router
- Skips recipes with 0 ingredients (logs as skipped, not error)
- Never crashes mid-run — wrap each recipe in try/catch, continue on error

### Progress tracking

The admin page must show live progress during a run. Options:
- SSE (Server-Sent Events) from the API route
- Polling a status endpoint every 2 seconds

Opus: choose the simpler implementation that works reliably in Next.js 15 App Router
on RPi5. Consider that the RPi5 has limited memory — avoid holding all recipe data
in memory simultaneously. Process in batches of 50.

---

## 2. USER-FACING BANNER ON MY RECIPES

On the My Recipes dashboard page, when the user has more than 5 recipes without
nutrition data, show a dismissible amber banner:

```
✨ {N} of your recipes don't have nutrition data yet.
   [Generate for all →]
```

Clicking "Generate for all →" calls a user-scoped version of the bulk generate
route: `POST /api/recipes/bulk-generate-nutrition`

This route:
- Auth: current user only (generate for their recipes only)
- Finds all recipe IDs owned by user where nutrition IS NULL
- Processes them with the same fire-and-forget + rate limit pattern
- Returns immediately with `{ queued: N }` — processing happens async

Banner dismissal:
- Dismissed via localStorage key `'cb-nutrition-banner-dismissed'`
- Reappears if user imports 5+ more recipes without nutrition

Do not show the banner if the user has 5 or fewer recipes without nutrition
(small number — they can generate individually from each recipe detail page).

---

## GUARDRAILS

- Bulk generation must never block the UI — all processing is async
- The admin route must be admin-only (check admin_users table)
- The user route must only generate for the authenticated user's own recipes
- Rate limiting at 1 recipe/second is non-negotiable — do not remove it
- Skip recipes with no ingredients silently (do not mark as error)
- If the RPi5 process restarts mid-bulk-run, the run stops gracefully — 
  partially generated is fine, recipes processed so far keep their nutrition data

---

## VERIFICATION

TypeScript:
```bash
cd apps/web && npx tsc --noEmit
```

Live tests:
1. Navigate to `/admin/nutrition` → stats card shows correct counts from psql
2. Click "Generate All" → progress bar appears, advances in real time
3. After run: psql confirms nutrition count increased
4. Navigate to My Recipes with 5+ nutrition-less recipes → amber banner appears
5. Click "Generate for all →" → `{ queued: N }` response → navigate away and
   back after 30 seconds → several more recipes now have nutrition
6. Dismiss banner → localStorage key set → banner gone on reload
7. Non-admin user cannot call `/api/admin/nutrition/bulk-generate` → 403

---

## DEPLOYMENT
Follow deployment.md. Build on RPi5, PM2 restart, smoke test.

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION NUTRITION-6]`) must include:
- psql output: before and after recipe counts with/without nutrition
- Admin page description: what the stats and progress UI look like
- Confirmed at least 10 recipes were bulk-generated (show psql count change)
- User banner confirmed (describe which page, how many recipes)
- Rate limiting confirmed: 1 recipe/second observed in logs
- tsc clean: apps/web
- Deploy confirmed: HTTP 200
- NUTRITION FEATURE COMPLETE: note that all 6 sessions are done and the full
  nutrition feature is live
