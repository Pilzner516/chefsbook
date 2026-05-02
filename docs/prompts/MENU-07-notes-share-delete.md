# Prompt: ChefsBook Menus — Notes Split, Share Transfer, Delete Safeguard, Add to Cookbook & Book Builder Menu Integration (Web + Mobile)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/MENU-07-notes-share-delete.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: ENHANCEMENT — WEB + MOBILE

## Prerequisites

Sessions MENU-01 through MENU-06 must be complete. Confirm in DONE.md before starting:
- `menus` and `menu_items` tables exist with RLS
- My Menus list + detail pages exist on web and mobile
- Print cookbook builder exists at `/dashboard/print-cookbook/[id]`
- `BookOrganisation` type and "By Menu" mode exist in `apps/web/lib/book-layout.ts`
- `batch-add-recipes` API route exists at `/api/print-cookbooks/[id]/batch-add-recipes`
- Menu detail action row exists on web and mobile

---

## Overview

Five enhancements in a single session:

**4. Public and private notes** — Each menu has two separate notes fields. Private
notes never leave the owner's account — stripped from public view and shared copies.

**5. Share verification — recipes transfer to receiver** — When a user saves a shared
menu, all recipes clone into their collection. Verify this exists; implement if missing.

**6. Delete safeguard** — Menu delete confirmation informs the user their recipes are safe.

**7. "Add to Cookbook" on menu detail** — Direct action button on the Menu detail page
(web + mobile) to add an entire menu into an existing print cookbook in one step.

**8. Book builder — "Add Menu" alongside "Add Recipe"** — The print cookbook builder
gains a first-class "Add Menu" button sitting beside the existing "Add Recipe" button.
Both menus and individual recipes can live in the same book. The "By Menu" organisation
toggle is retired — the block system makes organisation explicit and visual instead.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/publishing.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/deployment.md`
- `.claude/agents/navigator.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Run `\d menus` on RPi5 — note exact current column names (especially `notes`)
2. Run `\d cookbooks` on RPi5 — confirm `recipe_ids` type and all existing columns
3. Read `apps/web/app/dashboard/print-cookbook/[id]/page.tsx` fully — understand:
   - Where "Add Recipe" currently lives in the UI
   - How `recipe_ids` is stored and reordered
   - How the "By Menu" toggle currently behaves
   - What (if anything) `menu_chapter_ids` does in the current implementation
4. Read `apps/web/lib/book-layout.ts` — understand `BookLayout`, `BookOrganisation`,
   and `menu_chapter_ids` fully before touching anything
5. Read `apps/web/app/dashboard/menus/[id]/page.tsx` — find the action row
6. Read `apps/mobile/app/menu/[id].tsx` — find the action row
7. Read `packages/db/src/queries/menus.ts` — confirm `getUserMenus()` and `getMenu()` signatures
8. Check if `cloneRecipe()` exists in `packages/db/src/queries/` — needed for share transfer
9. Confirm next available migration number from DONE.md

---

## DATABASE MIGRATIONS

### Migration A: Split notes → public_notes + private_notes

```sql
ALTER TABLE menus RENAME COLUMN notes TO private_notes;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS public_notes TEXT;
```

**Important:** Run `\d menus` first. If `notes` does not exist (was never created or
already renamed in a previous session), skip the rename and only add the missing
column(s). Never assume — always verify actual schema before running ALTER.

### Migration B: source_menu_id for share provenance

```sql
ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS source_menu_id UUID REFERENCES menus(id) ON DELETE SET NULL;
```

### Migration C: content_blocks on cookbooks

The cookbook needs to store an ordered list of content blocks — each block is either
a standalone recipe or an entire menu (which expands to a chapter in the PDF).

```sql
ALTER TABLE cookbooks
  ADD COLUMN IF NOT EXISTS content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb;
```

`content_blocks` is an ordered array of typed block objects:

```json
[
  { "type": "recipe", "id": "<recipe_uuid>", "sort_order": 0 },
  { "type": "menu",   "id": "<menu_uuid>",   "sort_order": 1 },
  { "type": "recipe", "id": "<recipe_uuid>", "sort_order": 2 }
]
```

