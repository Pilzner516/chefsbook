# Prompt G-FIX — Recipe Status Pills: False Positives + Colour Correction
## Scope: apps/web only. lib/recipeCompleteness.ts + pill styling + notes sweep.

---

## AGENTS TO READ FIRST
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/deployment.md`

---

## BUG 1 — False positives: pills showing on complete recipes

### Symptom
Almost every recipe shows "Missing ingredients & steps" even when ingredients
with quantities and steps are clearly present.

### Root cause
`lib/recipeCompleteness.ts` is checking the wrong field names on the ingredient
objects. The DB stores ingredient quantity as `quantity` (not `amount`) and
ingredient name as `ingredient` (not `name`). This was already discovered and
fixed in the Sous Chef route (prompt B-FIX) — the same mismatch exists here.

### Fix
Before touching any code, inspect the actual shape of an ingredient object by
querying a known-complete recipe:

```sql
SELECT ingredients FROM recipes
WHERE title LIKE '%Marzipan%'
LIMIT 1;
```

Then open `lib/recipeCompleteness.ts` and check every field access on ingredient
objects. Common wrong patterns to look for:

```typescript
// WRONG — these field names likely don't exist
ingredient.amount
ingredient.name
ingredient.quantity_value

// RIGHT — use whatever the SQL query above shows
ingredient.quantity   // likely correct
ingredient.ingredient // likely correct for the name field
```

Fix all field accesses to match the actual DB schema. Do NOT guess — verify
with the SQL query first.

Also check the steps array — verify the field name used to detect step content
matches the actual schema (`\d recipes` or query a recipe with steps).

### After fixing
The completeness helper should return `null` (complete) for any recipe that has:
- 2+ ingredients where `quantity` is non-null and non-zero and non-empty-string
- 1+ steps with actual instruction content

---

## BUG 2 — Pill colour: amber → pomodoro red

### Fix
In the pill component(s) — both on recipe cards and recipe detail hero — change
the incomplete pill background colour from amber (`#f59e0b` / `bg-amber-500`)
to pomodoro red `#ce2b37`.

The "Under Review" pill is already red — the incomplete pill should match.
Both pill types use the same red. The distinction between them is the text and
icon, not the colour.

Search for `amber` or `#f59e0b` or `bg-amber` in the codebase and replace with
`#ce2b37` (inline style) or the equivalent Tailwind custom class if one exists
for the Trattoria red.

---

## BUG 3 — Notes: mixed-case label prefixes missed by SQL sweep

The Prompt E SQL sweep only matched uppercase patterns (`STORAGE:`, `TIP:` etc).
Some recipes have mixed-case prefixes that were missed (`Storage:`, `For the smoothest texture:`).

Run an expanded sweep:

```sql
UPDATE recipes
SET notes = NULL
WHERE notes IS NOT NULL
  AND (
    notes ~* '^(storage|tip|tips|note|notes|multiple|total time|make ahead'
           '|serving|servings|for the|variation|variations|substitut):'
  )
  AND deleted_at IS NULL;
```

The `~*` operator is case-insensitive regex. This catches mixed case.
Report how many rows were updated.

---

## IMPLEMENTATION ORDER
1. Run SQL query to inspect actual ingredient field names
2. Fix `lib/recipeCompleteness.ts` field names
3. Fix pill colour (amber → pomodoro red)
4. Run expanded notes SQL sweep
5. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
6. Deploy per `deployment.md`

---

## TESTING REQUIREMENTS
1. Open My Recipes — recipes with ingredients AND steps show NO pill
2. An actually incomplete recipe (0 ingredients) still shows the red pill
3. Pill colour is `#ce2b37` on both card and detail hero
4. SQL sweep row count reported

## WRAPUP REQUIREMENT
DONE.md entry must include:
- The actual ingredient field names found in the DB (from SQL query)
- What was wrong in recipeCompleteness.ts
- Notes sweep row count
- tsc clean + deploy confirmed
