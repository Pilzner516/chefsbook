# ChefsBook — Session 96: Shopping List + Meal Plan Fixes
# Source: Live review — combined shopping list formatting + servings warning
# Target: apps/web + apps/mobile

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, data-flow.md, ui-guardian.md,
deployment.md, and testing.md per SESSION START sequence.

Check feature-registry.md before touching any existing shopping or meal plan feature.

---

## FIX 9 — Meal plan: servings mismatch warning when adding recipe

This feature was specified in session 46 (portions mismatch warning) but
only triggers when adding a day to the shopping cart. It must ALSO trigger
when adding a recipe to a meal plan day directly from recipe detail.

Scenario: A meal plan day already has a recipe with 6 servings. The user
adds a new recipe from that recipe's detail page. If the new recipe has
a different serving count (e.g. 2), warn the user:

"This recipe serves 2, but other recipes on [Day] serve 6. Do you want
to adjust the servings before adding?"

Show a ChefsDialog (never native Alert) with:
- The warning message showing both serving counts
- "Adjust servings" button — opens the servings stepper before confirming
- "Add anyway" button — adds with original serving count
- "Cancel" button

This applies to both web (MealPlanPicker modal) and mobile (MealPlanPicker
bottom sheet). Check what serving counts are already on the target day
before confirming the add.

---

## FIX 13 — Combined shopping list: match individual list formatting

The "All [Store]" combined view (session 73) shows a flat merged list
without the formatting and features of individual lists.

The combined view must match individual list formatting exactly:

1. Checkboxes on each item (check off items as you shop)
2. Department grouping (same 13 departments as individual lists)
3. View mode toggle: Dept / Recipe / A-Z (same as individual lists)
4. Font size toggle (same A / A+ / A++ cycle as individual lists)
5. Purchase unit displayed prominently (same red accent style)
6. Usage amount shown in green below item name
7. Recipe source shown for each item (which recipe it came from)
8. Manual item add button
9. Read-only banner: "Combined view — items from [List 1], [List 2], [List 3]"

The combined view should feel identical to an individual list, just with
a banner explaining it aggregates multiple lists.

Apply the same fixes to BOTH web and mobile combined views.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Only restart PM2 if build exits with code 0.

---

## COMPLETION CHECKLIST

- [ ] Servings mismatch warning appears when adding recipe to meal plan day from recipe detail
- [ ] Warning shows both serving counts and day name
- [ ] ChefsDialog with Adjust / Add anyway / Cancel options
- [ ] Servings stepper opens correctly on "Adjust servings"
- [ ] Combined shopping list has checkboxes, department grouping, view modes
- [ ] Combined list font size toggle works
- [ ] Combined list shows purchase unit (red) and usage amount (green)
- [ ] Combined list shows recipe source per item
- [ ] Combined list banner shows source list names
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
