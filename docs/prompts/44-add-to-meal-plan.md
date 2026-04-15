# ChefsBook — Session 44: Add to Meal Plan from Recipe Detail
# Source: Feature request 2026-04-10
# Target: apps/mobile + apps/web
# Depends on: existing meal plan infrastructure (sessions 06, 27)

---

## CROSS-PLATFORM REQUIREMENT — READ FIRST

This feature MUST be implemented on BOTH platforms:
- `apps/mobile` — React Native / Expo
- `apps/web` — Next.js

Both must be fully working before /wrapup.
Read .claude/agents/ui-guardian.md and .claude/agents/data-flow.md before starting.
Run both pre-flight checklists before writing any code.

---

## FEATURE OVERVIEW

A "+ Meal Plan" button on the recipe detail page opens a bottom sheet (mobile) or
modal (web) that lets the user pick a week, day, meal type, and serving count,
then adds the recipe to their meal plan. Colour-coded slots show availability at a
glance.

**Plan gate:** Chef plan and above only. Free users see upgrade prompt.

---

## PRE-REQUISITE — Remove duplicate Share button

### Problem
The web recipe detail header currently shows TWO Share buttons:
1. An old Share button (correct `< Share` icon) that only copies a link to clipboard
2. A new Share button (wrong icon) that opens the 3-option dropdown

### Fix
1. Remove the OLD Share button (clipboard-only) entirely
2. Keep ONLY the new Share dropdown button
3. Give the new Share dropdown button the correct `< Share` icon from the old button
4. Final web header action row after this fix:
   `Dashboard | Share | Print | + Meal Plan | Favourite | Re-import | Delete`

---

## BUTTON PLACEMENT

### Mobile
Add "+ Meal Plan" to the mobile recipe detail action bar using the calendar icon
(`calendar-outline` from Ionicons). The mobile action bar should be:
`♡ | share | 📌 | ✏️ | 📅`

The existing full-width "Add to Shopping List" button below remains unchanged.

### Web
After removing the duplicate Share button above, add "+ Meal Plan" to the web
header action row using a calendar icon, styled consistently with other action buttons.

---

## THE PICKER MODAL/SHEET

### Layout

```
┌─────────────────────────────────────────┐
│  Add to Meal Plan              [✕]      │
│─────────────────────────────────────────│
│                                         │
│  ◀  Week of Apr 7 – Apr 13  ▶          │
│                                         │
│  Day                                    │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │Mon │ │Tue │ │Wed │ │Thu │ │Fri │   │
│  │ 7  │ │ 8  │ │ 9  │ │10  │ │11  │   │
│  └────┘ └────┘ └────┘ └────┘ └────┘   │
│  ┌────┐ ┌────┐                         │
│  │Sat │ │Sun │                         │
│  │12  │ │13  │                         │
│  └────┘ └────┘                         │
│                                         │
│  Meal type                              │
│  ┌──────────┐┌──────────┐              │
│  │Breakfast ││  Lunch   │              │
│  └──────────┘└──────────┘              │
│  ┌──────────┐┌──────────┐              │
│  │  Dinner  ││  Snack   │              │
│  └──────────┘└──────────┘              │
│                                         │
│  Servings                               │
│  [−]    4    [+]                        │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │         Add to Plan             │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## COLOUR CODING

### Day slots
Query `meal_plans` for the selected week to know which day+meal combinations
are already filled.

- **Green** (`#009246` basil green, light fill) — day has at least one meal slot empty
- **Red** (`#ce2b37` pomodoro red, light fill) — ALL meal slots for this day are filled
- **Today** — add a subtle "Today" label below the date number

### Meal type slots (shown after day is selected)
After the user taps a day, update the meal type pills to show:
- **Green** — this day + meal type has no recipes yet
- **Red** — this day + meal type already has at least one recipe
- **Selected** — darker filled version of whichever colour applies

### Colour logic
```ts
// For a given week, fetch existing meal_plans:
const existingMeals = await getMealPlanForWeek(weekStart);

// For each day + meal type combination:
const isOccupied = (date: string, mealType: string) =>
  existingMeals.some(m => m.date === date && m.meal_type === mealType);
```

---

## CONFLICT WARNING

When the user taps a **red** meal type slot (already occupied):

```
┌─────────────────────────────────────────┐
│  Slot already has a recipe              │
│                                         │
│  Tuesday · Dinner already has           │
│  1 recipe. You can add another          │
│  (e.g. a starter or dessert) or         │
│  pick a different slot.                 │
│                                         │
│  [Add Anyway]    [Pick Another Slot]    │
└─────────────────────────────────────────┘
```

- "Add Anyway" → proceeds to servings stepper and saves
- "Pick Another Slot" → dismisses warning, user can tap a different day/meal type

The warning is informational only — multiple recipes per slot is allowed.

---

## SERVINGS STEPPER

- Default: recipe's `servings` field (base serving count)
- Min: 1, Max: 20
- `[−]` and `[+]` buttons with the number displayed between them
- Same stepper component already built in session 06 — reuse it

---

## SAVING

On "Add to Plan":
```ts
await addMealToPlan({
  recipe_id: recipe.id,
  date: selectedDate,        // ISO date string e.g. "2026-04-08"
  meal_type: selectedMealType, // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  servings: selectedServings,
  user_id: currentUser.id
});
```

After saving:
- Close the modal/sheet
- Show toast: "Added to [Day] · [Meal Type]" e.g. "Added to Tuesday · Dinner"
- Refresh the meal plan store so the plan page reflects the new entry immediately

---

## PLAN GATE

Chef plan and above only. If Free user taps "+ Meal Plan":
```
┌─────────────────────────────────────────┐
│  🔒 Chef Plan Required                  │
│                                         │
│  Adding recipes to your meal plan       │
│  requires the Chef plan or above.       │
│                                         │
│  [See Plans]        [Maybe Later]       │
└─────────────────────────────────────────┘
```

---

## DEPLOYMENT

After implementing, deploy to RPi5:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] "+ Meal Plan" button on mobile recipe detail (Chef+ gated)
- [ ] "+ Meal Plan" button on web recipe detail (Chef+ gated)
- [ ] Week navigator (back/forward) with correct date range label
- [ ] Day slots colour-coded green/red based on existing meals
- [ ] "Today" label on current day
- [ ] Meal type slots colour-coded green/red for selected day
- [ ] Conflict warning shown when red slot tapped ("Add Anyway" / "Pick Another")
- [ ] Servings stepper defaults to recipe base servings
- [ ] Saves to meal_plans table correctly
- [ ] Toast confirmation shown after save
- [ ] Meal plan store refreshed immediately after save
- [ ] Free users see upgrade prompt
- [ ] Safe area insets on mobile bottom sheet
- [ ] i18n keys for all new strings (all 5 locales)
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
