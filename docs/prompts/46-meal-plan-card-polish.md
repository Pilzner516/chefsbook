# ChefsBook — Session 46: Meal Plan Card Polish + Portions Mismatch Warning
# Source: Feature request 2026-04-10
# Target: apps/mobile + apps/web

---

## CROSS-PLATFORM REQUIREMENT — READ FIRST

All three features MUST be implemented on BOTH platforms:
- `apps/mobile` — React Native / Expo
- `apps/web` — Next.js

Both must be fully working before /wrapup.
Read .claude/agents/ui-guardian.md and .claude/agents/data-flow.md before starting.

---

## FIX 1 — Daypart label as a pill (bottom-left, tap to change)

### Current behaviour
The meal type label (BREAKFAST, DINNER, LUNCH, SNACK) shows as plain text overlaid
on the recipe image — it gets lost against busy food photos.

### Fix
Wrap the daypart label in a solid pill positioned at the BOTTOM-LEFT of the recipe
image:

```
Style:
- Background: rgba(0, 0, 0, 0.55)  ← semi-transparent dark
- Text: #ffffff, font-weight 600, font-size 11px, letter-spacing 0.5px
- Border-radius: 20px (full pill)
- Padding: 3px 10px
- Position: absolute, bottom: 8px, left: 8px
- Text: uppercase (BREAKFAST, DINNER etc.)
```

### Tap to change daypart
Tapping the daypart pill opens a small picker:
```
┌─────────────────────┐
│  Change meal type   │
│                     │
│  ○ Breakfast        │
│  ○ Lunch            │
│  ● Dinner  ← current│
│  ○ Snack            │
│                     │
│  [Cancel]  [Save]   │
└─────────────────────┘
```
Selecting a new daypart updates `meal_plans.meal_type` in the DB immediately
and refreshes the card. Toast: "Changed to Lunch".

Apply to both platforms.

---

## FIX 2 — Servings pill (bottom-right, tap to change)

### Target
A servings indicator pill at the BOTTOM-RIGHT of the recipe image:

```
Style:
- Text: "4x Servings"
- Background: rgba(255, 255, 255, 0.9)  ← near-white
- Text color: #1a1a1a
- Font-size: 11px, font-weight 600
- Border-radius: 20px (full pill)
- Padding: 3px 10px
- Position: absolute, bottom: 8px, right: 8px
```

The value comes from `meal_plan.servings`. If null, default to recipe's base
`servings` field.

### Tap to change servings
Tapping the servings pill opens an inline stepper:
```
┌─────────────────────┐
│  Servings           │
│  [−]    4    [+]    │
│  [Cancel]  [Save]   │
└─────────────────────┘
```
Saving updates `meal_plans.servings` in the DB and refreshes the pill immediately.

### Example — both pills on one card
```
┌─────────────────────────────┐
│                             │
│   [recipe image]            │
│                             │
│ [DINNER]      [4x Servings] │  ← both pills at bottom
└─────────────────────────────┘
│ The Pear Pie            [×] │  ← recipe name + remove button below image
└─────────────────────────────┘
```

The × remove button remains as-is below or on the card — do not remove it.

Apply to both platforms.

---

## FIX 3 — Portions mismatch warning when adding day to cart

### Trigger condition
When the user taps the cart icon on a meal plan day card to add all that day's
recipes to a shopping list, check serving counts across all recipes for that day.

Warning triggers when any recipe's serving count differs from another by more than 2x:

```ts
function hasServingsMismatch(meals: MealPlan[]): boolean {
  const servings = meals.map(m => m.servings ?? m.recipe?.servings ?? 4);
  const min = Math.min(...servings);
  const max = Math.max(...servings);
  return max / min > 2;
}
```

### Warning modal
```
┌─────────────────────────────────────────┐
│  ⚠️  Serving sizes don't match          │
│                                         │
│  Your recipes for Tuesday have          │
│  different serving counts:              │
│                                         │
│  • The Pear Pie — 2x Servings          │
│  • Chimichurri Sauce — 8x Servings     │
│                                         │
│  This may affect your shopping list     │
│  quantities. Would you like to add      │
│  them as-is or review first?            │
│                                         │
│  [Review Servings]   [Add Anyway]       │
└─────────────────────────────────────────┘
```

- "Add Anyway" → proceeds to add all items to shopping list
- "Review Servings" → dismisses modal, user adjusts servings via the pills above

Apply to both platforms.

---

## DEPLOYMENT

After all fixes, deploy to RPi5:
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

- [ ] Daypart pill at bottom-left of recipe image (mobile + web)
- [ ] Daypart pill readable over any image colour
- [ ] Tapping daypart pill opens meal type picker
- [ ] Changing daypart updates DB and refreshes card immediately
- [ ] Servings pill shows "4x Servings" at bottom-right of recipe image (mobile + web)
- [ ] Tapping servings pill opens stepper with save/cancel
- [ ] Changing servings updates DB and refreshes pill immediately
- [ ] Both pills positioned at bottom, × remove button unchanged
- [ ] Portions mismatch warning triggers when >2x difference
- [ ] Warning lists recipe names and their serving counts
- [ ] "Add Anyway" proceeds without changes
- [ ] "Review Servings" dismisses modal
- [ ] Safe area insets on all new modals (mobile)
- [ ] i18n keys for all new strings (all 5 locales)
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
