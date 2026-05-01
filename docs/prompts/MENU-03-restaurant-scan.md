# Prompt: ChefsBook Menus — Restaurant Menu Scan (Secret Feature, Mobile Only)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/MENU-03-restaurant-scan.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — MOBILE ONLY

## Prerequisites

Sessions MENU-01 and MENU-02 must be complete. Confirm in DONE.md before starting:
- `menus` and `menu_items` tables exist
- `menu_scan_enabled` on `user_profiles` exists
- `packages/db/src/queries/menus.ts` — `getMenuScanEnabled()` available

---

## Overview

This session adds a **secret, unlisted capability** inside the existing Scan flow on mobile.
When the sous chef classifier recognises that a scanned image (or multi-page scan set) is
a restaurant or specials menu, it silently pivots to a dedicated extraction and selection
flow. Nothing about this capability is advertised in the UI.

**The feature does not exist for users who have not been specifically enabled by an admin.**
If the gate fails at any point, the scan falls through to the normal unclear-image flow
with no error, no message, and no hint that a menu path exists.

### Gating rules (ALL must pass — if any fails, fall through silently)
1. User is on Pro plan (`plan_tier IN ('pro', 'family')`)
2. `user_profiles.menu_scan_enabled = true`
3. The scan classifier returns `content_type = 'restaurant_menu'`

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/import-pipeline.md`
- `.claude/agents/import-quality.md`
- `.claude/agents/image-system.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/ai-cost.md`
- `.claude/agents/navigator.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read `apps/mobile/app/(tabs)/scan.tsx` fully — understand the existing scan flow
2. Read `packages/ai/src/scanRecipe.ts` (or equivalent) — understand `scanRecipeMultiPage()`
3. Read `packages/ai/src/dishIdentification.ts` — understand the dish identification flow
4. Understand the existing scan classifier: where `content_type` is set and what values exist
5. Confirm `getMenuScanEnabled()` exists in `packages/db/src/queries/menus.ts`
6. Confirm `addMenuItem()` and `createMenu()` exist in `packages/db/src/queries/menus.ts`
7. Read `.claude/agents/ai-cost.md` — understand cost implications of new Claude Vision call
8. Run `\d user_profiles` on RPi5 — confirm `menu_scan_enabled` column
9. Check if `react-native-image-picker` or `expo-image-picker` is the current camera/gallery tool

---

## Step 1 — Extend the scan classifier

### New `content_type` value: `'restaurant_menu'`

In the existing multi-page scan Claude Vision prompt (in `packages/ai/`), extend the
classification logic to detect restaurant and specials menus. The prompt must ask Claude
to classify the scan as one of:
- `recipe` — a single recipe document
- `technique` — a cooking technique
- `restaurant_menu` — a restaurant menu, specials board, set menu, or prix fixe card
- `unclear` — cannot determine

The `restaurant_menu` classification must trigger when the scan shows:
- A list of dishes organised by section (starters, mains, desserts etc.)
- A specials board or daily menu card
- A printed restaurant menu (single or multi-page)
- A handwritten menu or napkin-style set menu

**Do not add `restaurant_menu` to any visible UI label or copy anywhere in the app.**
The classifier produces this value internally only.

### Gate check

After classification returns `restaurant_menu`, immediately check:

```typescript
const isPro = ['pro', 'family'].includes(user.plan_tier);
const isScanEnabled = await getMenuScanEnabled(user.id);

if (!isPro || !isScanEnabled) {
  // Fall through to unclear image handler — no error, no message, no hint
  handleUnclearScan();
  return;
}

// Both gates pass — proceed to menu extraction flow
launchMenuExtractionFlow(scannedPages);
```

---

## Step 2 — Menu extraction AI call

Create `packages/ai/src/extractMenuDishes.ts`:

```typescript
export interface ExtractedDish {
  name: string;
  description: string | null;
  // description from the menu text — may be null if menu lists name only
  section: string | null;
  // the section heading from the menu (e.g. "Starters", "Pasta", "Desserts")
  // use this to suggest a MenuCourse — map loosely (starters→starter, pasta→main, etc.)
  suggested_course: MenuCourse;
}

export interface ExtractMenuDishesResult {
  restaurant_name: string | null;
  // extracted from the menu header/footer if visible
  dishes: ExtractedDish[];
}

export async function extractMenuDishes(
  pageImages: string[],  // base64 encoded images
): Promise<ExtractMenuDishesResult>
```

### Claude Vision prompt for extraction

Send all scanned page images in a single call (same as `scanRecipeMultiPage`).

System prompt:
```
You are a culinary assistant. The user has scanned a restaurant menu or specials board.
Extract every dish you can find. For each dish return: the exact name as printed,
any description text from the menu (ingredients, preparation notes), the section heading
it appears under, and a suggested course category.

Respond ONLY with valid JSON. No preamble, no markdown, no explanation.

{
  "restaurant_name": "string or null",
  "dishes": [
    {
      "name": "string",
      "description": "string or null",
      "section": "string or null",
      "suggested_course": "starter|soup|salad|main|side|cheese|dessert|drink|other"
    }
  ]
}
```

