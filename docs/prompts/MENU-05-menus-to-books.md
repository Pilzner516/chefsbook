# Prompt: ChefsBook Menus — Add All to Cookbook & Menu Chapter Template (Web + Mobile)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/MENU-05-menus-to-books.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — WEB (primary) + MOBILE (partial)

## Prerequisites

Sessions MENU-01 and MENU-02 must be complete. Confirm in DONE.md:
- `menus` and `menu_items` tables exist
- My Menus feature is live on web and mobile
- Print cookbook feature exists at `/dashboard/print-cookbook/`
- Existing cookbook recipe-add flow is understood (check feature-registry.md)

---

## Overview

This session delivers two related capabilities:

**1. "Add all filtered results to a book"** — A universal cookbook feature. Anywhere
recipes are shown in a filtered/searched list (by tag, cuisine, ingredient, etc.), users
can batch-add all results to a cookbook in one action. Menus are the primary trigger
for this (filter by restaurant tag → add all to book), but the capability is general.

**2. Menu chapter template in Print Cookbook** — The print cookbook book builder gains
a new organisation mode: **"By Menu"**. Instead of organising recipes by category, the
book is organised by menu/occasion, each becoming a chapter with a dedicated opening page.

Both features work together to let a user turn a collection of menus into a beautifully
printed book — e.g. *"Restaurants of Paris 2024"* or *"Our Special Occasions"*.

**Available to:** All users (batch add); Pro users (print cookbook — existing gate).

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/deployment.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/publishing.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read the existing print cookbook page: `apps/web/app/dashboard/print-cookbook/[id]/page.tsx`
2. Read `apps/web/lib/book-layout.ts` — understand `BookLayout`, `PageSizeKey`, existing types
3. Read all 6 existing PDF template files in `apps/web/lib/pdf-templates/` — understand the
   template structure, `FillZone`, and how recipes are rendered per page
4. Read `apps/web/app/dashboard/recipes/page.tsx` (or wherever the recipe list/search lives)
   — understand the existing filter/search pattern
5. Read `packages/db/src/queries/menus.ts` — confirm `getUserMenus()` is available
6. Run `\d cookbooks` on RPi5 — confirm `recipe_ids` column type (UUID[])
7. Confirm next available migration number from DONE.md
8. Confirm how existing cookbook recipe-add currently works (single add vs batch)

---

## PART 1: "Add all filtered results to a book" (Universal Feature)

### Where it appears

This button appears on the web recipe list/search page whenever a filter or tag is
active — i.e. when the user is viewing a filtered subset of their recipes, not all recipes.

Trigger conditions (ANY of these makes the button appear):
- A tag filter is active (one or more tags selected)
- A cuisine filter is active
- A search query is active with results
- A `is_inspired_by_menu` filter is active (future use)

### The button

Placement: in the filter results bar / results header, next to the result count.

```
Showing 8 recipes tagged "Café Flora"    [Add all to cookbook ↗]
```

Button label: `"Add all to cookbook"`
Style: secondary pill button, consistent with existing filter bar actions.

### Behaviour on click

1. Check if the user has any cookbooks. If none: show `ChefsDialog` prompt:
   `"You don't have a cookbook yet. Create one first in Print Cookbook."` with a
   link to `/dashboard/print-cookbook`.

2. If cookbooks exist: show a cookbook picker bottom sheet / popover listing the user's
   cookbooks (title + recipe count). User selects one.

3. Show a confirmation dialog (ChefsDialog):
   `"Add all [N] recipes to [Cookbook Title]? Duplicates will be skipped."`
   Buttons: `"Add [N] Recipes"` (primary) | `"Cancel"`

4. On confirm: call a new API route (see below) that batch-adds all recipe IDs in the
   current filtered set to the selected cookbook's `recipe_ids` array, deduplicating.

5. Success toast: `"[N] recipes added to [Cookbook Title]"` (or `"[N] added, [M] already in book"`)

### API route

