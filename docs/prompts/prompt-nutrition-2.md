# Prompt: Nutrition-2 — Auto-Generation at Import
# Model: OPUS
# Launch: Read docs/prompts/prompt-nutrition-2.md and execute fully through to deployment.

---

## MANDATORY PRE-FLIGHT — READ BEFORE WRITING ANY CODE

**Project foundation:**
- CLAUDE.md — project context, stack, RPi5 setup
- docs/nutrition-design.md — authoritative architecture document
- docs/agents/import-pipeline.md — how every import path works (critical)
- docs/agents/feature-registry.md
- docs/agents/ai-cost.md
- docs/agents/testing.md
- docs/agents/deployment.md

**Codebase audit — read these before touching anything:**
- packages/ai/src/generateNutrition.ts — the function you will be calling (Nutrition-1)
- apps/web/app/api/recipes/finalize/route.ts — primary wiring point
- apps/web/app/api/import/url/route.ts
- apps/web/app/api/extension/import/route.ts
- apps/web/app/api/speak/route.ts
- apps/web/app/api/import/youtube/route.ts
- apps/web/app/api/cookbooks/import-recipe/route.ts
- apps/web/app/api/recipes/ — scan full directory for any other import-adjacent routes

Understand exactly where each import path saves its final recipe record before
writing a single line of code.

---

## CONTEXT

Nutrition-1 built the foundation: generateNutrition(), the API route, and the
NutritionCard component. Users can currently generate nutrition manually.

Nutrition-2 makes generation automatic — every recipe import triggers nutrition
generation without the user having to do anything. The card simply appears on
the recipe detail page after import.

---

## SCOPE — THIS SESSION ONLY

**Build:**
- Wire generateNutrition() as fire-and-forget after recipe save on all import paths
- Test every import path generates and stores nutrition correctly

**Do NOT build:**
- Search filters (Nutrition-3)
- Meal plan integration (Nutrition-4)
- Mobile (Nutrition-5)
- Bulk backfill (Nutrition-6)
- Any changes to NutritionCard or the manual generate flow

---

## IMPORT PATH MATRIX

Opus: verify this matrix against the actual codebase before implementing.
The design doc may not perfectly reflect the current state of every route.

| Path | Expected wiring point | Timing |
|------|-----------------------|--------|
| URL import | After recipe + ingredients saved | Fire-and-forget |
| Extension import | After recipe + ingredients saved | Fire-and-forget |
| Photo scan (single + multi-page) | After recipe confirmed and saved | Fire-and-forget |
| Speak a Recipe | After recipe structured and saved | Fire-and-forget |
| YouTube import | After transcript extraction and save | Fire-and-forget |
| Cookbook TOC import | After individual recipe saved | Fire-and-forget |
| Manual recipe creation | Skip — no ingredients at creation time | On-demand only |
| Batch bookmark import | Skip — cost/rate concern | On-demand only |

---

## IMPLEMENTATION PATTERN

### Fire-and-forget pattern
Nutrition generation must NEVER block the import response. The user gets their
recipe immediately. Nutrition populates in the background.

```typescript
// After recipe and ingredients are saved — do NOT await
generateAndSaveNutrition(recipeId, recipe).catch(err =>
  console.warn('[import] Nutrition generation failed:', err)
);
```

Create a shared helper `generateAndSaveNutrition(recipeId, recipe)` in a
shared utility location (check where other shared import helpers live).

This helper:
1. Calls generateNutrition({ title, servings, ingredients })
2. If result is non-null, writes nutrition + nutrition_generated_at + nutrition_source
   to the recipe row (service role client)
3. Returns void — caller never awaits it
4. Swallows all errors silently (import success must never depend on nutrition)

### Ingredient availability
Nutrition generation requires a populated ingredients array. Each import path
saves ingredients at slightly different points. Opus: verify that when you wire
the fire-and-forget call, the recipe's ingredients are already written to the DB.
If not, fetch them before calling generateNutrition().

### Avoid double-generation
The manual "Generate Nutrition" button in NutritionCard already works (Nutrition-1).
The auto-generation in this session should check: if `nutrition IS NOT NULL` on
the recipe row, skip generation (recipe was manually generated before auto-wire landed).

---

## GUARDRAILS

- Every import path response time must be IDENTICAL before and after this change.
  Auto-generation is non-blocking by definition. If you find yourself awaiting
  generateNutrition() anywhere in an import route, that is a bug.
- Do not modify the NutritionCard component or the manual generate route.
- Do not modify the generateNutrition() function itself.
- The only new code is: the shared helper + wiring calls in each import route.
- If a route is complex and you are unsure where to insert the call safely,
  describe the uncertainty explicitly rather than guessing.

---

## VERIFICATION

TypeScript:
```bash
cd packages/ai && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

Live tests — test each import path end-to-end:
1. Import a recipe via URL → navigate to recipe detail → NutritionCard appears
   (may take 2–5 seconds after page load as generation runs async)
2. Import via browser extension → same check
3. Import via photo scan → same check
4. Speak a recipe → same check
5. Import from YouTube URL → same check
6. Add a recipe from a cookbook TOC → same check
7. Manual recipe creation → NutritionCard shows "Generate Nutrition" button
   (confirms manual path was correctly skipped)
8. psql verify: `SELECT id, title, nutrition IS NOT NULL as has_nutrition
   FROM recipes ORDER BY created_at DESC LIMIT 10;`
   — all recently imported recipes should show has_nutrition = true

Timing check: import a recipe via URL and measure response time before and
after the route change. Response time must not increase materially.

---

## DEPLOYMENT
Follow deployment.md. Build on RPi5, PM2 restart, smoke test.

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION NUTRITION-2]`) must include:
- List every import path wired (with file names)
- List every import path explicitly skipped and why
- psql output showing 5+ recently imported recipes with has_nutrition = true
- Description of one live import test (which URL, did card appear)
- Confirmation that import response time was not affected
- tsc clean: packages/ai and apps/web
- Deploy confirmed: HTTP 200
- EXPLICITLY LIST as SKIPPED: Nutrition-3, 4, 5, 6
