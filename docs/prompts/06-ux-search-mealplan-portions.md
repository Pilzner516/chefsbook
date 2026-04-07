# ChefsBook — Session: UX Improvements — Search, Meal Plan & Portions
# Source: QA Report 2026-04-07 · Items 13, 17, 18
# Target: apps/mobile (primary)

---

## CONTEXT

Three UX improvements for discoverability and completeness of the meal planning and search experience. Read CLAUDE.md and the navigator agent map before starting.

---

## FEATURE 1 — Search category cards open a popup/modal (Item 13)

### Current behaviour
When the user taps a search category card (e.g. Cuisine, Course, Source, Tags), the filter options appear below the card row, which is hard to discover and feels cluttered.

### Target behaviour

1. Tapping any search category card opens a **bottom sheet modal** (not inline expansion).
2. The bottom sheet contains:
   - A title (the category name, e.g. "Filter by Cuisine")
   - A scrollable list of filter options, each as a selectable row with a checkmark when active.
   - A search input at the top if the option list is long (>8 items) — e.g. for Cuisine.
   - A "Clear" text button (top-right of the sheet) to deselect all options in this category.
   - An "Apply" button at the bottom to confirm the selection and close the sheet.
3. Active filters from this category should be shown as pills below the card row (existing behaviour) — this can remain as-is.
4. Use the same bottom sheet component pattern already in use elsewhere in the app (e.g. language selector, meal picker).

---

## FEATURE 2 — AI Meal Plan Wizard on mobile (Item 17)

### Current behaviour
The AI Meal Plan Wizard (4-step modal: Days & Meals → Preferences → Sources → Review) exists on the web app but is absent from the mobile Meal Plan screen.

### Target behaviour

Bring the AI Meal Plan Wizard to mobile:

1. On the Meal Plan screen (mobile), add an **"AI Plan"** button in the header or as a prominent call-to-action when the week is empty. Style it consistently with other AI feature buttons in the app (e.g. the Auto-tag button uses Claude-branded styling).

2. Tapping "AI Plan" opens the wizard as a full-screen modal (or a multi-step bottom sheet if that fits better). The 4 steps:

   **Step 1 — Days & Meals**
   - Which days to plan (Mon–Sun toggles, all selected by default)
   - Which meal types per day (Breakfast / Lunch / Dinner / Snack checkboxes)

   **Step 2 — Preferences**
   - Dietary preferences (free text or quick-select chips: vegetarian, vegan, gluten-free, dairy-free, low-carb, etc.)
   - Cuisine preferences (free text or quick-select chips: Italian, Asian, Mediterranean, etc.)
   - Effort level (Quick <30min / Medium 30–60min / Full project)

   **Step 3 — Sources**
   - Options: "From my recipes only", "Include public recipes", "Let AI suggest anything"
   - If "From my recipes only" or "Include public recipes": Claude will attempt to match from the DB before generating.

   **Step 4 — Review**
   - Show the generated plan in a card layout (day → meal slot → recipe name)
   - Each slot has a "Swap" button to regenerate just that slot
   - "Remove" button to remove a slot
   - "Save Plan" button at the bottom to save all slots to the meal plan for the selected week

3. **API call:** Use the existing `@chefsbook/ai` meal plan generation function. If it doesn't exist yet, create it following the same pattern as `generateAiChefSuggestion()`. The prompt should be:
   - Input: days, meal types, preferences, cuisine, effort, source preference, and (if sourcing from user recipes) a JSON list of the user's recipe titles + IDs.
   - Output: structured JSON mapping day → meal type → `{ recipe_title, recipe_id (if matched), description }`.

4. After saving, the meal plan week view updates to show all generated meals.

---

## FEATURE 3 — Portions prompt when adding a meal to a plan day (Item 18)

### Current behaviour
When a recipe is added to a meal plan day, no portion count is requested — it defaults to the recipe's default serving size.

### Target behaviour

After the user selects a recipe and a meal type (Breakfast/Lunch/Dinner/Snack) in the meal add bottom sheet:

1. Show a **portions/servings input** before the final "Add to plan" confirmation:
   - Label: "How many servings?"
   - A `+` / `-` stepper with a numeric display. Min: 1, Max: 20. Default: recipe's base serving count (from the recipe's `servings` field).
   - Small helper text: "Recipe makes [N] servings"
2. The selected portion count is saved on the `meal_plans` row. Add a `servings` column if not already present:
   - Migration `015_meal_plan_servings.sql`: `ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS servings INTEGER DEFAULT 1;`
   - Apply to RPi5.
3. The portion count feeds into "Add day to cart" (shopping list integration) — when calculating ingredient quantities for the shopping list, multiply by `meal_plan.servings / recipe.base_servings`. This should flow naturally through the existing `addItemsWithPipeline()` logic if the quantity multiplier is passed correctly.

---

## COMPLETION CHECKLIST

Before wrapping:
- [ ] Search category cards open a bottom sheet modal with filter options
- [ ] Bottom sheet has search input for long lists, Clear button, Apply button
- [ ] Active filter pills still show below card row as before
- [ ] AI Meal Plan Wizard button added to mobile Meal Plan screen
- [ ] All 4 wizard steps implemented (Days, Preferences, Sources, Review)
- [ ] Swap/Remove per slot in Review step
- [ ] Save Plan writes all slots to meal_plans table for the selected week
- [ ] Portions stepper shown in meal add bottom sheet
- [ ] `servings` column added to `meal_plans` (migration 015, applied to RPi5)
- [ ] Portion count flows through to shopping list quantity calculation
- [ ] No regressions in meal plan week view, existing meal add/remove flows
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
