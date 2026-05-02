# Prompt: ChefsBook Menus — Mobile Edit, Notes, Multi-Select (Mobile Parity)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/MENU-07-notes-share-delete.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker. Note: mobile multi-select batch "Add to Menu" was skipped in MENU-06 — pick this up first before starting the main prompt work.
```

---

## TYPE: ENHANCEMENT — MOBILE ONLY

## Prerequisites

Sessions MENU-01 through MENU-06 must be complete. Confirm in DONE.md before starting:
- `menus` and `menu_items` tables exist with RLS
- Web has multi-select batch Add to Menu (implemented in MENU-06)
- Web has edit menu modal with notes and cover image (implemented in MENU-06)
- Mobile has menus list and detail screens but is missing edit modal and multi-select

---

## Overview

This session brings mobile to parity with web for the My Menus feature:

1. **Mobile multi-select batch "Add to Menu"** — On the recipe list (My Recipes tab), add select
   mode with checkboxes, a sticky bottom bar, and batch add to any menu.

2. **Mobile edit menu modal** — Currently mobile can only create menus, not edit them. Add an
   edit modal with all fields: title, occasion, description, notes (private), and cover image
   picker (choose from recipe photos or upload).

---

## COMPLETED

### Part 1: Mobile multi-select batch Add to Menu

**Files modified:**
- `apps/mobile/components/UIKit.tsx` — RecipeCard now accepts `selectMode`, `selected`, `onSelect` props
- `apps/mobile/app/(tabs)/index.tsx` — Added select mode UI with:
  - Select button in header
  - Selected count display when in select mode
  - Sticky bottom bar with "Add to Menu" button
  - Integration with AddToMenuSheet component
  - Toast feedback on success

### Part 2: Mobile edit menu modal

**Files modified:**
- `apps/mobile/lib/zustand/menuStore.ts` — Added `cover_image_url` to editMenu type
- `apps/mobile/app/(tabs)/menus.tsx` — Added:
  - Edit button (pencil icon) on each menu card
  - Full edit modal with all fields (title, occasion, description, notes, cover image)
  - "Choose from recipes" image picker using getMenuRecipeImages()
  - "Upload image" using expo-image-picker
  - Image preview with remove button

### i18n updates

Added to all 5 locale files:
- `editMenu` — "Edit Menu" / translations
- `notes` — "Notes (private)" / translations
- `notesPlaceholder` — "e.g., make the risotto first..." / translations

---

## COMPLETION CHECKLIST

- [x] RecipeCard supports select mode with checkbox overlay
- [x] My Recipes tab has "Select" button in header
- [x] Select mode shows sticky bottom bar with Add to Menu button
- [x] AddToMenuSheet handles batch recipe IDs
- [x] Edit button added to menu cards
- [x] Edit modal has all fields: title, occasion, description, notes, cover image
- [x] Cover image picker: choose from recipes or upload
- [x] i18n keys added to all 5 locales
- [x] TypeScript: no errors in modified files
- [x] Code committed and pushed

---

## Testing

### Multi-select batch add
1. Open My Recipes tab
2. Tap "Select" button
3. Select multiple recipe cards (checkboxes appear)
4. Tap "Add to Menu" in bottom bar
5. Select menu and course
6. Verify recipes added, toast shown

### Edit menu modal
1. Go to My Menus tab
2. Tap pencil icon on a menu card
3. Modify fields (title, notes, etc.)
4. Choose cover image from recipe photos or upload new
5. Save and verify changes persist
