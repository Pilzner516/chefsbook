# data-flow — ChefsBook State & Data Agent
# Read this file at the start of any session touching stores, queries, or data lifecycle.

## YOUR ROLE
You own state management and data flow. Your job is to ensure that every write operation
is immediately visible on every screen that displays that data — without requiring an app
restart or manual refresh.

---

## STORE ARCHITECTURE

```
Zustand stores (apps/mobile/store/):
  recipesStore     — recipe list, current recipe, primary photos
  shoppingStore    — lists, items, stores
  mealPlanStore    — weekly plans, meals
  preferencesStore — language, units, plan level
  authStore        — user session, profile

DB package (@chefsbook/db):
  All Supabase queries live here — never call supabase directly in components
```

---

## CACHE INVALIDATION RULES

After any write operation, the corresponding cache MUST be invalidated immediately.
Do not wait for the user to navigate away and back.

| Write operation | Stale caches | Invalidation method |
|----------------|-------------|-------------------|
| Upload image to recipe | recipesStore.primaryPhotos[recipeId] | Call refreshRecipePrimaryPhoto(recipeId) |
| Delete recipe image | Same as above | Same as above |
| Set primary image | Same as above | Same as above |
| Edit recipe title/fields | recipesStore.recipes[recipeId] | Update in-place in store |
| Save new recipe | recipesStore.recipes | Append to store list |
| Delete recipe | recipesStore.recipes | Remove from store list |
| Add meal to plan | mealPlanStore | Refresh week |
| Add item to shopping list | shoppingStore | Refresh list items |

---

## useFocusEffect PATTERN
Use this on every list screen so data refreshes when the user navigates back to it:

```ts
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

useFocusEffect(
  useCallback(() => {
    loadRecipes();  // or loadLists(), loadWeek(), etc.
  }, [])
);
```

This is the safety net. The targeted cache invalidation above is the primary mechanism.
Both should be in place.

---

## PRE-FLIGHT CHECKLIST
```
□ What does this feature write to the DB?
□ Which screens display that written data?
□ After the write: which store caches are stale?
□ How is each stale cache refreshed? (immediately after write, not on navigation)
□ Is there a loading state while fetching?
□ Is there an error state if fetch fails?
□ Does the list screen use useFocusEffect to refresh on focus?
```

## POST-FLIGHT CHECKLIST
```
□ Perform the write operation
□ WITHOUT navigating away: does the current screen reflect the change?
□ Navigate back to the list screen: does it reflect the change?
□ Close and reopen the app: does data persist correctly?
□ Pull to refresh on list screen: does data reload correctly?
```

---

## KNOWN PROBLEM PATTERNS — DO NOT REPEAT

| Pattern | What happened | Correct approach |
|---------|--------------|-----------------|
| Recipe card stale after image upload | Store not refreshed after upload | refreshRecipePrimaryPhoto() immediately after upload |
| New recipe not in list | Store not updated after save | Append to store or trigger useFocusEffect |
| Meal plan empty after wizard save | Store not refreshed after bulk save | Reload week after all meal_plans inserts |
| Shopping list count wrong | Items updated in DB but not in store | Update store item count immediately |

---

## ADDITIONAL FAILURE PATTERNS — DO NOT REPEAT

| Pattern | What happened | Correct approach |
|---------|--------------|-----------------|
| RLS error on insert | shopping_list_items insert missing user context | Every INSERT must include the ownership field. Run `\d+ [table]` to see RLS policies before writing any insert |
| Comment post silently failed | moderateComment() CORS error swallowed silently | Wrap ALL async operations in try/catch. Show the actual error to the user — never swallow silently |
| Cross-platform declared done with one platform missing | Mobile store picker not built, session declared complete | NEVER mark cross-platform sessions done without confirming BOTH platforms. Check DONE.md — does it mention both mobile AND web? |
| Schema assumed without checking | `followed_id` used when column was `following_id` | Run `\d [tablename]` on RPi5 for EVERY table touched in the session before writing any query |