Use **Sonnet** (not Haiku) — menu extraction is a multi-image, multi-dish task.
Log the call to `ai_usage_log` with action `'menu_scan_extract'`.

---

## Step 3 — Dish selection screen

This is a new full-screen stack route:
`apps/mobile/app/menu/scan-dishes.tsx`

Register it in the root Stack navigator. It receives the `ExtractMenuDishesResult` as
navigation params (pass via JSON-serialisable param or a shared Zustand store slice).

### Layout

**Header:**
- Title: `"Select Dishes"` (plain — do not mention "menu" or "restaurant scan")
- Subtitle: `"Tap dishes to select, add photos as you go"`
- X button to cancel and discard (with `useConfirmDialog` confirmation)

**Scrollable list:**
One row per extracted dish. Each row contains:

```
[ Checkbox ]  [ Dish Name (bold)           ]  [ 📷 ]
              [ Description (1 line, grey) ]
```

- **Checkbox**: selects/deselects the dish for import
- **Dish name**: bold, full width
- **Description**: one line, truncated, grey text — from `ExtractedDish.description`
- **📷 button**: right-aligned — opens a small bottom sheet with two options:
  - `"Pick from Gallery"` — opens `expo-image-picker` gallery
  - `"Take Photo"` — opens camera
  - After capture/selection: the 📷 button shows a small green tick indicator
  - The selected image is stored in component state (NOT uploaded yet)
  - Tapping 📷 again on a row that already has an image shows the existing image thumbnail
    in the bottom sheet with a `"Remove"` option

The camera/gallery flow must be non-blocking. After capturing, the user returns to
the dish list immediately. The list remains open and persistent — the user can
photograph dishes one at a time throughout a meal.

**Select all / Deselect all** link at the top of the list.

**Bottom bar (sticky, above safe area):**
- Count of selected dishes: `"5 dishes selected"`
- `"Generate Recipes"` primary pill button — disabled until ≥ 1 dish is selected
- Apply `paddingBottom: insets.bottom + 16` — mandatory safe area rule

---

## Step 4 — Pre-generation modal

Triggered by tapping `"Generate Recipes"`. Opens a `ChefsDialog` (mobile) with:

**Fields:**
1. **Restaurant or menu name** (text input, optional — pre-filled with `restaurant_name`
   from the extraction result if one was detected)
   - Label: `"Restaurant or menu name"`
   - Placeholder: `"e.g. Café Flora, Tuesday Specials"`
   - This value becomes a tag on every generated recipe

2. **Custom tag** (text input, optional)
   - Label: `"Add a special tag"`
   - Placeholder: `"e.g. John's Birthday, Paris 2024"`
   - This value becomes a second tag on every generated recipe
   - Helper text: `"Tag all dishes from this menu with something memorable"`

3. **Your notes** (text area, optional)
   - Label: `"Notes"`
   - Placeholder: `"Add a memory, occasion, date, or location"`
   - This feeds into the recipe generation prompt for context

**Buttons:**
- `"Generate"` (primary) — proceeds to Step 5
- `"Back"` (secondary) — returns to dish list

---

## Step 5 — Batch recipe generation

### AI function

Create `packages/ai/src/generateMenuRecipes.ts`:

```typescript
export interface MenuRecipeInput {
  name: string;
  description: string | null;
  course: MenuCourse;
  imageBase64?: string;   // optional image captured by user
}

export interface GeneratedMenuRecipe {
  title: string;
  description: string;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: { instruction: string }[];
  cuisine: string | null;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
}

export async function generateMenuRecipes(
  dishes: MenuRecipeInput[],
  restaurantName: string | null,
  userNotes: string | null,
): Promise<GeneratedMenuRecipe[]>
```

For each dish, generate a plausible recipe using:
- Dish name
- Menu description (if available)
- User's photo of the dish (if provided — include as image content block)
- Restaurant name and user notes as additional context

**Prompt approach:**
```
You are a culinary sous chef. A user photographed a menu at [restaurantName].
They want to recreate [dishName] at home. Based on the name, description, and any
photo provided, generate a realistic home-cook recipe. Acknowledge that this is a
reconstruction from a menu — aim for authenticity to the dish style.

[If image provided]: The user also photographed the actual dish — use it to inform
the ingredients, plating style, and likely preparation method.
```

Process dishes sequentially (not in parallel) to avoid rate limits.
Log each call to `ai_usage_log` with action `'menu_recipe_generate'`.
Use **Sonnet** for generation quality.

### Saving recipes

