# Prompt L — Smart Completeness Banner + Visibility Enforcement
## Scope: apps/web (recipe detail page, completeness system, one-time DB sweep)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ui-guardian.md`
8. `.claude/agents/data-flow.md`
9. `.claude/agents/import-pipeline.md`

Run ALL pre-flight checklists before writing a single line of code.
Inspect: `\d recipes` `\d user_profiles`
Read `lib/recipeCompleteness.ts` and `packages/db/src/queries/completeness.ts`
fully before writing any code.

---

## CONTEXT

Currently incomplete recipes can remain public (set before enforcement
existed). The system warns but doesn't enforce. This session:
1. Merges the two warning banners into one smart banner
2. Enforces completeness on every save — system forces private if failing
3. Auto-restores visibility when recipe is fixed
4. Sweeps all existing public incomplete recipes to private
5. Locks the Private badge when system-enforced

---

## FEATURE 1 — Merged smart banner

### Remove
- The existing `RefreshFromSourceBanner` component (incomplete warning)
- Any separate "blocked from publishing" banner

### Replace with one smart banner: `RecipeStatusBanner`

The banner shows when:
- Recipe fails completeness gate (missing ingredients, quantities, steps,
  title, or description), OR
- Recipe is flagged/under review (`moderation_status = 'flagged'` or
  `ai_recipe_verdict` is flagged)

The banner is OWNER-ONLY — never show to other users viewing a public recipe.

#### Banner variants

**Incomplete — missing ingredients/quantities/steps:**
```
⚠️  This recipe can't be published yet
    [specific reason — e.g. "It's missing ingredients with quantities."]
    Your Sous Chef can help fill in the gaps — your existing edits are preserved.

    [🔄 Refresh from source]  [📋 Paste {field}]  [✨ Sous Chef]
```

**Incomplete — missing title or description:**
```
⚠️  This recipe can't be published yet
    It's missing a title or description.

    [✏️ Edit title]  [✏️ Edit description]
```
(No Sous Chef button for title/description — user must edit directly)

**Flagged/under review:**
```
🔍  This recipe is under review by Chefsbook
    Our team is reviewing this recipe. You'll be notified when it's cleared.
    In the meantime, it's only visible to you.
```
(No action buttons — nothing for user to do)

#### Dynamic reason text
Build the reason from `missing_fields` or the completeness helper:
- `{quantities}` → "It's missing ingredient quantities."
- `{ingredients}` → "It's missing ingredients (minimum 2)."
- `{ingredients, steps}` → "It's missing ingredients and steps."
- `{steps}` → "It's missing steps."
- `{description}` → "It's missing a description."
- `{title}` → "It's missing a title."

#### Action buttons
Reuse the existing button handlers from `RefreshFromSourceBanner`.
The "Paste" button label adapts: "Paste ingredients", "Paste steps" etc.
based on what's missing.

#### Styling
- Same amber warning style as the existing banner for incomplete
- Use pomodoro red `#ce2b37` background for flagged/under review
- Position: same as existing banner (below photo strip, above title)
- Owner-only: wrap in `{isOwner && <RecipeStatusBanner ... />}`

---

## FEATURE 2 — System-enforced visibility on every save

### The rule
After ANY field is saved on a recipe (title, description, ingredients,
steps, notes, tags), the system must:

1. Re-run `checkRecipeCompleteness(recipeId)` server-side
2. Update `missing_fields` and `is_complete` in the DB
3. If recipe FAILS completeness:
   - If `visibility = 'public'`: SET `visibility = 'private'`,
     SET `system_locked = true` (see migration below)
   - If already private: just update `missing_fields`
4. If recipe PASSES completeness:
   - SET `is_complete = true`, clear `missing_fields`
   - If `system_locked = true`:
     - Read user's default visibility from `user_profiles.default_recipe_visibility`
       (or `'public'` if not set)
     - SET `visibility = user_default`
     - SET `system_locked = false`
   - If not system_locked: leave visibility unchanged (user may have
     manually set it)

