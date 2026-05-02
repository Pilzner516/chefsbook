# Prompt: ChefsBook Menus — Enhancements: Card Images, Add to Menu, Multi-Select (Web + Mobile)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/MENU-06-enhancements.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: ENHANCEMENT — WEB + MOBILE

## Prerequisites

Sessions MENU-01 through MENU-05 must be complete. Confirm in DONE.md before starting:
- `menus` and `menu_items` tables exist with RLS
- My Menus list + detail pages exist on web and mobile
- `packages/db/src/queries/menus.ts` has `getUserMenus()`, `createMenu()`, `addMenuItem()`

---

## Overview

Three focused enhancements to the existing My Menus feature:

1. **Menu card images** — Each menu card displays a cover image. The user can choose
   from photos belonging to recipes already in that menu, or upload a custom image
   from their computer/gallery.

2. **"Add to Menu" on recipe detail** — Every recipe detail page (web + mobile) gets
   an "Add to Menu" action button. The user picks an existing menu or creates a new one,
   then selects which course to place the recipe in.

3. **Multi-select batch "Add to Menu"** — On the recipe list/grid (web + mobile), a
   Select mode allows the user to tick multiple recipe cards and add them all to a menu
   at once. Course assignment happens inside the menu detail after adding, not at
   selection time.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/image-system.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/deployment.md`
- `.claude/agents/navigator.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Run `\d menus` on RPi5 — confirm current columns before adding `cover_image_url`
2. Run `\d menu_items` on RPi5 — confirm column names
3. Read `apps/web/app/dashboard/menus/page.tsx` — understand existing menu card structure
4. Read `apps/mobile/app/(tabs)/menus.tsx` — understand existing mobile menu card structure
5. Read `apps/web/app/dashboard/menus/[id]/page.tsx` — understand detail page layout
6. Read `apps/mobile/app/menu/[id].tsx` — understand mobile detail screen
7. Read `apps/web/app/recipe/[id]/page.tsx` — understand recipe detail action buttons (web)
8. Read `apps/mobile/app/recipe/[id].tsx` (or equivalent) — understand mobile recipe detail
9. Confirm how recipe images are fetched — `getPrimaryPhotos()` + `getRecipeImageUrl()` pattern
10. Confirm the existing recipe multi-select pattern if any (check dashboard recipe grid)
11. Confirm next available migration number from DONE.md

---

## Database migration

### Add `cover_image_url` to `menus`

```sql
ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
```

