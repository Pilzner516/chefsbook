# Prompt: Nutrition-6 Bug Fix — Bulk Generation Failing
# Model: OPUS
# Launch: Read docs/prompts/prompt-nutrition-6-fix.md and execute fully through to deployment.

---

## CONTEXT

Nutrition-6 deployed successfully but bulk generation fails on every recipe.
The admin /admin/nutrition page shows "error (generation failed)" for all recipes.

Root cause is confirmed: the bulk generate routes query the `recipes` table
without joining `recipe_ingredients`. Every recipe is passed to generateNutrition()
with an empty ingredients array, which returns null immediately (the empty-array
guard fires before any Claude call is made).

Ingredients ARE in the database — confirmed via psql. This is purely a query bug.

---

## PRE-FLIGHT

Read these files before touching anything:
- apps/web/app/api/admin/nutrition/bulk-generate/route.ts — primary bug location
- apps/web/app/api/recipes/bulk-generate-nutrition/route.ts — same bug, user-scoped version
- packages/ai/src/generateNutrition.ts — confirm the empty-array guard (line ~1)
- apps/web/lib/nutritionHelper.ts — understand generateAndSaveNutrition() helper

Do NOT read the entire codebase. This is a targeted fix.

---

## THE FIX

In BOTH routes, find the query that fetches recipe data for processing.
It currently fetches from `recipes` without ingredients. Fix it to include them:

```typescript
const { data: recipe } = await supabase
  .from('recipes')
  .select(`
    id,
    title,
    servings,
    recipe_ingredients (
      quantity,
      unit,
      ingredient
    )
  `)
  .eq('id', recipeId)
  .single()
```

Then ensure `recipe.recipe_ingredients` is passed as the `ingredients` array
to `generateNutrition()` or `generateAndSaveNutrition()`.

Opus: read the actual route files before applying the fix. The exact variable
names, query structure, and how the result is passed downstream may differ
from the pattern above. Match the existing code style — do not restructure
anything beyond the query and the ingredients pass-through.

Apply the fix to both routes:
1. apps/web/app/api/admin/nutrition/bulk-generate/route.ts
2. apps/web/app/api/recipes/bulk-generate-nutrition/route.ts

---

## GUARDRAILS

- Do not change generateNutrition() or nutritionHelper.ts
- Do not change any other nutrition session's work
- Do not restructure the routes — surgical fix only
- If the two routes use different query patterns, fix each one in its own style

---

## VERIFICATION

TypeScript:
```bash
cd apps/web && npx tsc --noEmit   # zero errors
```

Deploy per deployment.md, then:

1. Navigate to https://chefsbk.app/admin/nutrition
2. Confirm stats show 85 needs generation
3. Click "Generate All"
4. Watch SSE log — recipes should show confidence scores (0.6–0.95), not errors
5. After run completes (~2 minutes), check psql:
   ```bash
   ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
     -c 'SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE nutrition IS NOT NULL) as has_nutrition,
                COUNT(*) FILTER (WHERE nutrition IS NULL) as needs_nutrition
         FROM recipes;'"
   ```
   has_nutrition should be 85 (or close — a few recipes with 0 ingredients will
   still return null, which is correct behaviour)
6. Navigate to any recipe detail page → NutritionCard shows values

---

## DEPLOYMENT
Follow deployment.md. Build on RPi5, PM2 restart, smoke test.

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION NUTRITION-6-FIX]`) must include:
- Which two files were changed (confirm both routes fixed)
- psql output showing before/after nutrition counts
- Description of one successful SSE log entry (recipe name + confidence score seen)
- tsc clean confirmed
- Deploy confirmed: HTTP 200