### New column: `system_locked`
```sql
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS
  system_locked BOOLEAN DEFAULT FALSE;
```
Apply migration on RPi5, restart supabase-rest.

`system_locked = true` means the system forced this recipe private due
to completeness failure. It is NOT the same as user-chosen private.

### Where to add the re-check
Find every API route or server action that saves recipe fields. The
stale missing_fields fix session may have already added some of these —
check DONE.md first. Add the completeness re-check + system_locked
logic to each save handler that doesn't already have it:
- Save title
- Save description  
- Save ingredients (replaceIngredients)
- Save steps (replaceSteps)
- Save notes
- Add/remove tags

Create a shared server-side helper `enforceCompleteness(recipeId, userId)`
that runs the full check + visibility enforcement. Call it from each
save handler rather than duplicating logic.

---

## FEATURE 3 — Locked Private badge UX

When `recipe.system_locked = true`:
- The Private badge is visually locked — show a 🔒 icon, greyed style
- Clicking it does NOT open the visibility toggle
- Instead shows a tooltip or small inline message:
  *"Complete this recipe to publish it"*
- The existing ChefsDialog enforcement (from Prompt G) can be removed
  from the Private badge click handler — `system_locked` replaces it

When `recipe.system_locked = false` and recipe is complete:
- Private badge works normally (user can toggle)

---

## FEATURE 4 — One-time sweep

After deploying the above, run a one-time sweep on RPi5 to enforce
the new rules on all existing recipes:

```sql
-- Step 1: Find all public recipes that fail completeness
-- (missing_fields is not empty OR is_complete = false)
-- Set them to private and system_locked

UPDATE recipes
SET visibility = 'private',
    system_locked = true
WHERE visibility = 'public'
AND (
  is_complete = false
  OR (missing_fields IS NOT NULL AND array_length(missing_fields, 1) > 0)
);
```

Report how many recipes were updated.

Also re-run `checkRecipeCompleteness` for all recipes to ensure
`missing_fields` and `is_complete` are current. If a batch re-evaluation
function exists, use it. If not, this can be done via the admin
refresh-incomplete endpoint if one exists — check DONE.md.

---

## REGRESSION CHECKS — MANDATORY

After deploying, verify ALL of the following:
1. Incomplete recipe detail page shows the merged smart banner ✓
2. Banner shows correct specific reason text ✓
3. Sous Chef, Refresh, Paste buttons all work from the new banner ✓
4. Flagged recipe shows the red "under review" banner variant ✓
5. Complete recipe shows NO banner ✓
6. Saving ingredients on an incomplete recipe → re-check runs →
   if now complete, visibility auto-restores ✓
7. system_locked recipe: Private badge is locked, tooltip shows ✓
8. My Recipes grid images still show ✓
9. Search page images still show ✓
10. Recipe detail page images still show ✓

---

## IMPLEMENTATION ORDER
1. Apply `system_locked` migration on RPi5, restart supabase-rest
2. Create `enforceCompleteness()` server helper
3. Wire `enforceCompleteness()` into all save handlers
4. Build `RecipeStatusBanner` component (replaces RefreshFromSourceBanner)
5. Update recipe detail page to use new banner
6. Update Private badge to respect `system_locked`
7. Run one-time sweep SQL
8. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
9. Deploy per `deployment.md`

---

## GUARDRAILS
- `system_locked` is ONLY set/cleared by the server — never by client code
- User can NEVER override `system_locked = true` to make recipe public
- Auto-restore uses user's default visibility preference, not always public
- The merged banner replaces BOTH existing banners — delete the old components
  only after the new one is wired and tested
- Never show the banner to non-owners viewing a public recipe
- All save handlers must call `enforceCompleteness()` — no exceptions

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Migration applied confirmed
- `enforceCompleteness()` file path
- List of all save handlers updated
- One-time sweep row count
- All 10 regression checks confirmed
- tsc clean + deploy confirmed