Create `apps/web/app/api/cookbooks/[id]/batch-add-recipes/route.ts`:

```typescript
// POST
// Body: { recipe_ids: string[] }
// Action: append recipe_ids to cookbooks.recipe_ids[], deduplicate, preserve existing order
// New recipes appended to the end
// Returns: { added: number, skipped: number, total: number }
// Auth: user must own the cookbook
// Use supabaseAdmin to perform the array update safely
```

### Mobile (partial)

On mobile, the "Add all to cookbook" action appears on the Tag detail view
(if one exists — check navigator.md) or on the My Menus detail screen's
**"Add to Cookbook"** button (already specified in MENU-02).

The mobile flow uses the same API route via a fetch call. Implement only if
a tag filter view exists on mobile. If not, note in AGENDA.md.

---

## PART 2: Menu chapter organisation in Print Cookbook (Web only)

### Concept

The print cookbook builder currently organises recipes by the order the user
arranges them (drag to reorder). This session adds an alternative organisation mode:
**"Organise by Menu"** — where each Menu the user has becomes a chapter in the book.

### Book settings panel changes

In the book builder settings panel, add a new **"Organisation"** selector:

- `"Manual order"` (default, existing behaviour — drag to reorder)
- `"By Menu"` (new) — organise recipes into chapters by their originating menu

When "By Menu" is selected:
- The recipe drag list is hidden
- A new menu chapter list appears showing the user's menus that contain recipes
  already added to the book
- The user can reorder the menu chapters (drag to reorder)
- Within each chapter, recipes appear in `COURSE_ORDER` sequence
- Recipes not belonging to any menu are placed in a final chapter: `"Other Recipes"`

Store the organisation mode in `BookLayout`:

```typescript
// In apps/web/lib/book-layout.ts
export type BookOrganisation = 'manual' | 'by_menu';

// Add to BookLayout interface:
organisation: BookOrganisation;  // default: 'manual'
menu_chapter_ids?: string[];     // ordered menu IDs when organisation = 'by_menu'
```

### Menu chapter opening page (new PDF template component)

Create a reusable `MenuChapterPage` component in `apps/web/lib/pdf-templates/`:

```typescript
// apps/web/lib/pdf-templates/MenuChapterPage.tsx
// Props:
//   menuTitle: string          — the menu name (e.g. "Café Flora" or "Christmas Eve 2024")
//   occasion?: string          — the occasion tag (e.g. "Dinner Party")
//   menuNotes?: string         — the user's notes on this menu
//   recipeCount: number        — number of recipes in this chapter
//   chapterNumber: number      — e.g. "Chapter 2"
//   template: TemplateStyle    — uses the active template's accent colour + typography
```

The chapter opening page layout:
- Full-page decorative layout matching the active template style
- Large chapter number (e.g. `"II"` in Roman numerals or `"2"`)
- Menu title as the chapter heading (large, prominent)
- Occasion tag in a small pill or italicised subtitle
- Menu notes in a text block (if present)
- Number of recipes: `"5 Recipes"`
- Decorative divider or ornament from the template's visual language
- ChefsBook small logo / footer credit at page bottom

Each of the 6 existing templates (trattoria, studio, garden, heritage, nordic, bbq)
must render this `MenuChapterPage` using its own accent colour and typography.
Follow the exact same pattern as the existing `FillZone` component integration
in those template files.

### PDF generation changes

In the PDF generation pipeline, when `organisation = 'by_menu'`:

1. After the title page and table of contents, insert chapters in `menu_chapter_ids` order
2. Each chapter: `MenuChapterPage` opening page → then recipes for that menu in COURSE_ORDER
3. Append an `"Other Recipes"` chapter at the end if any book recipes are not in any menu
4. Update the table of contents to list chapter names (menu titles) not recipe titles

When `organisation = 'manual'`: existing behaviour unchanged.

### Table of contents format for "By Menu" organisation

