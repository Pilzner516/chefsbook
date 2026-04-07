# ChefsBook — Session: Recipe Versioning System + Auto-tag Multi-select
# Source: QA Report 2026-04-07 · Items 7, 8, 10 (versioning)
# Target: apps/mobile (primary), apps/web (parity flags)

---

## CONTEXT

Two related features that change how a recipe card works and how tags are applied. The versioning system is a significant architectural addition — read this prompt in full before starting. Read CLAUDE.md and the navigator agent map before touching any screens.

---

## FEATURE 1 — Recipe Versioning System (Items 7, 10)

### Concept

A single recipe card (e.g. "Belgian Waffles") can have multiple versions (e.g. Version 1 — original, Version 2 — gluten-free adaptation). The recipe card in the list is the parent entry; tapping it shows sub-cards for each version. Each version has its own full recipe detail.

### DB schema

Create `packages/db/migrations/014_recipe_versions.sql`:

```sql
-- Add version support to recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS parent_recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS version_label TEXT; -- e.g. "Original", "Gluten-Free", "Quick Version"
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_parent BOOLEAN DEFAULT false;

-- Index for fast child lookup
CREATE INDEX IF NOT EXISTS idx_recipes_parent ON recipes(parent_recipe_id);
```

**Existing recipes:** All existing recipes are implicitly version 1 of themselves. No migration of existing data needed — they simply have `parent_recipe_id = NULL` and `version_number = 1`.

**Parent concept:** When a recipe gets its first additional version:
- The original recipe is marked `is_parent = true`.
- The new version is a new row with `parent_recipe_id` pointing to the original, `version_number = 2`.
- The parent recipe's detail view acts as the "Version 1" view.

Apply migration to RPi5.

### Recipe card UI — version pill (Item 7)

On the recipe card in list/grid views:
- If `is_parent = true` (i.e. it has child versions), show a small pill badge on the card: `"2 versions"` or `"3 versions"` (count = 1 parent + N children).
- Style: small rounded pill, subtle — use `colors.accentSoft` background and `colors.accent` text, 10px font, positioned at bottom-right of card or below the title.
- Do not show the pill on single-version recipes.

### Recipe card — version sub-cards (Item 10)

When the user taps a recipe card that has multiple versions:
- Instead of going directly to the recipe detail, show a **version picker bottom sheet** (or expand-in-place if bottom sheet feels too heavy).
- The version picker shows one sub-card per version:
  - Version number (e.g. "Version 1", "Version 2")
  - Version label (e.g. "Original", "Gluten-Free")
  - Short description or first line of notes (truncated to 1 line)
  - Created date
- Tapping a sub-card opens that version's full recipe detail.
- The picker also includes an **"Add new version"** button at the bottom (see below).

For single-version recipes: tapping the card goes directly to detail as before (no change).

### Adding a new version

When viewing a recipe detail that is a parent (or single-version recipe that could become one):
- Show an **"Add version"** button in the edit options menu (three-dot menu or edit mode action bar). This is only visible when `is_parent = true` OR when `version_number === 1` (i.e. any recipe can start a version family).
- Tapping "Add version" launches the **import flow** but pre-filled with:
  - The same recipe title (with "(Version 2)" appended by default, editable)
  - `parent_recipe_id` set to the current recipe
  - `version_number` auto-incremented
- The user can import a new version via URL, scan, speak, or manual entry — all import paths apply.
- After saving the new version, the original recipe is automatically marked `is_parent = true`.

### Recipe detail — version context

When viewing a versioned recipe:
- Show a small version indicator near the title: e.g. `"Version 2 of 3 · Gluten-Free"`.
- Tapping the indicator opens the version picker to switch between versions.
- The "Add version" option in the menu is always available when viewing any recipe in a version family.

---

## FEATURE 2 — Auto-tag multi-select (Item 8)

### Current behaviour
When Claude returns auto-tag suggestions, the user can only select one tag. Tapping a tag selects it immediately without allowing multiple selections.

### Target behaviour

1. When the auto-tag API returns suggestions (5–8 tags as green dashed pills):
   - All pills start in an **unselected** state (dashed border, light background).
   - Tapping a pill **toggles** it: selected = solid background, filled, checkmark icon or visual change. Unselected = back to dashed.
   - The user can select as many or as few as they want.

2. Add a **"Add selected tags"** confirm button below the pills (or in the header/action bar of the auto-tag section). This button is disabled until at least one tag is selected.

3. Tapping "Add selected tags":
   - Adds all selected tags to the recipe's tag list.
   - Runs the same deduplication/sanitization as single-tag add (lowercase, no special chars, no duplicates).
   - Dismisses the auto-tag suggestion row.

4. A **"Dismiss"** or "Skip" text link next to the confirm button lets the user ignore all suggestions without adding any.

5. The existing manual "Add Tag" input remains unchanged and works independently of the auto-tag flow.

---

## WEB PARITY FLAGS

Add `// TODO(web): add recipe version sub-cards to recipe list cards` in the web recipe card component.
Add `// TODO(web): add version picker UI on recipe detail` in the web recipe detail page.
Add `// TODO(web): auto-tag should support multi-select` in the web tag manager component if it has the same single-select limitation.

---

## COMPLETION CHECKLIST

Before wrapping:
- [ ] Migration 014 created and applied to RPi5
- [ ] `parent_recipe_id`, `version_number`, `version_label`, `is_parent` columns live in DB
- [ ] Version pill shows on recipe cards with multiple versions
- [ ] Version picker bottom sheet opens when tapping a multi-version card
- [ ] "Add version" button in edit menu launches import flow with parent pre-set
- [ ] Version indicator shown on recipe detail when versioned
- [ ] Single-version recipes: no change to existing tap behaviour
- [ ] Auto-tag pills support multi-select with toggle state
- [ ] "Add selected tags" confirm button appears after auto-tag returns results
- [ ] Deduplication and sanitization applied to all selected tags on confirm
- [ ] No regressions in existing tag add/remove or recipe detail navigation
- [ ] Web parity TODO comments added
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
