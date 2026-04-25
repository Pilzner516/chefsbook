# Prompt: Nutrition-3 — Search Filters
# Model: OPUS
# Launch: Read docs/prompts/prompt-nutrition-3.md and execute fully through to deployment.

---

## MANDATORY PRE-FLIGHT — READ BEFORE WRITING ANY CODE

**Project foundation:**
- CLAUDE.md
- docs/nutrition-design.md — Section 5 covers search filter design
- docs/agents/feature-registry.md
- docs/agents/testing.md
- docs/agents/deployment.md
- docs/agents/ui-guardian.md — Trattoria design system

**Codebase audit — critical reading before touching anything:**
- apps/web/app/dashboard/search/ — full directory, understand current filter UI
- apps/web/app/api/search/ or wherever the search RPC is called — find the
  exact function and parameters
- packages/db/src/ — find the search_recipes RPC or equivalent
- The actual Postgres function: inspect on RPi5:
  ```bash
  ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
    -c '\df search_recipes'"
  ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
    -c 'SELECT prosrc FROM pg_proc WHERE proname = '"'"'search_recipes'"'"';'"
  ```
- Check that migration 053 nutrition column exists and has data:
  ```bash
  ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
    -c 'SELECT COUNT(*) FROM recipes WHERE nutrition IS NOT NULL;'"
  ```

---

## CONTEXT

Nutrition-1 built the card and manual generation.
Nutrition-2 wired auto-generation at import.
Nutrition-3 makes nutrition data discoverable — users can filter recipes by
calorie range, protein level, and dietary preset.

---

## SCOPE — THIS SESSION ONLY

**Build:**
- Extend search RPC (or create a new one) to accept nutrition filter parameters
- Add nutrition filter UI to the web search page
- Wire filter state through to the API

**Do NOT build:**
- Any changes to NutritionCard, import pipeline, or meal plan
- Mobile search filters (Nutrition-5)
- Bulk backfill (Nutrition-6)

---

## FILTER SPECIFICATION

### Filter categories to add

**Calories (per serving)**
- Any (default)
- Under 300
- 300–500
- 500–700
- Over 700

**Protein**
- Any (default)
- High (20g+)
- Medium (10–20g)
- Low (under 10g)

**Dietary presets** (compound filters)
- Low Carb (carbs_g < 20)
- High Fiber (fiber_g >= 5)
- Low Fat (fat_g < 10)
- Low Sodium (sodium_mg < 600)

### UI placement
Opus: inspect the existing search filter UI before designing placement.
The search page has a category drill-down system (Cuisine, Course, Source, Tags,
Cook Time). Nutrition filters should feel native to that system — not bolted on.
Suggest adding a "Nutrition" category alongside the existing ones.

### Filter behaviour
- Nutrition filters only apply to recipes that HAVE nutrition data
  (nutrition IS NOT NULL). Recipes without nutrition data are excluded from
  results when a nutrition filter is active, not shown without data.
- Show a note in the filter UI when a nutrition filter is active:
  "Showing recipes with nutrition data only"
- Filters are additive (AND logic) — calorie filter AND protein filter both apply

---

## DATABASE / RPC CHANGES

Opus: read the existing search RPC carefully before modifying.
The RPC uses ILIKE-based search. Nutrition filtering adds JSONB path conditions.

The JSONB query pattern for nutrition filters:
```sql
-- Calorie range example
AND (nutrition->>'per_serving')::jsonb->>'calories' IS NOT NULL
AND ((nutrition->'per_serving'->>'calories')::numeric) BETWEEN 300 AND 500

-- Protein level example  
AND ((nutrition->'per_serving'->>'protein_g')::numeric) >= 20

-- Dietary preset (low carb)
AND ((nutrition->'per_serving'->>'carbs_g')::numeric) < 20
```

If the existing RPC is a Postgres function, you will need a new migration to
update it. Migration number: check what comes after 053 in the migrations directory.

If search goes through a Next.js API route with inline queries, update that route.

Either way: Opus must read the actual implementation before deciding how to extend it.

---

## GUARDRAILS

- Do not break existing search behaviour for any existing filter (cuisine, course, etc.)
- Nutrition filters must gracefully handle recipes with malformed or partial
  nutrition JSONB (missing fields) — never crash, just exclude those recipes
- The filter UI must work on mobile viewport as well as desktop (check ui-guardian.md
  for responsive patterns)
- Do not change NutritionCard, import pipeline, or any other nutrition session's work

---

## VERIFICATION

TypeScript:
```bash
cd apps/web && npx tsc --noEmit
```

Live tests:
1. Search with no nutrition filters → results identical to pre-change behaviour ✓
2. Apply "Under 300 calories" filter → only recipes with nutrition data and
   calories < 300 appear in results
3. Apply "High Protein" filter → only recipes with protein_g >= 20 appear
4. Apply "Low Carb" preset → carbs_g < 20 verified on a result
5. Combine calorie + protein filters → both conditions apply
6. Apply any nutrition filter → "Showing recipes with nutrition data only" note visible
7. Clear filters → full results restore
8. Search on mobile viewport → nutrition filter section renders correctly
9. psql verify a filter directly:
   ```bash
   ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
     -c 'SELECT title, (nutrition->'"'"'per_serving'"'"'->>'"'"'calories'"'"')::numeric as cal
         FROM recipes WHERE nutrition IS NOT NULL
         AND (nutrition->'"'"'per_serving'"'"'->>'"'"'calories'"'"')::numeric < 300
         LIMIT 5;'"
   ```

---

## DEPLOYMENT
Follow deployment.md. Build on RPi5, PM2 restart, smoke test.

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION NUTRITION-3]`) must include:
- Whether RPC was extended or a new one created (and migration number if applied)
- Screenshot description: what the nutrition filter UI looks like in search
- Confirmed all 3 filter categories work with live data
- Confirmed existing search filters (cuisine, course etc.) still work
- tsc clean: apps/web
- Deploy confirmed: HTTP 200
- EXPLICITLY LIST as SKIPPED: Nutrition-4, 5, 6
