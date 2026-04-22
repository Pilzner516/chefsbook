# Prompt K-FIX — Status Pills: Show specific reason not generic "Incomplete"
## Scope: apps/web only. lib/recipeCompleteness.ts, dashboard card component.

---

## AGENTS TO READ FIRST
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/deployment.md`

---

## BUG

Recipe cards on the dashboard all show "⚠ Incomplete" as the pill text.
They should show the specific reason, e.g.:
- "⚠ Missing ingredients & steps"
- "⚠ Missing quantities"
- "⚠ Missing steps"
- "⚠ Missing ingredients"
- "⚠ Missing title or description"

## ROOT CAUSE

`getIncompletePillFromDB()` is likely returning a generic "Incomplete"
string instead of reading the specific values from the `missing_fields`
array.

## FIX

### Step 1 — Inspect what missing_fields actually contains
Run on RPi5:
```sql
SELECT title, missing_fields 
FROM recipes 
WHERE missing_fields IS NOT NULL 
AND array_length(missing_fields, 1) > 0
LIMIT 10;
```
Report the exact values stored (e.g. 'ingredients', 'steps', 'quantities',
'title', 'description').

### Step 2 — Fix getIncompletePillFromDB()
Update the function to map the missing_fields array to a human-readable
pill text using this mapping:

```typescript
const fieldLabels: Record<string, string> = {
  'ingredients': 'Missing ingredients',
  'steps': 'Missing steps',
  'quantities': 'Missing quantities',
  'title': 'Missing title or description',
  'description': 'Missing title or description',
};
```

Build the pill text from the actual fields present:
- If both 'ingredients' and 'steps' missing → "Missing ingredients & steps"
- If only 'quantities' → "Missing quantities"
- If only 'steps' → "Missing steps"
- If only 'ingredients' → "Missing ingredients"
- If 'title' or 'description' → "Missing title or description"
- Fallback (unknown values): "Incomplete"

### Step 3 — Verify the pill text on the recipe detail page also uses
specific text (not just the card). Check recipeCompleteness.ts
getIncompletePillText() function — it should already do this but verify
it matches the same mapping.

---

## TESTING
1. Open My Recipes — pills show specific reasons, not generic "Incomplete"
2. Spanish Paella shows "⚠ Missing quantities"
3. A recipe with no steps shows "⚠ Missing steps"

## WRAPUP
DONE.md entry must include the SQL output from Step 1 and confirmation
pills show specific text. Deploy confirmed.
