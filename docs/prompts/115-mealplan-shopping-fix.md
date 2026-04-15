# ChefsBook — Session 115: Meal Plan Bug + Shopping Consolidated List Formatting
# Items 8, 13: recipe not appearing in meal plan, consolidated list wrong format
# Target: apps/web + apps/mobile

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, data-flow.md, ui-guardian.md
and ALL mandatory agents per SESSION START sequence before touching anything.

Two fixes. Diagnose with real DB data before touching code.

---

## FIX 1 — Adding recipe to meal plan from recipe detail does not show on plan page

When a user adds a recipe to a meal plan day from the recipe detail page
(using the meal plan button), the operation appears to succeed but the
recipe does not appear on the meal plan page for that day.

### Diagnose
1. SSH to RPi5 and check if the meal plan insert is actually happening:
```sql
-- Check meal_plans table for recent entries
SELECT id, recipe_id, day_date, meal_type, servings, user_id, created_at
FROM meal_plans
ORDER BY created_at DESC LIMIT 10;

-- Verify the recipe exists in the plan for today or recent days
SELECT mp.day_date, mp.meal_type, r.title, mp.servings
FROM meal_plans mp
JOIN recipes r ON r.id = mp.recipe_id
WHERE mp.user_id = (SELECT id FROM user_profiles WHERE username = 'pilzner')
ORDER BY mp.day_date DESC LIMIT 10;
```

2. Find the MealPlanPicker component on web and mobile:
   - What does it call when the user confirms?
   - Does it return a success state?
   - Is there an error being swallowed silently?

3. Find the meal plan page:
   - What query does it use to fetch meals for a day?
   - Is the date format consistent? (Day off-by-one was fixed in session 30
     but check if it regressed)
   - Is the user_id being passed correctly?

### Fix
Based on diagnosis, fix the root cause. Common issues:
- Date timezone mismatch: plan page queries UTC date, picker inserts local date
- user_id not passed correctly in the insert
- Silent error in the mutation that leaves the DB unchanged
- Query on plan page not including recently added meals

Verify: add a recipe to Tuesday from recipe detail, navigate to plan page,
confirm it appears on Tuesday.

---

## FIX 2 — Consolidated store list: formatting does not match individual lists

The "All [Store]" combined view was upgraded in session 96 but still
does not match individual list formatting. Specifically:
- Ingredient list column is too narrow, text wraps badly
- The layout does not match the 6-column grid used in individual lists

### Reference implementation
The individual list format uses:
- 6-column CSS grid: checkbox | purchase_unit | qty | name | recipe source | delete
- Purchase unit: prominent, left-aligned, red accent color
- Quantity + unit: in green below the ingredient name
- Recipe source: muted text showing which recipe the item came from
- Checkboxes: local-only check-off
- View mode toggle: Dept / Recipe / A-Z
- Font size toggle: A / A+ / A++
- Department grouping with section headers

### Fix
Find the consolidated store list component (web + mobile).
Rewrite its item row to use the IDENTICAL layout as the individual list:

Web:
- Use the same CSS grid as individual list items
- Ensure the grid has correct column widths (not auto/fr that causes wrapping)
- The name column must be wide enough to show ingredient names without wrapping
  on typical screen sizes

Mobile:
- Use the same row layout as individual list items
- Purchase unit prominent on left in red
- Ingredient name + usage amount below in green
- Recipe source in muted text

Both platforms must also have:
- View mode toggle (Dept / Recipe / A-Z)
- Font size toggle
- "All [Store] — combined from: List 1, List 2, List 3" banner at top

Do NOT build a different layout — copy the exact component structure
from the individual list and adapt it for the combined view data shape.

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

- [ ] Meal plan insert confirmed happening in DB (psql verification)
- [ ] Root cause of plan page not showing identified
- [ ] Adding recipe from recipe detail → appears on meal plan page for correct day
- [ ] Date/timezone handling verified correct
- [ ] Consolidated list uses identical column layout as individual list
- [ ] No ingredient name wrapping on typical screen widths
- [ ] Purchase unit displayed in red accent (same as individual list)
- [ ] View mode toggle works on consolidated list
- [ ] Font size toggle works on consolidated list
- [ ] Banner shows source list names
- [ ] Same fixes applied on mobile
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
