# ChefsBook — Session: Recipe Card Stale State + Scan Description Bug
# Source: QA Report 2026-04-08 · Items 5, 6, 7
# Target: apps/mobile

---

## CONTEXT

Three related bugs all caused by stale recipe data not refreshing in the recipe list after
changes are made in the recipe detail. Read CLAUDE.md before starting.

---

## BUG 1 — Recipe card image not updating after edit (Items 5 + 7)

### Symptom
After editing a recipe's images (adding, deleting, or changing primary) and returning to the
recipe list, the recipe card still shows the old image (or chef's hat). The correct image
only appears after fully closing and reopening the app.

### Root cause
The recipe list is almost certainly using a cached/stale copy of recipes in the Zustand store.
When the user navigates back from the recipe detail, the list does not re-fetch or invalidate
the affected recipe's `primary_photo_url`.

### Fix

1. **Locate the navigation event** when the user leaves the recipe detail screen back to the
   recipe list (the `back` gesture or back button).

2. **Invalidate or refresh** the specific recipe in the Zustand recipes store when this
   happens. Options in order of preference:

   **Option A — Targeted refresh (preferred):**
   After any image edit (upload, delete, set-primary) in `EditImageGallery`, call a store
   action that refreshes just the affected recipe's `primary_photo_url`:
   ```ts
   // In recipes store:
   refreshRecipePrimaryPhoto: async (recipeId: string) => {
     const photo = await getPrimaryPhoto(recipeId);
     set(state => ({
       recipes: state.recipes.map(r =>
         r.id === recipeId
           ? { ...r, primary_photo_url: photo?.photo_url ?? null }
           : r
       )
     }));
   }
   ```
   Call this immediately after any successful image upload, delete, or primary change —
   not on navigation, but right when the change happens.

   **Option B — Refresh on tab focus:**
   In the recipe list screen, use `useFocusEffect` to re-fetch the recipe list whenever
   the screen comes into focus:
   ```ts
   import { useFocusEffect } from 'expo-router';
   useFocusEffect(
     useCallback(() => {
       loadRecipes(); // existing fetch action
     }, [])
   );
   ```
   This is simpler but fetches all recipes, not just the changed one. Acceptable for now.

   Implement Option A if straightforward, Option B as fallback.

3. **Also fix the recipe detail hero gallery** — when the user returns to the recipe detail
   after editing images, the hero gallery should also reflect the latest state. Ensure
   `listRecipePhotos(recipeId)` is called on focus/mount of the recipe detail screen, not
   just on first load.

### Verify
Open recipe → edit → add image → go back to recipe list → recipe card shows the new image
immediately without closing the app.

---

## BUG 2 — Recipe description not generated on photo scan (Item 6)

### Symptom
When scanning a recipe from a photo (camera), the resulting recipe has no description field,
even when the scanned recipe page contains visible description text.

### Investigation

1. Find the Claude Vision prompt in `scanRecipeMultiPage()` in `@chefsbook/ai`.
2. Check if `description` is included in the requested JSON output structure.
3. Check if the prompt explicitly asks Claude to extract a description/introduction/headnote
   from the recipe.

### Fix

Update the scan prompt to explicitly request description extraction:

```
Extract the following fields from the recipe:
- title (required)
- description: any introductory text, headnote, or preamble before the ingredients.
  If none exists, generate a 1-2 sentence description based on the recipe content.
- ingredients (required)
- steps (required)
- notes: any tips, variations, or serving suggestions after the steps
- servings: number of servings if mentioned
- cook_time: total time if mentioned
- cuisine: infer from recipe content if not stated
- has_food_photo: true if a plated dish photo is visible (not ingredient layout, not text)
- food_photo_region: location of food photo if found
```

The key addition: **if no description text exists on the page, instruct Claude to generate
a brief one** based on the recipe name and ingredients. This ensures the field is never empty
after a scan.

Also check the scan result handler — confirm `description` from the Claude response is being
mapped to the recipe object before save. It may be extracted correctly but dropped during
the type mapping.

### Verify
Scan a recipe page → saved recipe has a non-empty description field.

---

## COMPLETION CHECKLIST

- [ ] Recipe card updates primary image immediately after edit without app restart
- [ ] `useFocusEffect` or targeted store refresh implemented for recipe list
- [ ] Recipe detail hero gallery also refreshes on focus after image edits
- [ ] Scan prompt explicitly requests description and generates one if absent
- [ ] Description field correctly mapped from scan result to recipe object
- [ ] Scanned recipes save with non-empty description
- [ ] No regressions in recipe list loading or image display
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