**Backwards compatibility:** `recipe_ids UUID[]` must remain in place and stay in sync.
When content_blocks is updated, derive `recipe_ids` from all recipe-type blocks PLUS
all recipes inside any menu-type blocks (expanded in COURSE_ORDER). This ensures
existing PDF generation pipelines do not break. Document in DONE.md that `recipe_ids`
is now a derived/legacy field — it will be deprecated in a future session once all
paths use content_blocks.

After all migrations: `docker restart supabase-rest`

---

## PART 4: Public and private notes

### Query updates in `packages/db/src/queries/menus.ts`

Update every function that references `notes`:
- `createMenu()` — accept `public_notes` and `private_notes` (both optional)
- `updateMenu()` — same
- `getUserMenus()` — SELECT both fields
- `getMenu()` — SELECT both fields

Update `Menu` interface in `packages/db/src/types/menus.ts`:
```typescript
// Replace:  notes: string | null;
// With:
public_notes: string | null;
private_notes: string | null;
```

### Web — create/edit menu modal

Replace the single Notes field with two fields in this order:

**Notes** (maps to `public_notes`)
- Helper text (small, grey): `"Visible to anyone you share this menu with"`
- Placeholder: `"e.g. This menu works beautifully for a dinner party of 6"`

**Private Notes 🔒** (maps to `private_notes`)
- Helper text: `"Only visible to you — never shared"`
- Placeholder: `"e.g. Start the risotto 30 min before guests arrive"`
- Visual distinction: light amber/cream background using `bg-cb-cream` or the nearest
  equivalent Tailwind token — never hardcode hex. Lock icon beside the label.

### Web — menu detail page (owner view)

Show both blocks when set. If neither is set: single `"Add notes"` link opens edit modal.

**Notes block:** section label `"Notes"`, the text, small pencil edit icon.

**Private Notes block:** section label `"Private Notes 🔒"`, amber background treatment,
the text, small pencil edit icon.

### Web — public menu view `/menu/[id]`

Show `public_notes` only. `private_notes` must not appear anywhere in the public view —
audit the data fetch and confirm it is excluded at the **query level**, not just hidden
in the UI. If the query currently SELECTs all columns (`*`), replace with an explicit
column list that omits `private_notes`.

### Mobile

Same two-field treatment in the edit bottom sheet and detail screen.
Lock icon + amber tint on the private notes input field.

---

## PART 5: Share — recipes transfer to receiver

### Investigation first (mandatory before writing any code)

Fully audit `apps/web/app/menu/[id]/page.tsx`:
- Is there a "Save to My Menus" or "Add to my ChefsBook" CTA button?
- Does it clone recipes into the receiver's account?
- Document findings in a comment block at the top of your changes for this file.

### Required behaviour on the public menu view `/menu/[id]`

**"Save to My Menus"** — primary button, visible to authenticated users who do not
own this menu and have not already saved it.

On click — calls `/api/menus/[id]/save` which:
1. Creates a new `menus` row under receiver's `user_id`:
   - Copies `title`, `occasion`, `public_notes`, `cover_image_url`
   - `private_notes = null` — never copied, not even as empty string
   - `is_public = false` — receiver's copy starts private
   - `source_menu_id = original menu id`
2. Clones each recipe using the existing `cloneRecipe()` function
3. Creates `menu_items` rows linking cloned recipe IDs, preserving `course` + `sort_order`
4. Returns `{ menu_id, recipe_count }`

On success: replace button with:
`"Saved! [N] recipes added to your ChefsBook."` + `"View in My Menus →"` link

**Not authenticated:** show `"Sign in to save this menu to your ChefsBook"` with a
redirect param: `?redirect=/menu/[id]`

**Already saved:** detect via `source_menu_id` lookup, show `"Already saved"` + link
to receiver's copy.

### API route

