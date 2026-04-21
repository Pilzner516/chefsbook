# Prompt G — Recipe Status Pills: Incomplete + Under Review Overlays
## Scope: apps/web only. Recipe cards (My Recipes grid) + recipe detail hero image.

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

Run ALL pre-flight checklists before writing a single line of code.
Inspect the recipes table schema before writing any queries: `\d recipes`

---

## CONTEXT

When a user clicks "Review now →" on the My Recipes dashboard, they see their
incomplete recipes — but currently most cards give no visual indication of what is
wrong. We are adding a status pill overlay on the image container of both recipe
cards and the recipe detail hero, so the issue is immediately visible at a glance.

There are two distinct pill types:

1. **Incomplete pill** (amber/yellow) — recipe does not meet the completeness gate
2. **Under Review pill** (red) — recipe has been flagged by AI or a proctor

---

## PILL DESIGN

### Placement
- **Absolutely positioned** over the image container div — NOT embedded in the image
- Bottom-centre of the image container
- `position: absolute`, `bottom: 8px`, `left: 50%`, `transform: translateX(-50%)`
- The image container must have `position: relative` (check before adding — may already be set)
- z-index above the image but below the lock icon (top-right)

### Incomplete pill style
- Background: amber `#f59e0b` (or Tailwind `bg-amber-500`)
- Text: white, `text-xs`, `font-medium`
- Padding: `px-3 py-1`
- Border radius: `rounded-full` (pill shape)
- Icon: `⚠` or a small warning icon from the existing icon library
- Text: see copy rules below

### Under Review pill style
- Background: pomodoro red `#ce2b37`
- Text: white, `text-xs`, `font-medium`
- Padding: `px-3 py-1`
- Border radius: `rounded-full`
- Icon: `🔍` or a small shield/review icon
- Text: *"Under Review by Chefsbook"*

### Incomplete pill copy rules
Determine the pill text based on what is actually missing. Priority order
(show the most critical gap first if multiple exist):

| Condition | Pill text |
|---|---|
| No ingredients at all | ⚠ Missing ingredients |
| Ingredients exist but all quantities are 0 or null | ⚠ Missing quantities |
| Steps missing | ⚠ Missing steps |
| Both ingredients and steps missing | ⚠ Missing ingredients & steps |
| Ingredients have quantities but < 2 ingredients | ⚠ Missing ingredients |

---

## WHERE TO SHOW PILLS

### 1. Recipe card (My Recipes grid)

Find the recipe card component used in the My Recipes grid. The image container
already has the lock icon as an absolute overlay (top-right). Add the status pill
to the same container at bottom-centre.

Show the pill on recipe cards when:
- Recipe is incomplete (does not pass completeness gate), OR
- Recipe has `flagged = true` or equivalent flagged/review status column
  (check actual column name in recipes table: `\d recipes`)

**The pill should be visible regardless of which filter is active** — not just
when the "Incomplete" filter is selected. If a user is browsing "All" recipes
and one is incomplete, the pill still shows.

### 2. Recipe detail hero image

On the recipe detail page (`apps/web/app/recipe/[id]/page.tsx`), the hero image
is displayed in a container. Add the same pill overlay to this container.

Show on detail page when:
- Recipe is incomplete, OR
- Recipe is flagged/under review

The detail page already shows a warning banner for incomplete recipes. The pill
is additive — both the banner AND the pill show. The pill grabs attention on the
image; the banner explains what to do.

---

## ENFORCEMENT RULE — Cannot make public if incomplete or flagged

When the owner clicks the **"Private" badge** on the recipe detail page to toggle
visibility to public:

If the recipe is **incomplete** (does not pass completeness gate):
- Block the action
- Show a ChefsDialog (not a toast) with:
  - Title: *"Recipe can't be published yet"*
  - Message: *"This recipe is missing required information. [specific issue — e.g.
    'Add at least 2 ingredients with quantities and 1 step'] before it can be
    shared with the Chefsbook community."*
  - Single button: **"Got it"** (primary)

