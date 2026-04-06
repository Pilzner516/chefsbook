# Meal Plan, Shopping Cart & Recipe Detail Fixes
# Save to: docs/prompts/meal-plan-shopping-recipe-fixes.md

Read CLAUDE.md, apps/mobile/CLAUDE.md and 
.claude/agents/navigator.md to orient yourself.

Fix these 5 issues in order:

## Fix 1 — Meal plan add flow completion
In apps/mobile/app/(tabs)/plan.tsx:

When user taps "+" on a day card to add a recipe:
- Open recipe picker bottom sheet (search + filter)
- When user taps a recipe, do NOT navigate away
- Instead show a confirmation step inside the bottom sheet:
  - Recipe name + thumbnail
  - Meal type selector: Breakfast | Lunch | Dinner | Snack
    (pill toggles, single select, default Dinner)
  - "Add to [Day name]" button in accent red
  - Cancel button
- On confirm: save to meal_plan_entries table with correct
  date, meal_type, recipe_id, user_id
- Close bottom sheet and refresh the day card
- Show brief success toast: "Added to [Day] [Meal type]"

## Fix 2 — Add day to shopping cart from plan
In apps/mobile/app/(tabs)/plan.tsx:

Add a cart icon button (Ionicons "cart-outline") on each day card
top right corner:
- Tapping opens a list selector bottom sheet showing 
  user's shopping lists
- User picks a list
- Runs mergeIngredientsIntoList() from @chefsbook/db
- Shows conflict resolution UI if fuzzy matches found
- On complete: show toast "Added to [list name]"
- Update day card sync state (show checkmark "Added [date]" in 
  basil green after successful sync)
- If day has no recipes: show "No recipes planned for 
  this day" alert instead

## Fix 3 — Remove recipe from shopping list
In apps/mobile/app/(tabs)/shop.tsx:

In the list detail view, each recipe source group header 
(e.g. "Thai Chicken Satay") needs a remove option:
- Add a trash icon (Ionicons "trash-outline") on the 
  recipe group header row
- Tapping shows confirmation: "Remove Thai Chicken Satay 
  and its 8 ingredients from this list?"
- On confirm: delete all shopping_list_items where 
  recipe_id = that recipe's id AND list_id = current list
- Refresh the list immediately
- If item was manually added (no recipe_id): show individual
  swipe-to-delete on that item only

## Fix 4 — Replace Save button with Favorite heart
In apps/mobile/app/recipe/[id].tsx:

- Find the "Save" button and remove it entirely
- Replace with a heart icon (Ionicons "heart-outline" / "heart")
- Heart is filled red (colors.accent) when recipe is favourited
- Heart is outline (colors.textMuted) when not favourited
- Tapping toggles the is_favourite boolean on the recipe in Supabase
- No confirmation needed — immediate toggle
- Place heart in the header action row alongside other action icons

## Fix 5 — Recipe image not displaying
In apps/mobile/app/recipe/[id].tsx:

The recipe image is not rendering. Check and fix:
- Is image_url null/undefined? Add a null guard — show a 
  placeholder if no image
- Is the Image component using the correct source format?
  source={{ uri: recipe.image_url }} not source={recipe.image_url}
- Check if the domain is blocked — React Native requires no 
  domain whitelist unlike Next.js, so this should work
- Add explicit width: '100%' and height: 220 to the image style
- Add resizeMode="cover"
- Add onError handler that shows placeholder on load failure
- Check if image_url has a valid http/https prefix

Placeholder when no image:
- Cream background (#faf7f0)
- Centered chef hat or utensils icon in textMuted color
- Same height as the image (220px)

## Verify
After all fixes:
1. adb screenshot of plan tab showing cart icon on day card
   — describe, delete /tmp/cb_screen.png
2. adb screenshot of recipe detail showing heart icon 
   and recipe image — describe, delete /tmp/cb_screen.png
3. Manually test add recipe to meal plan flow via adb taps
   — confirm confirmation step appears

Fix all errors without stopping.
Do not embed screenshots in conversation.
Commit: git add -A && git commit -m "fix: meal plan add flow, day to cart, remove recipe from list, heart icon, recipe image"