Create `apps/web/app/api/menus/[id]/save/route.ts`:
```typescript
// POST — authenticated users only
// 1. Verify source menu is_public = true — return 403 if not
// 2. Check receiver has no menu with source_menu_id = this id — return existing if found
// 3. Clone menu + all recipes + menu_items (use supabaseAdmin for cross-user writes)
// 4. Return { menu_id: string, recipe_count: number }
// Wrap in try/catch — on any failure, roll back partial state and return 500
```

---

## PART 6: Delete safeguard

First, verify that `deleteMenu()` in `packages/db/src/queries/menus.ts` only deletes
the menu row and its `menu_items` — it must never touch `recipes`. If it does delete
recipes, fix that first.

Update the `ChefsDialog` delete confirmation on all four entry points:
- Web: menu list page (trash icon on card)
- Web: menu detail page (if delete button exists there)
- Mobile: menus tab (long-press / swipe delete)
- Mobile: menu detail screen (if delete option exists)

**New confirmation copy:**
```
Delete "[Menu Title]"?

Your recipes will not be deleted — they stay in My Recipes.
Only this menu grouping will be removed.
```

The menu title must be interpolated dynamically, shown in quotes.
Buttons: `"Delete Menu"` (destructive — use red/danger style) | `"Cancel"`

This wording applies equally to the original creator and to users who received a
shared copy — in both cases only the menu record is deleted, never the recipes.

---

## PART 7: "Add to Cookbook" on menu detail

### Web — menu detail action row

Add **"Add to Cookbook"** to the action row on `/dashboard/menus/[id]`, alongside
Share, Add to Meal Plan, Add to Shopping List.

On click — `ChefsDialog`:
- Title: `"Add to Cookbook"`
- Lists user's existing print cookbooks (title + current recipe count)
- `"+ Create new cookbook"` → link to `/dashboard/print-cookbook/new` (redirect,
  not inline — do not build inline cookbook creation)
- Confirm: `"Add Menu to Cookbook"`

