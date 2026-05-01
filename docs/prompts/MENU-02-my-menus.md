# Prompt: ChefsBook Menus — My Menus (Web + Mobile)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/MENU-02-my-menus.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — WEB + MOBILE

## Prerequisites

Session MENU-01-foundation.md must be complete before starting this session.
Confirm in DONE.md that the following exist before writing any code:
- `menus` and `menu_items` tables in DB
- `packages/db/src/types/menus.ts` and `packages/db/src/queries/menus.ts`
- `menu_scan_enabled` column on `user_profiles`

---

## Overview

Build **My Menus** — the user-facing, marketed Menus feature. A top-level navigation
destination on both web and mobile. Users create occasion-based menus (Thanksgiving,
dinner party, date night), structured by course, pulling from their existing ChefsBook
recipes.

This is distinct from Meal Plans (time-based) and Cookbooks (permanent collections).
Menus are occasion-based — they are designed to be cooked together in a single sitting.

**Available to:** All authenticated users (no plan gate for My Menus itself).

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/deployment.md`
- `.claude/agents/navigator.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read `packages/db/src/queries/menus.ts` — understand all available query functions
2. Read `packages/db/src/types/menus.ts` — understand Menu, MenuItem, MenuWithItems types
3. Read `apps/web/app/dashboard/plan/page.tsx` — understand the meal plan page pattern to mirror
4. Read `apps/mobile/app/(tabs)/plan.tsx` — understand the mobile meal plan tab pattern
5. Identify how the sidebar nav is structured on web (`apps/web/components/Sidebar.tsx`)
6. Identify the mobile tab bar structure in `apps/mobile/app/(tabs)/_layout.tsx`
7. Confirm `COURSE_ORDER` and `COURSE_LABELS` from `packages/db/src/types/menus.ts`
8. Check existing recipe picker component (used in meal plan) — reuse it, do not rebuild

---

## Web — Route: `/dashboard/menus`

### Sidebar navigation

Add **"My Menus"** to the web sidebar. Position it between Meal Plan and Import & Scan.
Use a menu/fork-and-knife icon consistent with existing sidebar icon style.
Use the `cb-*` Tailwind token palette — never hardcode hex.

### My Menus list page (`/dashboard/menus`)

**Empty state:**
- Icon (fork + knife or similar)
- Heading: `"Your Menus"`
- Body: `"Plan a dinner party, holiday feast, or date night. Build a menu course by course from your recipes."`
- Button: `"Create your first menu"`

**Populated state:**
- Grid of menu cards (2-col on desktop, 1-col on mobile breakpoint)
- Each card shows:
  - Menu title (bold)
  - Occasion tag pill (if set)
  - Number of courses and recipes: e.g. `"3 courses · 5 recipes"`
  - Date updated (relative: "2 days ago")
  - Action icons: Edit (pencil), Delete (trash with confirm dialog using ChefsDialog)
- `"+ New Menu"` button in page header

### Create / Edit menu — bottom sheet or modal

Use `ChefsDialog` pattern for the create/edit form. Fields:
- **Title** (required, max 80 chars)
- **Occasion** (optional dropdown: Dinner Party, Holiday, Date Night, Special Occasion, Everyday, Custom)
- **Description** (optional, max 200 chars)
- **Notes** (optional — private notes, e.g. "make the risotto first")
- **Save** / **Cancel** pill buttons

### Menu detail page (`/dashboard/menus/[id]`)

Full-page view of a single menu. Layout:

**Header:**
- Menu title (h1)
- Occasion tag pill
- Description (if set)
- Row of action buttons: `Edit` | `Share` | `Add to Meal Plan` | `Add to Shopping List` | `Add to Cookbook`

**Course sections:**
Render one section per course that has items, in `COURSE_ORDER` sequence.
Each section:
- Course name as section header (e.g. "Starter", "Main", "Dessert")
- Recipe cards within the course — compact card showing:
  - Recipe image (use `getPrimaryPhotos()` + `getRecipeImageUrl()` — NEVER `recipe.image_url` directly)
  - Recipe title
  - Prep + cook time
  - Servings (with override if set)
  - Drag handle for reordering within the course
  - Remove button (× icon)
- `"+ Add recipe to [Course]"` button below each course section

**Add recipe to course flow:**
- Opens the existing recipe picker component (reuse from meal plan — do not rebuild)
- User selects a recipe → picks the course from a dropdown → optionally sets servings override
- Adds to `menu_items` via `addMenuItem()`

**"+ Add a course"** button at the bottom — lets user add a course section not yet represented.
Shows a picker of all course types not yet in the menu.

**Reorder within course:**
- Drag-to-reorder within a course section
- On drop: call `reorderMenuItems()` with updated sort_order values

**Share:**
- Toggle `is_public` on the menu
- When public: show a copy-link button with URL `/menu/[id]` (public view — build this page too)
- Public view at `/menu/[id]` shows the menu read-only (no edit controls)

**Add to Meal Plan:**
- Opens a day picker from the user's current meal plan week
- Adds each recipe in the menu as a separate meal on the chosen day
- Show a bottom sheet with the day picker — use the existing `MealPlanPicker` pattern

**Add to Shopping List:**
- Opens the existing list picker
- Adds all recipe ingredients from the menu to the selected list
- Uses the existing `addItemsWithPipeline()` — pass service role client
- Respects servings overrides set on menu items

