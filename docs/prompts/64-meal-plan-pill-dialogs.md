# ChefsBook — Session 64: Fix Meal Plan Pill Dialogs
# Source: QA screenshots 2026-04-11
# Target: apps/web (meal plan day cards)

---

## CONTEXT

The meal plan day card pills (daypart and servings) open native browser
prompt() dialogs instead of styled ChefsDialog components. Both must be
replaced with the unified ChefsBook dialog style.

Read .claude/agents/ui-guardian.md and .claude/agents/deployment.md before
starting.

---

## FIX 1 — Daypart pill: replace prompt() with ChefsDialog pill buttons

### Current behaviour
Tapping the daypart pill (DINNER, BREAKFAST etc.) opens a native browser
`prompt()` asking "Type: breakfast, lunch, dinner, or snack".

### Target behaviour
Opens a `ChefsDialog` with 4 pill buttons — one per meal type:

```
┌─────────────────────────────────────────┐
│  Change meal type                       │
│  "Fried Chicken Ramen"                  │
│─────────────────────────────────────────│
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │Breakfast │  │  Lunch   │            │
│  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌──────────┐            │
│  │  Dinner  │  │  Snack   │            │
│  └──────────┘  └──────────┘            │
│                                         │
│              [Cancel]                   │
└─────────────────────────────────────────┘
```

- Current meal type button is highlighted (pomodoro red background, white text)
- Other buttons are outline style (red border, red text)
- Tapping any button: updates meal_plans.meal_type in DB, closes dialog,
  refreshes the pill on the card
- Cancel: dismisses without change
- Use the existing `ChefsDialog` component from session 47

---

## FIX 2 — Servings pill: replace prompt() with ChefsDialog stepper

### Current behaviour
Tapping the servings pill opens a native browser `prompt()` asking for
a number.

### Target behaviour
Opens a `ChefsDialog` with the `−` / count / `+` stepper — matching the
design already used when adding a recipe to the meal plan (Image 3):

```
┌─────────────────────────────────────────┐
│  Servings                               │
│  "Fried Chicken Ramen"                  │
│─────────────────────────────────────────│
│                                         │
│         [−]    4    [+]                 │
│                                         │
│  [Cancel]              [Save]           │
└─────────────────────────────────────────┘
```

- `−` decrements (min 1), `+` increments (max 20)
- Current servings value pre-filled
- Save: updates meal_plans.servings in DB, closes dialog, refreshes pill
- Cancel: dismisses without change
- Use the existing `ChefsDialog` component

---

## ALSO CHECK MOBILE

These same pill tap interactions were built for mobile in session 46.
Verify they also use the correct styled components (not Alert.alert or
native prompts). If mobile uses native dialogs, apply the same fix using
the mobile `ChefsDialog` component.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Verify on chefsbk.app:
- Tap daypart pill → styled ChefsDialog with 4 meal type buttons appears
- Tap servings pill → styled ChefsDialog with stepper appears
- Both update DB correctly and refresh the pill on the card
- No native browser prompt() dialogs anywhere on the meal plan page

---

## COMPLETION CHECKLIST

- [ ] Daypart pill opens ChefsDialog with 4 pill buttons (not prompt())
- [ ] Current meal type highlighted in dialog
- [ ] Selecting meal type updates DB and refreshes pill immediately
- [ ] Servings pill opens ChefsDialog with − / count / + stepper (not prompt())
- [ ] Stepper pre-filled with current servings value
- [ ] Save updates DB and refreshes pill immediately
- [ ] Cancel dismisses without changes
- [ ] Mobile verified — same interactions use styled dialogs
- [ ] No native prompt() or Alert.alert() remaining on meal plan cards
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
