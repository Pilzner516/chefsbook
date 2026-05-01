# ChefsBook — Menus Feature: Prompt Index

Five sequential Claude Code sessions. Each session depends on the previous.
Run them in order. Do not start a session until the previous is confirmed complete in DONE.md.

---

## Session sequence

| # | Prompt file | Type | Scope | Key output |
|---|-------------|------|-------|------------|
| 1 | `MENU-01-foundation.md` | Infrastructure | Web + Mobile | DB schema, shared types, admin toggle |
| 2 | `MENU-02-my-menus.md` | Feature | Web + Mobile | My Menus tab, course builder, share, cart, meal plan |
| 3 | `MENU-03-restaurant-scan.md` | Secret Feature | Mobile only | Restaurant menu scan, dish selection, batch generation |
| 4 | `MENU-04-menu-mode.md` | Feature | Mobile (primary), Web (partial) | Timeline view, step-by-step cooking mode |
| 5 | `MENU-05-menus-to-books.md` | Feature | Web (primary), Mobile (partial) | Batch add to cookbook, menu chapter template |

---

## How to launch each session

Paste the LAUNCH PROMPT from the top of each file into Claude Code.
The agent will read the full prompt file and execute autonomously.

**Example (session 1):**
```
Read and execute docs/prompts/MENU-01-foundation.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## What gets built across all 5 sessions

### My Menus (marketed feature, all users)
- Top-level nav tab on web sidebar and mobile floating tab bar
- Create occasion-based menus (Thanksgiving, dinner party, date night)
- Structure by course: Starter → Soup → Salad → Main → Side → Cheese → Dessert → Drink
- Pull recipes from existing ChefsBook collection
- Add a menu to a Meal Plan (adds all recipes to a chosen day)
- Add a menu to a Shopping List (merges all ingredients)
- Share a menu publicly via link
- Add a menu to a Cookbook (batch add all recipes)

### Restaurant Menu Scan (secret feature, Pro + admin-enabled)
- Silent classification inside the existing Scan flow — no advertising, no UI hints
- Recognises restaurant menus and specials boards
- Dish selection list with in-meal photo capture (non-blocking camera flow)
- Pre-generation modal: restaurant name tag, custom occasion tag, personal notes
- Batch recipe generation — all generated recipes are private by default
- `is_inspired_by_menu` provenance flag on all generated recipes
- Admin toggle per user (`menu_scan_enabled`, default OFF) with Secret Features UI in admin

### Menu Mode (all users with menus)
- Full-screen cooking experience launched from any menu detail screen
- **Timeline view**: Gantt-style bars showing all recipe timings, sorted by total time,
  with optional "Serve at" target time → shows "Start X min before" labels
- **Step by Step view**: sequential steps across all courses with course divider cards,
  swipe navigation, and one-tap timers for time-referenced steps
- Screen stays awake during cooking (expo-keep-awake)

### Menus → Books (all users)
- "Add all filtered results to cookbook" on web recipe list (tag filter, cuisine filter, search)
- Batch-add API: deduplicates, appends to existing cookbook, returns add/skip counts
- "By Menu" organisation mode in print cookbook builder
- Menu chapter opening page (chapter number, menu title, occasion, notes, recipe count)
- All 6 print templates support the menu chapter opening page
- Table of contents lists chapter names when "By Menu" organisation is active

---

## Gating summary

| Capability | Free | Chef | Pro | Family | Admin gate |
|---|---|---|---|---|---|
| My Menus (create, edit, use) | ✓ | ✓ | ✓ | ✓ | — |
| Add menu to shopping list | ✓ | ✓ | ✓ | ✓ | — |
| Add menu to meal plan | ✓ | ✓ | ✓ | ✓ | — |
| Menu Mode (Timeline + Step by Step) | ✓ | ✓ | ✓ | ✓ | — |
| Share menu publicly | — | ✓ | ✓ | ✓ | — |
| Add menu to cookbook / batch add | — | — | ✓ | ✓ | — |
| Restaurant menu scan | — | — | ✓ | ✓ | `menu_scan_enabled = true` |
| Menu chapter in print cookbook | — | — | ✓ | ✓ | — |

---

## Files created across all sessions

### Database
- `supabase/migrations/NNN_menus.sql` — `menus` table
- `supabase/migrations/NNN_menu_items.sql` — `menu_items` table
- `supabase/migrations/NNN_menu_scan_enabled.sql` — flag on `user_profiles`
- `supabase/migrations/NNN_is_inspired_by_menu.sql` — flag on `recipes`

### Shared packages
- `packages/db/src/types/menus.ts` — Menu, MenuItem, MenuWithItems, MenuCourse types
- `packages/db/src/queries/menus.ts` — all menu CRUD query functions
- `packages/ai/src/extractMenuDishes.ts` — Claude Vision menu extraction
- `packages/ai/src/generateMenuRecipes.ts` — batch recipe generation from dish list

### Web
- `apps/web/app/dashboard/menus/page.tsx` — My Menus list
- `apps/web/app/dashboard/menus/[id]/page.tsx` — Menu detail
- `apps/web/app/menu/[id]/page.tsx` — Public menu view
- `apps/web/app/api/admin/users/[id]/secret-features/route.ts` — Admin toggle API
- `apps/web/app/api/cookbooks/[id]/batch-add-recipes/route.ts` — Batch add API
- `apps/web/lib/pdf-templates/MenuChapterPage.tsx` — Chapter opening page component
- `apps/web/lib/book-layout.ts` — extended with `BookOrganisation` type

### Mobile
- `apps/mobile/app/(tabs)/menus.tsx` — My Menus tab
- `apps/mobile/app/menu/[id].tsx` — Menu detail stack screen
- `apps/mobile/app/menu/[id]/cook.tsx` — Menu Mode stack screen
- `apps/mobile/app/menu/scan-dishes.tsx` — Dish selection screen (secret)
- `apps/mobile/lib/zustand/menuStore.ts` — Menus Zustand store

---

## Notes for agents

- The restaurant menu scan capability must NEVER appear in any user-facing text,
  help documentation, onboarding, or feature list. It is a secret feature.
- All restaurant-scan-generated recipes are ALWAYS private (`visibility = 'private'`).
  This is a hard rule with no override path in the UI.
- `is_inspired_by_menu = true` distinguishes reconstructed recipes from imported ones.
  Never set this flag on non-menu-scan recipes.
- The `menu_scan_enabled` flag is set ONLY via the admin Secret Features toggle.
  There is no user-facing setting, no API the user can call, and no way for a user to
  enable it themselves.
- Use `supabaseAdmin` only for admin operations (`setMenuScanEnabled`). All user-facing
  operations use the anon `supabase` client with RLS.
- All new mobile screens: apply `useSafeAreaInsets()` to every bottom-positioned element.
  No hardcoded bottom padding. No exceptions.
- All image rendering: use `getPrimaryPhotos()` + `getRecipeImageUrl()`.
  Never render `recipe.image_url` directly.