If the recipe is **flagged/under review**:
- Block the action
- Show a ChefsDialog with:
  - Title: *"Recipe is under review"*
  - Message: *"This recipe is currently being reviewed by Chefsbook. You'll be
    able to publish it once the review is complete."*
  - Single button: **"Got it"** (primary)

If the recipe passes both checks: proceed with the existing visibility toggle
as normal.

Also apply this enforcement to the **bulk Make Public** action (from Prompt F,
if already shipped): if any selected recipes are incomplete or flagged, exclude
them from the bulk update and show a toast: *"[N] recipe(s) couldn't be made
public — they have incomplete or flagged content."*

Check whether Prompt F has been deployed before adding the bulk enforcement.
If Prompt F is not yet deployed, add a TODO comment in the bulk-visibility
route noting that enforcement should be added when Prompt G ships.

---

## COMPLETENESS GATE DEFINITION

A recipe passes the completeness gate if ALL of the following are true:
- `title` is not null/empty
- `description` is not null/empty
- `ingredients` array has 2 or more items
- At least 2 ingredients have a non-null, non-zero `quantity`
- `steps` array has 1 or more items

Use a shared helper function for this check — do not duplicate the logic in
multiple places. Create `lib/recipeCompleteness.ts` (or add to an existing
utils file if one exists) and export:

```typescript
export function getRecipeIncompleteReason(recipe: RecipeData): string | null
// Returns null if complete, or a human-readable reason string if incomplete
// e.g. "Missing ingredients", "Missing quantities", "Missing steps"

export function isRecipeComplete(recipe: RecipeData): boolean
// Returns true if recipe passes all completeness checks
```

Import this helper in both the recipe card component and the recipe detail page.

---

## FLAGGED/UNDER REVIEW DETECTION

Check the recipes table schema for the column that stores moderation/flag status:
`\d recipes`

Common candidates: `flagged`, `moderation_status`, `is_flagged`, `review_status`

Use whatever column exists. If it's a boolean `flagged`, check `recipe.flagged === true`.
If it's a status enum, check for the relevant value.

Report in DONE.md what the actual column name is.

---

## IMPLEMENTATION ORDER

1. Inspect `\d recipes` — identify the flagged/review column name
2. Create `lib/recipeCompleteness.ts` with the shared helper
3. Add pill overlay to the recipe card component
4. Add pill overlay to the recipe detail hero image container
5. Add enforcement block to the Private badge toggle on recipe detail
6. Check if Prompt F is deployed — if yes, add bulk enforcement; if no, add TODO comment
7. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
8. Deploy per `deployment.md`

---

## GUARDRAILS

- Pills are CSS overlays on the image CONTAINER — never modify image files or URLs
- Do NOT remove the existing warning banner on the recipe detail page — pills are additive
- Do NOT show pills on recipes owned by other users (public recipe views) — owner-facing only
- The lock icon (top-right) must remain unaffected — check z-index ordering
- Use ChefsDialog for enforcement blocks — never native browser confirm/alert
- The shared completeness helper must be the single source of truth — no duplicated gate logic

---

## TESTING REQUIREMENTS

Before marking done, verify in the browser:

1. My Recipes grid: an incomplete recipe shows the amber pill bottom-centre of its card image
2. My Recipes grid: a flagged recipe shows the red "Under Review" pill
3. Recipe detail: incomplete recipe shows amber pill on the hero image
4. Recipe detail: flagged recipe shows red pill on the hero image
5. Recipe detail: clicking Private badge on incomplete recipe → blocked with ChefsDialog
6. Recipe detail: completing a recipe (adding ingredients + steps) → pill disappears
7. Lock icon position unchanged — no z-index conflict with pill
8. Complete recipes show no pill

---

## WRAPUP REQUIREMENT

DONE.md entry must include:
- The flagged/review column name found in the recipes table
- Whether Prompt F bulk enforcement was added or a TODO comment left
- Confirmation that `lib/recipeCompleteness.ts` was created (or existing utils extended)
- tsc clean confirmed
- Deploy confirmed
- Screenshot description of pill visible on a recipe card and on the detail hero
