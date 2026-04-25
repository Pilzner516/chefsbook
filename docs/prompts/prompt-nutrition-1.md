# Prompt: Nutrition-1 — Foundation
# Model: OPUS
# Launch: Read docs/prompts/prompt-nutrition-1.md and execute fully through to deployment.

---

## MANDATORY PRE-FLIGHT — READ EVERYTHING BEFORE WRITING CODE

You are an Opus agent. Your first job is to understand the codebase deeply before
building anything. Read all of the following:

**Project foundation:**
- CLAUDE.md — project context, stack, RPi5 setup, deployment process
- docs/nutrition-design.md — the Opus architecture document for this feature (authoritative)
- docs/agents/feature-registry.md — existing features, avoid overlap
- docs/agents/ai-cost.md — model costs and selection rationale
- docs/agents/testing.md — verification standards (mandatory before wrapup)
- docs/agents/deployment.md — RPi5 deploy process
- docs/agents/ui-guardian.md — Trattoria design system, do not deviate

**Codebase audit — read these files to understand existing patterns:**
- packages/ai/src/client.ts — how callClaude() works, HAIKU/SONNET constants, error types
- packages/ai/src/generateDishRecipe.ts — reference implementation for an AI generation function
- packages/ai/src/ — scan the full directory
- apps/web/app/recipe/[id]/page.tsx — recipe detail page (where the card mounts)
- apps/web/components/ — scan for existing card/UI patterns to follow
- apps/web/app/api/recipes/ — existing API route patterns

**Check live schema before touching anything:**
```bash
ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
  -c '\d recipes'"
```
Identify the next migration number (should be 060) and confirm the existing
`calories`, `protein_g`, `carbs_g`, `fat_g` columns are present and unused.

---

## SCOPE — THIS SESSION ONLY

**Build:**
1. Migration 060 — nutrition JSONB column + `ai_model_config` table
2. `packages/ai/src/modelConfig.ts` — `getModelForTask()` helper
3. `packages/ai/src/generateNutrition.ts` — AI estimation function
4. `/api/recipes/[id]/generate-nutrition` — POST route (owner/admin only)
5. `apps/web/components/NutritionCard.tsx` — recipe detail card
6. Mount NutritionCard in recipe detail page
7. Manual Generate / Regenerate flow

**Do NOT build in this session:**
- Auto-generation at import (Nutrition-2)
- Search filters (Nutrition-3)
- Meal plan integration (Nutrition-4)
- Mobile (Nutrition-5)
- Bulk backfill admin UI (Nutrition-6)
- Admin UI for editing ai_model_config (separate AI Model Management prompt)

---

## 1. DATABASE MIGRATION

File: `supabase/migrations/060_add_nutrition_data.sql`

```sql
-- Nutrition JSONB column
-- NOTE: recipes table already has calories/protein_g/carbs_g/fat_g columns (unused)
-- These legacy columns are left in place. The new nutrition JSONB supersedes them.
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS nutrition JSONB;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS nutrition_generated_at TIMESTAMPTZ;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS nutrition_source TEXT
  CHECK (nutrition_source IN ('ai', 'manual', 'imported'));

-- GIN index for JSONB filter queries (Nutrition-3 will use this)
CREATE INDEX IF NOT EXISTS idx_recipes_nutrition
  ON recipes USING GIN (nutrition jsonb_path_ops);

-- Functional index for calorie range queries
CREATE INDEX IF NOT EXISTS idx_recipes_nutrition_calories
  ON recipes (((nutrition->>'calories_per_serving')::numeric))
  WHERE nutrition IS NOT NULL;

-- AI Model Config table
-- Allows admin to change which Claude model is used for each task without code deploy.
-- Future: admin UI will read/write this table. For now, populated by seed only.
CREATE TABLE IF NOT EXISTS ai_model_config (
  task        TEXT PRIMARY KEY,
  model       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id)
);

-- Seed: matches current hardcoded models so behaviour is unchanged on day 1.
-- IMPORTANT: verify these model strings match what callClaude() currently uses
-- by reading packages/ai/src/client.ts before inserting.
INSERT INTO ai_model_config (task, model, description) VALUES
  ('nutrition',         'claude-haiku-4-5-20251001', 'Recipe nutrition estimation'),
  ('moderation',        'claude-haiku-4-5-20251001', 'Content moderation'),
  ('classification',    'claude-haiku-4-5-20251001', 'Recipe/technique classification'),
  ('translation',       'claude-sonnet-4-6',         'Recipe translation'),
  ('import_extraction', 'claude-sonnet-4-6',         'Recipe extraction from URLs/scans'),
  ('meal_plan',         'claude-sonnet-4-6',         'Meal plan generation'),
  ('dish_recipe',       'claude-sonnet-4-6',         'Generate recipe from dish name'),
  ('cookbook_toc',      'claude-sonnet-4-6',         'Cookbook table of contents extraction'),
  ('speak_recipe',      'claude-sonnet-4-6',         'Voice recipe structuring'),
  ('image_generation',  'replicate/flux-schnell',    'Recipe image generation (Replicate)')
ON CONFLICT (task) DO NOTHING;

-- RLS
ALTER TABLE ai_model_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_model_config" ON ai_model_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can read ai_model_config" ON ai_model_config
  FOR SELECT USING (true);
```