This stores either:
- A URL from an existing `recipe_user_photos` row (chosen from the menu's recipes)
- A URL from a newly uploaded image in Supabase Storage bucket `menu-covers`

After migration: `docker restart supabase-rest`

### Supabase Storage bucket

Create a new bucket `menu-covers` if it does not already exist:
- Public read access (so images render without auth headers)
- Path pattern: `menu-covers/{menu_id}/{filename}`

Check if the bucket creation needs to be done via the Supabase Studio UI or via
migration SQL — follow the existing pattern used for `recipe-user-photos` bucket.

### Query update

In `packages/db/src/queries/menus.ts`, update:
- `createMenu()` — accept optional `cover_image_url`
- `updateMenu()` — accept optional `cover_image_url`
- `getUserMenus()` — include `cover_image_url` in the SELECT

---

## PART 1: Menu card images

### Web — menu list page (`/dashboard/menus`)

Each menu card currently shows title, occasion, course count, and date.
Add a **cover image area** at the top of each card.

**Display logic:**
- If `cover_image_url` is set: render as a card hero image (similar to recipe card image)
- If not set: render a placeholder — cream background with a fork-and-knife icon,
  consistent with the recipe card placeholder pattern

**Setting a cover image — edit menu modal:**

Add an image picker section to the existing create/edit menu modal (ChefsDialog).
It appears below the Notes field, labelled **"Cover Image"**.

Two options presented as two buttons side by side:
- **"Choose from recipes"** — opens a sub-panel showing a grid of available images
  pulled from `recipe_user_photos` for all recipes currently in this menu.
  If the menu has no recipes yet (new menu): show message
  `"Add recipes to your menu first to choose from their photos."`
  Tap an image → sets it as `cover_image_url` → thumbnail preview appears in the modal
- **"Upload image"** — opens a file input (web) or `expo-image-picker` (mobile)
  → uploads to `menu-covers/{menu_id}/cover.jpg` in Supabase Storage
  → sets the returned public URL as `cover_image_url`

**Image fetch for "Choose from recipes":**

In `packages/db/src/queries/menus.ts`, add a new function:
```typescript
// getMenuRecipeImages(menuId) 
// Fetches all recipe_user_photos rows for recipes in the given menu
// Returns: { recipe_title: string, photos: { url: string, is_primary: boolean }[] }[]
// Ordered: primary photos first, then by sort_order
```

### Mobile — menu list screen

Same display logic as web:
- Hero image at top of card if `cover_image_url` set
- Placeholder if not

**Setting a cover image — edit menu bottom sheet:**

Add an image picker row below the Notes field in the existing edit bottom sheet.
Label: `"Cover Image"`

Two tappable options:
- **"Choose from recipes"** — opens a bottom sheet grid of recipe photos from the menu
- **"Take or choose photo"** — opens `expo-image-picker` with both camera and gallery
  → uploads to `menu-covers/{menu_id}/cover.jpg`
  → sets `cover_image_url`

After selecting, show a small square thumbnail in the edit form.

---

## PART 2: "Add to Menu" on recipe detail

### Web — recipe detail page (`/recipe/[id]` or `/dashboard/recipe/[id]`)

Add **"Add to Menu"** to the existing recipe action icon row (the row that currently
contains heart, share, pushpin, pencil icons).

Use a menu/fork icon. On click, open a `ChefsDialog` with:

**Step 1 — Pick or create a menu:**
- List of the user's existing menus (title + occasion pill + recipe count)
  Each row is tappable
- `"+ Create new menu"` option at the bottom of the list → inline mini-form
  (just title + occasion — no full modal) → creates the menu → auto-selects it
- Confirm selection: `"Add to [Menu Title]"`

**Step 2 — Pick a course:**
- After selecting a menu, show a course picker:
  All 9 courses from `COURSE_ORDER` as tappable pills
  (`starter | soup | salad | main | side | cheese | dessert | drink | other`)
- Pre-select `'main'` as the default
- `"Add to Menu"` confirm button

**On confirm:**
- Call `addMenuItem(menuId, recipeId, course, sortOrder)`
- `sortOrder`: fetch current max sort_order for that course in that menu + 1
- Success toast: `"Added to [Menu Title] — [Course]"`
- If recipe is already in that menu in that course: show info toast
  `"Already in [Menu Title] as a [Course]"` — do not add duplicate

### Mobile — recipe detail screen

Add **"Add to Menu"** to the mobile recipe detail action row (same row as heart,
share, pushpin, pencil).

Use the same icon as web. On tap:

**Bottom sheet — Step 1: Pick or create a menu**
- `FlatList` of existing menus
- `"+ New Menu"` row at bottom → opens a mini inline form (title + occasion only)
  → creates → auto-selects
- `"Next →"` button

**Bottom sheet — Step 2: Pick a course**
- Grid of course pills (3 per row)
- Default selection: `'main'`
- `"Add to Menu"` primary button
- Apply `useSafeAreaInsets()` — paddingBottom: insets.bottom + 16

**On confirm:** same logic as web — `addMenuItem()`, toast, duplicate guard.

---

## PART 3: Multi-select batch "Add to Menu"

### Web — recipe list/grid

**Select mode trigger:**

Add a **"Select"** button to the recipe list page header (top right, next to the
existing filter/sort controls). It is a secondary pill button.

When clicked:
- Enters **Select Mode**
  - Each recipe card shows a checkbox overlay (top-left corner, same style as
    any existing multi-select pattern in the codebase — check for it first)
  - The page header changes to show:
    `"[N] selected"` count + `"Add to Menu"` primary button + `"Cancel"` link
  - `"Add to Menu"` button is disabled until ≥ 1 recipe is selected

**Selecting cards:**
- Click anywhere on a card → toggles its checkbox
- Click `"Select All"` (appears in header when in select mode) → selects all visible results

**"Add to Menu" in select mode:**

Opens a `ChefsDialog` with the same two-step flow as Part 2:
- Step 1: pick or create a menu
- Step 2: pick a course (applies the SAME course to ALL selected recipes)
  - Note below course picker:
    `"All [N] recipes will be added to this course. You can reassign individual courses from the menu."`

**On confirm:**
- Call `addMenuItem()` for each selected recipe_id in sequence
- Skip any that are already in that menu+course (silent skip, count in toast)
- Success toast: `"[N] recipes added to [Menu Title] — [Course]"`
- Exit select mode automatically

**Cancel:**
- `"Cancel"` link exits select mode, deselects all, no changes made

### Mobile — recipe list screen

**Select mode trigger:**

Add a **"Select"** button to the mobile recipe list screen header (or as a long-press
on a recipe card to enter select mode — use whichever pattern is more native to the
existing mobile recipe list).

When in select mode:
- Checkboxes appear on each card
- Sticky bottom bar appears (above safe area):
  `"[N] selected"` + `"Add to Menu"` primary button

**"Add to Menu":**

Same two-step bottom sheet as Part 2 (pick menu → pick course).
Same note about course applying to all selected recipes.

**On confirm:** same logic as web.
Apply `useSafeAreaInsets()` to the sticky bottom bar.

---

## Course assignment note (all platforms)

In the Menu detail screen (both web and mobile), when a recipe is added via multi-select
and the user later wants to change its course, the existing per-item course picker on the
menu detail handles that. No additional UI is needed — the prompt wording
`"You can reassign individual courses from the menu"` directs users there.

---

## i18n additions

Add to `menus` namespace in all locale files (mobile: 5 locales, web: as applicable):

```json
{
  "menus": {
    "cover_image": "Cover Image",
    "choose_from_recipes": "Choose from recipes",
    "upload_image": "Upload image",
    "take_or_choose": "Take or choose photo",
    "add_to_menu": "Add to Menu",
    "add_to_menu_success": "Added to {{menu}} — {{course}}",
    "already_in_menu": "Already in {{menu}} as a {{course}}",
    "pick_a_menu": "Pick a menu",
    "create_new_menu": "+ Create new menu",
    "pick_a_course": "Pick a course",
    "course_applies_to_all": "All {{count}} recipes will be added to this course. You can reassign individual courses from the menu.",
    "select": "Select",
    "select_all": "Select All",
    "n_selected": "{{count}} selected",
    "no_recipe_images": "Add recipes to your menu first to choose from their photos.",
    "batch_add_success": "{{count}} recipes added to {{menu}} — {{course}}"
  }
}
```

---

## TypeScript

Run `npx tsc --noEmit` in both `apps/web` and `apps/mobile` before wrapup.
Zero errors required.

---

## Testing

### Menu card image
- Create a menu, add 2 recipes → edit menu → "Choose from recipes" shows both recipe photos ✓
- Select one → thumbnail appears in modal → save → card shows image ✓
- Upload a custom image → card shows uploaded image ✓
- Menu with no recipes → "Choose from recipes" shows helper message ✓
- New menu (no `cover_image_url`) → placeholder renders ✓

### Add to Menu — recipe detail
- Web: recipe detail action row shows Add to Menu icon ✓
- Click → menu picker dialog opens with user's menus ✓
- Select a menu → course picker appears, default "Main" ✓
- Confirm → `addMenuItem()` called, recipe appears in menu detail ✓
- Repeat → duplicate guard fires, shows "Already in..." toast ✓
- "+ Create new menu" inline → new menu created → auto-selected ✓
- Mobile: same flow via bottom sheet ✓
- Safe area applied to mobile bottom sheet footer ✓

### Multi-select batch add
- Web: "Select" button appears in recipe list header ✓
- Click → select mode active, checkboxes on cards ✓
- Select 3 recipes → "3 selected" + "Add to Menu" enabled ✓
- "Add to Menu" → two-step dialog (menu → course) ✓
- Confirm → 3 recipes added to menu, success toast ✓
- One already in menu → skipped, toast reflects correct count ✓
- "Cancel" → exits select mode, no changes ✓
- Mobile: select mode + sticky bottom bar above safe area ✓

### psql verification
```sql
-- Confirm cover_image_url column exists
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'menus' AND column_name = 'cover_image_url';

-- Confirm recipes were added via multi-select
SELECT mi.course, r.title, mi.sort_order
FROM menu_items mi
JOIN recipes r ON r.id = mi.recipe_id
WHERE mi.menu_id = '<test_menu_id>'
ORDER BY mi.course, mi.sort_order;
```

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5.
Build a staging APK for mobile verification.
Run regression smoke test from `testing.md` before wrapup.

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md record:
- `cover_image_url` column added to `menus` + `menu-covers` storage bucket created
- `getMenuRecipeImages()` added to `packages/db/src/queries/menus.ts`
- Menu card image picker (web + mobile): choose from recipes + upload
- "Add to Menu" button on recipe detail (web + mobile) with two-step flow
- Multi-select "Add to Menu" on recipe list (web + mobile)
- i18n keys added to all locale files

In feature-registry.md update:
- `menu-card-images` — status: COMPLETE
- `recipe-detail-add-to-menu` — status: COMPLETE
- `recipe-list-multi-select-add-to-menu` — status: COMPLETE