```
Contents

  Chapter I    Café Flora                              3
  Chapter II   Christmas Eve 2024                     12
  Chapter III  Our Anniversary                        19
  Chapter IV   Other Recipes                          26
```

### Menu picker UI in book builder

When "By Menu" is selected and the user has menus, show a card per menu that has
overlapping recipes with the cookbook. Each card shows:
- Menu title + occasion
- `"[N] recipes from this menu are in this book"`
- Drag handle (reorder chapters)
- If a menu has no recipes in the book: show it greyed out with
  `"No recipes from this menu are in this book yet"` — it is excluded from the PDF

---

## i18n additions

Add to `menus` namespace:

```json
{
  "menus": {
    "add_all_to_cookbook": "Add all to cookbook",
    "add_all_confirm": "Add all {{count}} recipes to {{cookbook}}? Duplicates will be skipped.",
    "add_all_success": "{{added}} recipes added to {{cookbook}}",
    "add_all_partial": "{{added}} added, {{skipped}} already in book",
    "no_cookbooks_yet": "You don't have a cookbook yet. Create one first in Print Cookbook.",
    "organise_by": "Organise by",
    "manual_order": "Manual order",
    "by_menu": "By Menu",
    "chapter": "Chapter",
    "other_recipes": "Other Recipes",
    "recipes_in_chapter": "{{count}} recipes from this menu are in this book",
    "no_recipes_in_chapter": "No recipes from this menu are in this book yet"
  }
}
```

---

## TypeScript

Run `npx tsc --noEmit` in `apps/web` before wrapup. Zero errors required.
The `MenuChapterPage` component must type-check cleanly with the existing template types.

---

## Testing

### Batch add to cookbook
- Apply a tag filter on the recipe list → `"Add all to cookbook"` button appears ✓
- With no filter active → button does NOT appear ✓
- Click → cookbook picker appears with correct cookbook titles ✓
- Confirm → API adds recipes to `cookbooks.recipe_ids`, deduplicating ✓
- Success toast shows correct count ✓
- Repeat with same filter → "X added, Y already in book" ✓

### psql verification (batch add)
```sql
SELECT recipe_ids FROM cookbooks WHERE id = '<test_cookbook_id>';
-- Confirm the array contains the expected recipe IDs after batch add
```

### Menu chapter organisation
- Open print cookbook builder for a cookbook with recipes from multiple menus ✓
- Switch organisation to "By Menu" → chapter list appears ✓
- Chapters show correct recipe counts ✓
- Drag to reorder chapters ✓
- "Generate" → PDF renders with chapter opening pages ✓
- Each chapter opening page shows menu title, occasion, notes ✓
- Table of contents lists chapter names ✓
- Recipes within chapter appear in COURSE_ORDER ✓
- Recipes not in any menu appear in "Other Recipes" chapter ✓
- Switch back to "Manual order" → existing behaviour unchanged ✓

### Template verification
All 6 templates must render `MenuChapterPage` without errors:
- Trattoria ✓
- Studio ✓
- Garden ✓
- Heritage ✓
- Nordic ✓
- BBQ ✓

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5.
Run regression smoke test from `testing.md` before wrapup.
Verify the existing print cookbook flow still works (no regressions on "Manual order").

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md record:
- "Add all filtered results to cookbook" batch-add shipped
- `/api/cookbooks/[id]/batch-add-recipes` route created
- `BookOrganisation` type + `by_menu` mode added to `book-layout.ts`
- `MenuChapterPage` component created and integrated into all 6 templates
- Menu chapter organisation mode in book builder UI shipped

In feature-registry.md update:
- `cookbook-batch-add-recipes` — status: COMPLETE
- `cookbook-menu-chapter-template` — status: COMPLETE
- `cookbook-by-menu-organisation` — status: COMPLETE

This is the final session in the Menus feature set. In AGENDA.md mark the
Menus feature group as COMPLETE and note any deferred items (mobile batch add,
web Step by Step in Menu Mode if deferred from MENU-04).
