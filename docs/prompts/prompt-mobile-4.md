# Prompt: Mobile-4 — Meal Plan Nutritional Goals + Daily Summary
# Model: OPUS
# Launch: Read docs/prompts/prompt-mobile-4.md and execute fully.

---

## MANDATORY PRE-FLIGHT

Read ALL of these:
- CLAUDE.md
- apps/mobile/CLAUDE.md
- docs/agents/feature-registry.md — find Nutrition-4 (meal plan) entry
- docs/agents/testing.md — ADB screenshots mandatory
- docs/agents/ui-guardian.md

**Codebase audit — read before writing anything:**
- apps/web/app/dashboard/plan/ — web meal plan wizard with Nutritional Goals step (reference)
- apps/mobile/app/(tabs)/plan.tsx (or wherever the mobile meal plan lives) — read fully
- packages/ai/src/generateMealPlan.ts — the function already accepts nutrition goals
  (wired in Nutrition-4 web session)
- apps/mobile/components/NutritionCard.tsx — the nutrition display pattern to follow

**Launch emulator:**
```bash
emulator -avd Medium_Phone_API_36.1 -no-snapshot -gpu host
```
Navigate to the Plan tab. ADB screenshot of current meal plan UI as baseline.

---

## SCOPE — TWO FEATURES

1. Optional Nutritional Goals step in the mobile meal plan wizard
2. Daily nutrition summary row in the generated plan display

These are the exact same features that Nutrition-4 added to web.
The AI function (`generateMealPlan`) already accepts nutrition goal parameters.
This session is purely mobile UI wiring.

---

## FEATURE 1 — Nutritional Goals Step in Mobile Meal Plan Wizard

**Web reference:** Read the web MealPlanWizard to understand the goals step.
The mobile wizard may be structured differently — adapt, don't copy-paste web JSX.

**What to build:**
Add an optional "Nutritional Goals" step to the mobile meal plan generation flow.

**Inputs (match web exactly):**
- Daily calorie target — numeric text input with keyboard type "numeric"
- Macro priority — segmented control or picker:
  None | High Protein | Low Carb | Balanced
- Max calories per meal — numeric text input (optional, can be blank)

**UI rules:**
- Clearly labelled as optional — "Skip" button visible throughout
- If user skips or leaves all blank: meal plan generates exactly as before
- Minimum touch targets 44px for all inputs and buttons
- Use existing mobile wizard/modal pattern — don't introduce new navigation

**Passing goals to generateMealPlan:**
When user proceeds with goals set, pass them to the API call:
```typescript
nutritionGoals: {
  calorieTarget: number | null,
  macroPriority: 'none' | 'high_protein' | 'low_carb' | 'balanced',
  maxCaloriesPerMeal: number | null
}
```
The web API route already handles this — the mobile app just needs to send it.

**ADB screenshots:** Goals step UI, skip state, filled-in state

---

## FEATURE 2 — Daily Nutrition Summary in Plan Display

**Web reference:** After plan generates, each day shows a summary row:
`Day 1 total: ~1,820 kcal  |  Protein: 95g  |  Carbs: 210g  |  Fat: 68g`

**What to build:**
Below each day's meals in the mobile plan display, add a summary row showing
the daily nutrition totals.

**Data source:**
The generateMealPlan response now includes `daily_summaries` and
`estimated_nutrition` per meal (added in Nutrition-4).
Check the actual response shape by reading `packages/ai/src/generateMealPlan.ts`.

**Display rules:**
- Show only when at least one meal in the day has nutrition data
- Prefix all values with `~` (estimated)
- Compact single-line display — this is supporting info, not the focus
- Muted colour (textSecondary from theme) so it doesn't compete with recipe cards
- Format: `~1,820 kcal · 95g protein · 210g carbs · 68g fat`

**ADB screenshots:** Plan with daily summary rows visible, plan without
goals set (summary should still show if data available)

---

## GUARDRAILS

- Do not change web files or the generateMealPlan AI function
- If the mobile plan screen uses a different data structure than expected,
  read it carefully and adapt — do not force the web data shape onto mobile
- All inputs must be dismissible with keyboard done/return
- Goals are optional — if the user generates without setting goals, the plan
  must work identically to pre-Mobile-4 behaviour (no regression)
- useTheme().colors always

---

## TYPESCRIPT CHECK
```bash
cd apps/mobile && npx tsc --noEmit
```

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION MOBILE-4]`) must include:
- Goals step: ADB screenshot filenames (UI visible, filled state)
- Daily summary: ADB screenshot showing summary rows in generated plan
- Confirmed no-goals path works identically to before (describe test)
- tsc clean confirmed
- EXPLICITLY LIST as SKIPPED: Mobile-5 (nutrition search filters)