**Add to Cookbook:**
- Opens a cookbook picker (dropdown of user's existing cookbooks)
- Adds all recipes in the menu to the selected cookbook in one batch
- Confirm dialog: `"Add all [N] recipes from [Menu Title] to [Cookbook Title]?"`
- After confirming: call existing cookbook recipe-add query in a loop or batch

---

## Mobile — Tab: Menus

### Tab bar

Add a **Menus** tab to the mobile floating pill tab bar.
Position it as the 4th tab: Recipes | Meal Plan | **Menus** | Shopping | Scan
Use a fork-and-knife or menu icon consistent with the existing tab bar icon style.
Follow the `FloatingTabBar` component pattern exactly — do not change its structure.

Route: `apps/mobile/app/(tabs)/menus.tsx`

### Menus list screen

**Empty state:**
- Centred icon + heading + body (same copy as web)
- `"Create Menu"` button (primary, pill style)

**Populated state:**
- `FlatList` of menu cards
- Each card: title, occasion pill, course/recipe count, updated_at relative
- Tap card → navigate to menu detail screen
- Long-press or swipe → delete with `useConfirmDialog`
- FAB `"+"` button to create new menu

### Create / Edit menu — bottom sheet

Use `ChefsDialog` (mobile) for create/edit. Same fields as web.
Follow `useSafeAreaInsets()` — apply `paddingBottom: insets.bottom + 16` to modal footer.

### Menu detail screen (`apps/mobile/app/menu/[id].tsx`)

Add this as a stack screen (not a tab). Register in the root Stack navigator.

Layout:
- **Header**: title, occasion pill, description
- **Action row**: icon buttons for Share, Meal Plan, Shopping List, Cookbook
- **Scrollable body**: course sections, each with recipe cards in compact style
  - Use `getRecipeImageUrl()` + `getPrimaryPhotos()` — never `recipe.image_url` directly
  - Reordering on mobile: long-press drag (use `react-native-draggable-flatlist` if already in project; otherwise use up/down arrow buttons as simpler fallback)
- **"+ Add recipe"** button per course section
- **"+ Add a course"** at the bottom

Recipe picker on mobile: reuse the existing recipe picker bottom sheet from the meal plan flow.

---

## Zustand store (mobile)

Create `apps/mobile/lib/zustand/menuStore.ts`:

```typescript
// State:
//   menus: MenuWithItems[]
//   currentMenu: MenuWithItems | null
//   loading: boolean
//
// Actions:
//   loadMenus()         — fetch all user menus
//   loadMenu(id)        — fetch single menu with items
//   createMenu(data)    — create + reload
//   updateMenu(id,data) — update + reload
//   deleteMenu(id)      — delete + reload
//   addItem(menuId, recipeId, course, sortOrder, servingsOverride?)
//   removeItem(itemId)
//   reorderItems(menuId, itemIds)
```

Follow the pattern in `apps/mobile/lib/zustand/authStore.ts`.

---

## i18n

Add a `menus` namespace to both `apps/mobile/locales/en.json` and `apps/web/locales/en.json`.

Minimum keys:
```json
{
  "menus": {
    "title": "My Menus",
    "empty_heading": "Your Menus",
    "empty_body": "Plan a dinner party, holiday feast, or date night. Build a menu course by course from your recipes.",
    "create_first": "Create your first menu",
    "new_menu": "+ New Menu",
    "create_menu": "Create Menu",
    "occasion": "Occasion",
    "courses": "courses",
    "recipes": "recipes",
    "add_to_meal_plan": "Add to Meal Plan",
    "add_to_shopping_list": "Add to Shopping List",
    "add_to_cookbook": "Add to Cookbook",
    "add_recipe_to_course": "Add recipe to {{course}}",
    "add_a_course": "+ Add a course",
    "share_menu": "Share Menu",
    "delete_confirm": "Delete this menu? This cannot be undone."
  }
}
```

---

## TypeScript

Run `npx tsc --noEmit` in both apps before wrapup. Zero errors required.

---

## Testing

### Web
- Create a new menu: title, occasion, description → saved to DB ✓
- Add a recipe to Starter course → appears in Starter section ✓
- Add a recipe to Main course → appears in Main section ✓
- Reorder recipes within a course → sort_order updates in DB ✓
- Remove a recipe → item removed ✓
- Add to Shopping List → ingredients appear in selected list ✓
- Add to Meal Plan → recipes appear on selected day ✓
- Toggle Share → menu becomes public → `/menu/[id]` renders read-only ✓
- Delete menu → confirm dialog → menu removed ✓

### Mobile
- Menus tab visible in floating pill bar ✓
- Create menu via bottom sheet → appears in list ✓
- Navigate to menu detail → recipe cards render with images ✓
- Add recipe to course from picker ✓
- Remove recipe ✓
- Add to Shopping List ✓
- `useSafeAreaInsets()` applied to all modal footers (no elements hidden behind nav bar) ✓

### psql verification
```sql
SELECT id, title, occasion, is_public FROM menus
WHERE user_id = (SELECT id FROM auth.users LIMIT 1);

SELECT mi.course, mi.sort_order, r.title
FROM menu_items mi
JOIN recipes r ON r.id = mi.recipe_id
WHERE mi.menu_id = '<test_menu_id>'
ORDER BY mi.sort_order;
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
- My Menus web route `/dashboard/menus` and `/dashboard/menus/[id]` shipped
- My Menus mobile tab + stack screen shipped
- Public menu view `/menu/[id]` shipped
- `menuStore.ts` created
- `menus` i18n namespace added

In feature-registry.md update:
- `my-menus-web` — status: COMPLETE
- `my-menus-mobile` — status: COMPLETE

In AGENDA.md confirm next session is `MENU-03-restaurant-scan.md`.