For each generated recipe:
1. Call `createRecipe()` with:
   - All generated fields
   - `visibility = 'private'` — ALWAYS private, no exceptions
   - `tags = [sanitisedRestaurantTag, sanitisedCustomTag].filter(Boolean)`
   - `source_notes = 'Inspired by [restaurantName]'` (or generic if no name)
   - `is_inspired_by_menu = true` — see migration below
2. If the user attached an image to this dish: upload the image to `recipe_user_photos`
   and set as primary
3. Add the recipe to `menu_items` for a newly created Menu record (see below)

### Creating the Menu record

Before generating recipes, create a Menu record:
```typescript
const menu = await createMenu({
  user_id: userId,
  title: restaurantName ?? 'Scanned Menu',
  occasion: null,
  notes: userNotes ?? null,
  is_public: false,
});
```

After each recipe is created, add it to the menu via `addMenuItem()` with the
`suggested_course` from the extracted dish data.

### DB migration: `is_inspired_by_menu` flag on recipes

Add to a new migration:
```sql
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS is_inspired_by_menu BOOLEAN NOT NULL DEFAULT false;
```

This field distinguishes restaurant-scan reconstructions from imported or user-entered
recipes. Used in admin, provenance display, and future reporting.

### Progress UI

While generating, show a full-screen progress overlay:
- Spinner
- `"Creating your recipes..."` heading
- Per-dish progress: `"3 of 7 dishes complete"`
- Do NOT show a cancel button — generation must complete or fail atomically

### Completion

On success, navigate to the newly created Menu detail screen
(`apps/mobile/app/menu/[id].tsx`) showing all generated recipes in course order.

Show a toast: `"[N] recipes created from your menu"`

---

## Error handling

- If `extractMenuDishes()` fails: fall through to the normal unclear-image flow. No error.
- If the gate check fails: fall through to unclear-image flow. No error, no hint.
- If a single recipe generation fails: skip that dish, continue with the rest, note the
  skip in the completion toast: `"5 of 7 recipes created — 2 couldn't be generated"`
- If the entire batch fails: show a `ChefsDialog` error with a `"Try again"` option.

---

## TypeScript

Run `npx tsc --noEmit` in `apps/mobile` before wrapup. Zero errors required.

---

## Testing

### Gate testing (psql setup)
```sql
-- Enable for a Pro test user
UPDATE user_profiles
SET menu_scan_enabled = true
WHERE user_id = '<test_user_id>';

-- Verify
SELECT plan_tier, menu_scan_enabled FROM user_profiles
WHERE user_id = '<test_user_id>';
```

### Scan classification
- Scan a real restaurant menu image → confirm classifier returns `restaurant_menu`
- Scan a normal recipe → confirm it does NOT return `restaurant_menu`
- With gate disabled: scan a menu → confirm it falls through to unclear-image flow, no hint

### Dish extraction
- With a multi-page menu scan, confirm `extractMenuDishes()` returns ≥ 3 dishes with names
- Confirm `restaurant_name` is extracted if the menu header shows one
- Confirm `suggested_course` is plausible for each dish

### Dish selection screen
- All dishes rendered in list ✓
- Checkbox toggles selection ✓
- 📷 button opens bottom sheet with Gallery + Camera ✓
- After photo capture, green tick appears on row ✓
- Generate button disabled with 0 selected, enabled with ≥ 1 ✓
- Safe area applied — Generate button not hidden behind home indicator ✓

### Pre-generation modal
- Restaurant name pre-filled from extraction if available ✓
- Custom tag field accepts free text ✓
- Notes field accepts free text ✓

### Recipe generation
- Recipes created in DB with `visibility = 'private'` ✓
- Recipes have restaurant tag applied ✓
- Recipes have custom tag applied (if provided) ✓
- `is_inspired_by_menu = true` on all generated recipes ✓
- If image was attached to a dish: recipe has that image as primary photo ✓
- Menu record created and linked ✓
- Navigates to menu detail after completion ✓

### psql verification
```sql
SELECT title, visibility, tags, is_inspired_by_menu
FROM recipes
WHERE is_inspired_by_menu = true
ORDER BY created_at DESC LIMIT 10;

SELECT id, title FROM menus
WHERE notes IS NOT NULL
ORDER BY created_at DESC LIMIT 5;
```

---

## Deploy

Mobile only — build a staging APK and verify via ADB.
Run regression smoke test from `testing.md` before wrapup.

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md record:
- Restaurant menu scan secret feature shipped (mobile only)
- `is_inspired_by_menu` column added to `recipes`
- `extractMenuDishes()` and `generateMenuRecipes()` added to `@chefsbook/ai`
- Dish selection screen `menu/scan-dishes.tsx` created
- Gating: Pro + `menu_scan_enabled` + classifier result

In feature-registry.md update:
- `restaurant-menu-scan` — status: COMPLETE — note: secret feature, Pro + admin gate

In AGENDA.md confirm next session is `MENU-04-menu-mode.md`.

**Do NOT mention this feature in any user-facing changelog, release notes, or help text.**