Apply via psql inside the supabase-db container per CLAUDE.md.

**Verify before proceeding:**
```bash
ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
  -c 'SELECT task, model FROM ai_model_config ORDER BY task;'"
```

---

## 2. AI MODEL CONFIG HELPER

Create `packages/ai/src/modelConfig.ts`.

Purpose: `getModelForTask(task: string): Promise<string>` reads from `ai_model_config`
at call time, falling back to hardcoded defaults if the DB is unreachable.

Design principles:
- Use the service role client (same pattern as other packages/ai functions — read client.ts)
- Silently fall back on any error — nutrition generation must never fail because
  the config table is unavailable
- Fallback constants must exactly match the seed data
- Export the fallback map for use in tests

Opus: read client.ts and existing AI functions to find the correct Supabase client
pattern used in this package before implementing.

---

## 3. generateNutrition() FUNCTION

Create `packages/ai/src/generateNutrition.ts`.

**Business rules (non-negotiable):**
- Input: `{ title, servings, ingredients: [{ quantity, unit, ingredient }] }`
- Output: `NutritionEstimate | null` (never throw)
- Returns `null` immediately if ingredients array is empty or missing
- Returns `null` on any Claude or parse error
- Uses `getModelForTask('nutrition')` — never hardcode the model
- maxTokens: 800 (fixed structure JSON, no arrays)
- Apply `jsonrepair` before JSON.parse (existing project pattern — see how other
  functions handle this in packages/ai/src/)

**The Claude prompt must instruct the model to:**
- Estimate per-serving nutrition using USDA reference values
- Estimate total recipe weight in grams to calculate per-100g values
- Return `per_100g: null` and `total_weight_g: null` when weight cannot be
  estimated (soups, drinks, sauces, variable-yield items)
- Assume 4 servings when servings is null or 0
- Return confidence (0.0–1.0) with these defined tiers:
  - 0.9–1.0: precise quantities, standard ingredients
  - 0.7–0.9: most quantities present, minor estimation needed
  - 0.5–0.7: several "to taste" items, variable portions
  - 0.3–0.5: many missing quantities
  - Below 0.3: too uncertain to estimate reliably
- Include a `notes` field explaining assumptions or limitations
- Return ONLY JSON — no markdown, no preamble

**Output type (must match migration schema exactly):**
```typescript
interface NutritionEstimate {
  per_serving: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  };
  per_100g: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  } | null;
  total_weight_g: number | null;
  confidence: number;   // clamped to 0.0–1.0
  notes: string | null;
}
```

Opus: write the full Claude prompt — do not leave placeholder text. The prompt
quality directly determines nutritional accuracy. Use docs/nutrition-design.md
Section 2 as a starting point and improve it. A good prompt here is the difference
between estimates a chef would trust and numbers that feel random.

---

## 4. API ROUTE

Create `apps/web/app/api/recipes/[id]/generate-nutrition/route.ts`

Method: POST. No request body needed.

Requirements:
- Auth: recipe owner OR admin (check admin_users table for admin path)
- Fetch the full recipe including its ingredients (service role client)
- Call generateNutrition() with title, servings, ingredients
- On null return: 422 with a meaningful error message
- On success: write `nutrition`, `nutrition_generated_at`, `nutrition_source: 'ai'`
  to the recipes row, then return the nutrition object
- Match the auth verification pattern and response shape of existing routes in
  apps/web/app/api/recipes/ — read them before writing this one

---

## 5. NutritionCard COMPONENT

Create `apps/web/components/NutritionCard.tsx`

