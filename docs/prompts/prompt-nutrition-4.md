# Prompt: Nutrition-4 — Meal Plan Integration
# Model: OPUS
# Launch: Read docs/prompts/prompt-nutrition-4.md and execute fully through to deployment.

---

## MANDATORY PRE-FLIGHT — READ BEFORE WRITING ANY CODE

**Project foundation:**
- CLAUDE.md
- docs/nutrition-design.md — Section 6 covers meal plan integration
- docs/agents/feature-registry.md
- docs/agents/ai-cost.md
- docs/agents/testing.md
- docs/agents/deployment.md
- docs/agents/ui-guardian.md

**Codebase audit — critical reading:**
- apps/web/app/dashboard/plan/ — full directory, understand current meal plan UI
- apps/web/app/api/meal-plan/ — the generation route
- packages/ai/src/ — find generateMealPlan() and read it fully
- The MealPlanWizard component (find it in the plan directory)
- How generated meal plans are stored and displayed

Understand the full meal plan flow end-to-end before designing the changes.

---

## CONTEXT

Nutrition-1/2/3 built the card, auto-generation, and search filters.
Nutrition-4 closes the loop: users can set nutritional goals before generating
a meal plan, and the generated plan shows a daily nutrition summary.

---

## SCOPE — THIS SESSION ONLY

**Build:**
- Optional "Nutritional Goals" step in MealPlanWizard
- Update generateMealPlan() prompt to respect nutritional goals
- Daily nutrition summary row in the generated plan display

**Do NOT build:**
- Mobile meal plan changes (Nutrition-5)
- Bulk backfill (Nutrition-6)
- Any changes to NutritionCard, import pipeline, or search filters

---

## FEATURE DESIGN

### Nutritional Goals step in MealPlanWizard

Add an optional step to the wizard (after existing steps, before generation).
The step is clearly marked as optional — users can skip it entirely.

**Goal inputs:**

| Input | Type | Example |
|-------|------|---------|
| Daily calorie target | Number input | 1800 |
| Macro priority | Single select | None / High Protein / Low Carb / Balanced |
| Max calories per meal | Number input (optional) | 600 |

Keep the UI simple. Three inputs maximum. If the user skips or leaves blank,
meal plan generates exactly as it did before (no regression).

### generateMealPlan() prompt changes

When nutritional goals are provided, append goal constraints to the existing prompt:

```
NUTRITIONAL GOALS (respect these when selecting recipes):
- Daily calorie target: {calorieTarget} kcal
- Macro priority: {macroPriority}
- Max calories per meal: {maxCaloriesPerMeal} kcal (if specified)

When choosing recipes, prefer those whose nutrition data aligns with these goals.
If a recipe's nutrition is unknown, use your best judgement based on the recipe title
and ingredients. Aim for the daily target across all meals — breakfast lighter,
dinner can be larger.
```

Opus: read the full existing generateMealPlan() prompt before modifying.
Append to it — do not rewrite the existing prompt logic.

### Daily nutrition summary in plan display

After the generated meal plan renders (7 days × meals), add a daily summary row
for each day showing estimated totals:

```
Day 1 total: ~1,820 kcal  |  Protein: 95g  |  Carbs: 210g  |  Fat: 68g
```

Data source:
- For recipes with nutrition data in DB: use stored values
- For AI-generated plan recipes not yet in DB: Claude will include estimated
  nutrition in the plan response (update the response schema to request it)
- Show "~" prefix on all values to signal estimates

Design: subtle summary bar below each day's meals, muted styling, does not
compete with the recipe cards. Trattoria system colours only.

### Response schema change

The generateMealPlan() function currently returns a structured plan.
Extend the response to include per-meal nutrition estimates:

```typescript
interface MealPlanMeal {
  // existing fields...
  estimated_nutrition?: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
}
```

Opus: examine the actual current response schema before designing the extension.
The `?` makes this optional so existing plans without nutrition still render correctly.

---

## GUARDRAILS

- Nutritional goals are entirely optional. If no goals are set, meal plan
  generation behaviour must be IDENTICAL to before this change.
- Do not change how meal plans are stored — only the generation prompt and display.
- The daily summary should only appear when at least one meal in the day has
  nutrition data. If all meals lack data, hide the summary row for that day.
- Do not modify NutritionCard, import pipeline, search, or any other nutrition session.

---

## VERIFICATION

TypeScript:
```bash
cd packages/ai && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

Live tests:
1. Generate a meal plan with NO nutritional goals set → plan identical to before ✓
2. Generate a meal plan with 1800 kcal daily target + High Protein →
   - Plan generates successfully
   - Daily summary rows appear below each day's meals
   - Calorie totals are visible
3. Generate a plan with Low Carb priority → recipes skew toward low-carb options
4. Skip the Nutritional Goals step entirely → same as test 1
5. Existing meal plans (pre-Nutrition-4) render without errors → no regressions

---

## DEPLOYMENT
Follow deployment.md. Build on RPi5, PM2 restart, smoke test.

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION NUTRITION-4]`) must include:
- Screenshot description: what the Nutritional Goals step looks like in the wizard
- Description of a generated plan with goals set (which goals, did summary appear)
- Confirmed no-goals path is identical to pre-change behaviour
- tsc clean: packages/ai and apps/web
- Deploy confirmed: HTTP 200
- EXPLICITLY LIST as SKIPPED: Nutrition-5, 6