On confirm:
- Append `{ "type": "menu", "id": menu.id, "sort_order": N }` to `cookbooks.content_blocks`
- Sync `recipe_ids` (append this menu's recipe IDs, deduplicated)
- Success toast: `"[Menu Title] added to [Cookbook Title]"`
- If menu block already exists in that cookbook: `"Already in [Cookbook Title]"`

### Mobile — menu detail action row

Same action via bottom sheet cookbook picker.
Apply `useSafeAreaInsets()` — `paddingBottom: insets.bottom + 16` on bottom sheet footer.

---

## PART 8: Book builder — "Add Menu" button + content block UI

Read the existing book builder page fully before touching any code.

### The model

The book builder now manages an ordered list of **content blocks**. Each block is one of:
- `"recipe"` — a single recipe, renders as recipe pages in the PDF
- `"menu"` — an entire menu, renders as a `MenuChapterPage` opener + course-ordered
  recipe pages in the PDF

Both types coexist freely in the same book:
```
[Recipe: Mushroom Soup]
[Menu Chapter: Christmas Eve 2024]  → Starter: Salmon · Main: Beef · Dessert: Tart
[Recipe: Chocolate Fondant]
[Menu Chapter: Café Flora]          → Starter: Burrata · Main: Duck · Dessert: Sorbet
```

### "Add Menu" button

Place **"Add Menu"** immediately beside the existing `"Add Recipe"` button.
Same visual weight — do not make it more or less prominent than Add Recipe.

On click:
- Opens a picker listing the user's menus (title, occasion pill, recipe count)
- User selects one → appended as a `{ "type": "menu", "id": "..." }` block to
  `content_blocks` with `sort_order = current max + 1`
- Menu Chapter block appears immediately in the block list
- `recipe_ids` synced (menu's recipe IDs appended, deduplicated)

### Content block list UI

Replace the current flat recipe drag list with a unified block list.

**Recipe block** (existing style, unchanged):
- Recipe image thumbnail, title, drag handle, remove (×) button

**Menu Chapter block** (new, visually distinct):
- Full-width card with a left accent stripe in `cb-primary` (red) or `bg-cb-cream`
  border — use tokens, never hex
- Header row (always visible):
  `[Menu icon]  Menu Chapter: [Menu Title]  [N recipes · M courses]  [▾ expand]  [drag]  [×]`
- Collapsed by default — expand chevron reveals read-only course breakdown:
  ```
  Starter    Salmon Tartare
  Main       Beef Wellington
  Dessert    Chocolate Tart
  ```
  This is display only. Courses are edited in My Menus, not in the book builder.
- Remove button (×): shows confirmation dialog before removing
  `"Remove [Menu Title] chapter? [N] recipes will be removed from this book."`
  On confirm: removes the menu block from `content_blocks` AND removes that menu's
  recipe IDs from `recipe_ids`

**Drag to reorder:**
Both block types are draggable. A Menu Chapter block drags as a single unit.
Update `sort_order` on all blocks after every drop.

### Retire the "By Menu" organisation toggle

Remove the `BookOrganisation` toggle (`manual` | `by_menu`) from the settings panel UI.
It is no longer needed — organisation is now explicit through the block order.

Keep the `BookOrganisation` type in `book-layout.ts` (no breaking change), but stop
writing to it. The PDF generation logic previously triggered by `by_menu` is now
triggered automatically whenever `content_blocks` contains any menu-type blocks.

### PDF generation update

Add a helper to `apps/web/lib/book-layout.ts` (or a new file alongside it):

```typescript
export function expandContentBlocks(
  blocks: ContentBlock[],
  menuItemsMap: Record<string, { recipe_id: string; course: MenuCourse }[]>
): string[]  // returns ordered flat array of recipe UUIDs for the PDF pipeline
```

- Recipe blocks: contribute their `id` directly
- Menu blocks: contribute their recipes expanded in `COURSE_ORDER`

Update the PDF generation pipeline to call `expandContentBlocks()` when
`content_blocks` is present and non-empty, falling back to `recipe_ids` for
cookbooks that have not been updated (backwards compat).

When generating the PDF for a cookbook with menu blocks:
- At the position where a menu block appears in the sequence: insert a
  `MenuChapterPage` (already built in MENU-05) before the menu's recipe pages
- Recipe blocks at other positions render as they do today
- Mixed books (recipes + menus + more recipes) work naturally

### TypeScript type for ContentBlock

Add to `apps/web/lib/book-layout.ts`:

```typescript
export interface RecipeBlock {
  type: 'recipe';
  id: string;
  sort_order: number;
}

export interface MenuBlock {
  type: 'menu';
  id: string;
  sort_order: number;
}

export type ContentBlock = RecipeBlock | MenuBlock;
```

---

## i18n additions

Add to `menus` namespace in all locale files (5 mobile locales + web):

```json
{
  "menus": {
    "public_notes": "Notes",
    "public_notes_helper": "Visible to anyone you share this menu with",
    "public_notes_placeholder": "e.g. This menu works beautifully for a dinner party of 6",
    "private_notes": "Private Notes",
    "private_notes_helper": "Only visible to you — never shared",
    "private_notes_placeholder": "e.g. Start the risotto 30 min before guests arrive",
    "add_notes": "Add notes",
    "save_to_my_menus": "Save to My Menus",
    "already_saved": "Already saved",
    "saved_confirmation": "Saved! {{count}} recipes added to your ChefsBook.",
    "view_in_my_menus": "View in My Menus →",
    "sign_in_to_save": "Sign in to save this menu to your ChefsBook",
    "delete_title": "Delete \"{{title}}\"?",
    "delete_body": "Your recipes will not be deleted — they stay in My Recipes. Only this menu grouping will be removed.",
    "delete_confirm_button": "Delete Menu",
    "add_to_cookbook": "Add to Cookbook",
    "already_in_cookbook": "Already in {{cookbook}}",
    "added_to_cookbook": "{{menu}} added to {{cookbook}}",
    "add_menu_button": "Add Menu",
    "menu_chapter": "Menu Chapter",
    "remove_chapter_confirm": "Remove {{menu}} chapter? {{count}} recipes will be removed from this book.",
    "n_recipes_n_courses": "{{recipes}} recipes · {{courses}} courses"
  }
}
```

---

## TypeScript

Run `npx tsc --noEmit` in both `apps/web` and `apps/mobile` before wrapup.
Zero errors required. Pay particular attention to:
- `ContentBlock` discriminated union typing
- `expandContentBlocks()` fully typed inputs and output
- `Menu` interface after notes field rename
- JSONB `content_blocks` typed as `ContentBlock[]`, not `any`

---

## Testing

### Notes (Part 4)
- Create menu with both notes → both appear on owner's detail page ✓
- Public notes visible in `/menu/[id]` ✓
- Private notes absent from `/menu/[id]` — verify in network response, not just UI ✓
- Edit modal pre-fills both fields correctly ✓

### Share transfer (Part 5)
- User B visits User A's public menu → "Save to My Menus" button visible ✓
- Save → N recipes cloned to User B's account ✓
- `source_menu_id` on User B's menu points to User A's menu ✓
- `private_notes` is null on User B's copy ✓
- Second save attempt → "Already saved" state ✓
- Not authenticated → sign-in prompt shown ✓

### Delete safeguard (Part 6)
- Delete confirmation shows new copy with menu title in quotes ✓
- "Delete Menu" + "Cancel" buttons ✓
- Confirm → menu deleted, recipes intact in My Recipes ✓

### Add to Cookbook from menu detail (Part 7)
- "Add to Cookbook" in action row on web + mobile ✓
- Cookbook picker lists user's books ✓
- Confirm → menu appears as block in `content_blocks` ✓
- `recipe_ids` updated ✓
- Repeat → "Already in [Cookbook]" ✓

### Book builder (Part 8)
- "Add Menu" button beside "Add Recipe" ✓
- Select menu → Menu Chapter block appears in list ✓
- Block shows title, recipe count, course count ✓
- Expand → recipes listed by course ✓
- Drag Menu Chapter block → reorders as unit ✓
- Remove Menu Chapter → confirmation → block + recipe IDs removed ✓
- Add individual recipe alongside menu block — both coexist ✓
- "By Menu" toggle no longer visible in settings panel ✓
- Generate PDF — menu blocks produce MenuChapterPage + recipes in COURSE_ORDER ✓
- Generate PDF — recipe-only books unchanged from before ✓
- Generate PDF — mixed book (recipes + menus + recipes) renders correctly ✓

### psql verification
```sql
-- Notes split
SELECT title, public_notes, private_notes FROM menus LIMIT 5;

-- content_blocks column
SELECT id, title, jsonb_array_length(content_blocks) AS block_count
FROM cookbooks LIMIT 5;

-- source_menu_id
SELECT id, title, source_menu_id FROM menus
WHERE source_menu_id IS NOT NULL;

-- Verify private_notes never returned in public query
-- (manually check the /api/menus/[id]/save route and /menu/[id] page data fetch)
```

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5.
Build a staging APK for mobile (Add to Cookbook action, delete confirmation copy).
Run full regression smoke test from `testing.md` — the book builder and PDF pipeline
changes are significant. Verify an existing cookbook can still generate a PDF correctly
before wrapping.

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md record:
- `private_notes` + `public_notes` on menus (rename + add)
- `source_menu_id` added to menus
- `content_blocks JSONB` added to cookbooks
- `ContentBlock` type + `expandContentBlocks()` helper added to book-layout.ts
- Public/private notes UI on web + mobile
- Share flow: "Save to My Menus" + `/api/menus/[id]/save` route
- Delete confirmation updated on all 4 entry points
- "Add to Cookbook" on menu detail (web + mobile)
- Book builder: "Add Menu" button + Menu Chapter block type + drag reorder
- "By Menu" toggle removed from settings panel
- PDF generation updated to use content_blocks with automatic chapter insertion

In feature-registry.md update:
- `menu-public-private-notes` — COMPLETE
- `menu-share-recipe-transfer` — COMPLETE (or VERIFIED if already existed)
- `menu-delete-safeguard` — COMPLETE
- `menu-detail-add-to-cookbook` — COMPLETE
- `cookbook-builder-add-menu-block` — COMPLETE
- `cookbook-builder-content-blocks` — COMPLETE