**Design — Trattoria system (ui-guardian.md is mandatory):**
- Card uses cream background `#faf7f0`
- Header "Nutrition Facts" with pomodoro red `#ce2b37` left accent stripe
- Small ✨ icon and "Sous Chef estimate" attribution in the header
- Two-column grid on desktop, single column on mobile
- Must feel native to the existing component library — inspect apps/web/components/
  before designing to match established patterns for cards, skeletons, and buttons

**Data display — 7 values:**
Calories, Protein (g), Carbs (g), Fat (g), Fiber (g), Sugar (g), Sodium (mg)

**Per serving / Per 100g toggle:**
- Pill switcher rendered only when `per_100g !== null`
- Preference persisted in `localStorage` key `'cb-nutrition-toggle'`
- Values update instantly on toggle

**Confidence handling:**
- `confidence >= 0.5` → display values normally
- `confidence < 0.5` → amber warning banner above values:
  *"Not enough information for accurate nutritional values for this recipe."*
  Still render the values below — do not hide them

**States:**
- `nutrition === null` AND owner/admin → "Generate Nutrition" CTA button
- `nutrition === null` AND not owner → render nothing (hide entirely)
- Generating → skeleton shimmer on value cells
- Error → toast, card returns to pre-generate state

**Regenerate:**
- Owner/admin only, small "Regenerate ↻" in card footer
- Updates card values in place on success — no page reload

**Disclaimer — always visible:**
> Estimated by Sous Chef. Not a substitute for professional dietary advice.

Text size xs, muted/secondary colour per Trattoria system.

**Props:**
```typescript
interface NutritionCardProps {
  recipeId: string;
  nutrition: NutritionEstimate | null;
  isOwner: boolean;
  servings: number | null;
}
```

---

## 6. MOUNT IN RECIPE DETAIL PAGE

In `apps/web/app/recipe/[id]/page.tsx`:
- Add `nutrition`, `nutrition_generated_at` to the recipe SELECT query
- Mount `<NutritionCard />` after the Steps section, before Notes/Cooking Notes
- Pass `nutrition`, `isOwner` (already in scope), `recipeId`, `servings`

Read the full page.tsx before touching it. Do not restructure the page — insert
the card cleanly into the existing render flow.

---

## QUALITY BAR

Before calling this done, ask yourself:
- Does NutritionCard look designed by the same team as the rest of the app, or
  does it look like an add-on?
- Is the Claude prompt in generateNutrition() detailed enough to produce estimates
  a home cook would trust?
- Are all error paths handled gracefully — no uncaught exceptions, no broken states?
- Do the model strings in ai_model_config exactly match what client.ts currently uses?
- Is the per-100g toggle truly hidden when `per_100g` is null (soups etc.)?

If any answer is "not quite" — fix it before verification.

---

## VERIFICATION (testing.md is mandatory reading)

TypeScript:
```bash
cd packages/ai && npx tsc --noEmit   # zero errors
cd apps/web && npx tsc --noEmit      # zero errors
```

Live tests against the deployed app — code inspection alone is not sufficient:
1. Recipe with 5+ ingredients → Generate Nutrition button visible (as owner)
2. Click Generate → spinner → card appears with 7 values
3. If per_100g present → toggle visible and switches values correctly
4. Reload page → toggle state restored from localStorage
5. Same recipe in incognito → card shows values, no Generate/Regenerate button
6. Recipe with 0 ingredients → card hidden for non-owner, CTA for owner
7. Low-confidence recipe (minimal ingredients) → amber banner appears with values still visible
8. Regenerate → values refresh in place, no page reload
9. psql confirm → all 10 ai_model_config rows present
10. curl POST as non-owner → 401 or 403 response

---

## DEPLOYMENT

Follow deployment.md exactly. Build on RPi5, PM2 restart, smoke test /, /dashboard,
and at least one /recipe/[id] page.

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION NUTRITION-1]`) must include:
- Migration 060 verified: paste full `SELECT task, model FROM ai_model_config` output
- generateNutrition() live result: paste the actual JSON returned for a real recipe
- curl test of route: show HTTP status and response body
- NutritionCard: describe the recipe used, values shown, whether toggle appeared
- Low confidence path: describe the recipe and what the amber banner showed
- tsc clean: packages/ai and apps/web — zero errors
- Deploy: HTTP 200 on /, /dashboard, /recipe/[any-id]
- EXPLICITLY LIST as SKIPPED: Nutrition-2, 3, 4, 5, 6, and AI Model Management admin UI
