# Import Pipeline + Shopping Deduplication + Meal Plan Editing
# Save to: docs/prompts/import-pipeline-shopping-mealplan-overhaul.md

Read CLAUDE.md and apps/mobile/CLAUDE.md to orient yourself.
Read .claude/agents/navigator.md for screen locations.

This prompt covers three major feature areas. Execute in order without stopping.

===================================================================
## AREA 1 — IMPORT PIPELINE OVERHAUL
===================================================================

The goal: exhaust every possible way to extract a real recipe from
a web page before falling back to AI generation. aiChef is always
the last resort, never the first.

## 1A — Upgrade the scraping pipeline in packages/ai/src/importFromUrl.ts

Replace the current import logic with a waterfall pipeline that
tries each method in order and moves to the next only on failure.

### Pipeline order (never skip ahead):

STAGE 1 — JSON-LD structured data
- Parse all <script type="application/ld+json"> tags
- Look for @type: "Recipe" or @type: ["Recipe"]
- Also check @graph arrays for nested Recipe objects
- Extract: name, description, recipeIngredient, recipeInstructions,
  recipeYield, cookTime, prepTime, recipeCuisine, recipeCategory,
  image, author, url
- If ALL of name + recipeIngredient + recipeInstructions present
  → mark as COMPLETE, skip remaining stages

STAGE 2 — Microdata (schema.org)
- Parse itemtype="http://schema.org/Recipe" elements
- Extract itemprop values for same fields as Stage 1
- If complete → stop

STAGE 3 — Recipe plugin fingerprinting
Detect and scrape these common WordPress/web recipe plugins:
- WP Recipe Maker: .wprm-recipe-container
- Tasty Recipes: .tasty-recipes
- Recipe Card Blocks: .wp-block-recipe-card
- Mediavine Create: .mv-create-card
- ZipList/Whisk: .zlrecipe-container
- Yummly: .recipe-summary-item
- BigOven: .recipe-details
- AllRecipes: .recipe-ingredients, .recipe-directions
- Food Network: .o-RecipeInfo
- NYT Cooking: .recipe-ingredients, .recipe-steps
- Epicurious: .ingredient-list, .preparation-steps
- Serious Eats: .structured-ingredients, .recipe-procedure
For each: if detected, use plugin-specific selectors to extract
ingredients and steps. If complete → stop.

STAGE 4 — Generic DOM scraping
Look for common class/id patterns across any site:
Ingredient containers: 
  .ingredients, #ingredients, [class*="ingredient"],
  [class*="recipe-ingredient"], ul.ingredient-list
Step containers:
  .instructions, .directions, .steps, #instructions,
  [class*="instruction"], [class*="direction"], ol.steps
Title: h1, .recipe-title, [class*="recipe-name"]
Extract whatever is found, mark missing fields as PARTIAL.

STAGE 5 — Claude Vision (page screenshot)
If ingredients or steps still missing after stages 1-4:
- Use Puppeteer to take a full-page screenshot
- Send to Claude Vision (claude-sonnet-4) with prompt:
  "This is a screenshot of a recipe webpage. Extract the complete
   recipe including all ingredients with quantities and all 
   preparation steps. Return as JSON matching this schema: 
   {title, ingredients: [{quantity, unit, ingredient}], 
   steps: [{step_number, instruction}], servings, cook_time}"
- Vision can read what DOM scraping misses (lazy-loaded content,
  canvas-rendered text, image-based recipes)
- If complete → stop

STAGE 6 — Full page text extraction  
If vision fails or is unavailable:
- Extract all visible text from the page (innerText of body)
- Truncate to 25,000 chars (proven limit from existing pipeline)
- Send to Claude with prompt to find and extract recipe
- If complete → stop

STAGE 7 — Partial import with missing section flags
If after all stages some fields are still missing:
- Save whatever was successfully extracted
- Set import_status = 'partial' on the recipe
- Set missing_sections = [] array with names of what failed:
  e.g. ['ingredients', 'steps', 'servings']
- Do NOT discard partial data — save it
- Return to the client with missing_sections populated

STAGE 8 — aiChef completion (USER MUST REQUEST THIS EXPLICITLY)
Never auto-trigger. Only available after partial import.
User sees the partial recipe and taps "Complete with aiChef".
See section 1C for full aiChef flow.

## 1B — Missing section warnings on import

### On mobile (apps/mobile/app/recipe/[id].tsx):
When recipe.import_status === 'partial' and missing_sections.length > 0:

Show a warning banner below the recipe header:
- Amber/yellow background (colors.warning + opacity 0.15)
- ⚠️ icon + "Some sections could not be imported"
- List each missing section as a pill: "Ingredients" "Steps" etc.
- Two action buttons:
  "Try reimporting" → retriggers the full pipeline on the original URL
  "Complete with aiChef" → triggers aiChef flow (section 1C)
- Banner is dismissible (X button) but reappears until resolved

### On web (apps/web/app/recipe/[id]/page.tsx):
Same warning banner, same two action buttons.
Use the existing warning/alert component pattern.

## 1C — aiChef completion flow

### Trigger
Only shown after partial import. User explicitly taps 
"Complete with aiChef".

### Flow (both mobile and web):
Step 1 — Show what we have
Display the partial recipe with missing sections highlighted in amber.
"We imported what we could. aiChef will suggest the missing parts
based on the recipe title, cuisine, and what was captured."

Step 2 — aiChef generates suggestions
Call Claude API via @chefsbook/ai with:
- Recipe title
- Cuisine and course
- Whatever ingredients/steps were captured
- Original source URL for context
Prompt: "This recipe was partially imported. Based on the title 
'[title]', cuisine '[cuisine]', and these partial details: [partial],
suggest the most likely missing [ingredients/steps]. Be accurate to
the traditional recipe. Format as JSON."

Step 3 — User review (MANDATORY — never auto-apply)
Show suggested content with clear visual distinction:
- AI-suggested content has a basil green left border
- Label: "✨ aiChef suggestion — review before saving"
- Each suggested ingredient/step has individual Accept/Edit/Reject
- "Accept All" button at bottom
- "Edit before accepting" puts fields into edit mode

Step 4 — On accept
- Merge accepted suggestions into recipe
- Add tag: "aichef" (styled differently — green background, 
  not removable by default)
- Add tag: "ai-assisted" 
- Set recipe.aichef_assisted = true (add this boolean column 
  in migration)
- Show confirmation: "Recipe completed with aiChef assistance.
  This may not be the exact original recipe."

### aiChef tag display
On all recipe cards and detail screens where aichef_assisted = true:
Show a special badge: "✨ aiChef" in basil green
This is separate from regular tags — always visible, never hidden.

## 1D — Recipe attribution header

On recipe detail screen (mobile + web):
Add an attribution section below the recipe title:

If recipe has source_url:
Show: "📖 Original recipe by [author if known] at [domain]"
Tappable → opens source_url in browser

If recipe has attributed_to_user_id (cloned from another user):
Show: "🔗 via @[username]" as a tappable link → chef profile
This overrides source attribution (show both if both exist)

If recipe was created manually:
Show nothing (no attribution needed)

Style: 12px textMuted, subtle, below title and above image.

## 1E — Database migration for import fields

Create supabase/migrations/20260406_013_import_fields.sql:

ALTER TABLE recipes 
  ADD COLUMN IF NOT EXISTS import_status text DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS missing_sections text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS aichef_assisted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_author text,
  ADD COLUMN IF NOT EXISTS attributed_to_user_id uuid 
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attributed_to_username text;

Run on rpi5-eth via SSH.

===================================================================
## AREA 2 — SHOPPING LIST STORE NAVIGATION + SMART DEDUPLICATION
===================================================================

## 2A — Two-level shopping list navigation on mobile

In apps/mobile/app/(tabs)/shop.tsx:

### Level 1 — Store/Group selector
When Shop tab opens, show a list of stores/groups:

Each store entry shows:
- Store name (or "General" for uncategorized lists)
- Number of lists under that store
- Total unchecked items across all lists in that store
- Tapping opens Level 2

Plus an "All Lists" option at top that shows every list regardless
of store — useful for quick access.

Plus a "+ New List" button.

Layout: vertical list of store cards, each with:
- Store icon (🏪 default, or store-specific if we have it)
- Store name in 16px semibold textPrimary
- "X lists · Y items" in 13px textMuted
- Chevron right →

### Level 2 — Lists within a store
After tapping a store, show its lists:
- Back button to Level 1
- Store name as section header
- Each list as a card showing:
  - List name
  - Item count (unchecked / total)
  - Last updated date
  - Tapping opens the list detail (existing behavior)

### Level 3 — List detail (existing, no change to item display)
Keep all existing item display logic.
Just ensure back navigation goes to Level 2 (store view).

## 2B — Smart ingredient deduplication engine

Create packages/db/src/shopping/deduplication.ts

This is the single source of truth for deduplication logic.
Both mobile and web must import from here — never duplicate.

### Ingredient normalization
export function normalizeIngredient(name: string): string
- Lowercase
- Remove preparation words: "fresh", "chopped", "minced", 
  "diced", "sliced", "grated", "peeled", "roughly", "finely"
- Remove size words: "large", "small", "medium"
- Singularize common ingredients: "tomatoes"→"tomato", 
  "onions"→"onion", "carrots"→"carrot"
- Map common synonyms:
  "scallions" → "green onion"
  "spring onions" → "green onion"  
  "coriander" → "cilantro"
  "aubergine" → "eggplant"
  "courgette" → "zucchini"
  "capsicum" → "bell pepper"
  "plain flour" → "all-purpose flour"

### Fuzzy matching
export function ingredientMatchScore(a: string, b: string): number
Returns 0-1 score:
- 1.0 = exact match after normalization
- 0.8+ = same base ingredient (chicken breast vs chicken thighs)
- 0.6+ = related ingredient (butter vs unsalted butter)
- below 0.6 = different ingredient

Use Levenshtein distance + keyword matching for the score.

### Merge strategy
export type MergeResult = {
  action: 'skip' | 'increase' | 'add' | 'confirm'
  existingItem?: ShoppingListItem
  delta?: { quantity: number; unit: string }
  message?: string
}

export function determineMergeAction(
  incoming: { name: string; quantity: number; unit: string },
  existingItems: ShoppingListItem[]
): MergeResult

Logic:
1. Find exact match (score = 1.0) → action: 'increase', 
   delta = incoming quantity, silent merge
2. Find fuzzy match (score 0.6-0.99) → action: 'confirm',
   message: "Chicken is already in your list. 
   Add [X] more or is the existing enough?"
3. No match → action: 'add', add as new item

### Batch merge for adding a day/recipe
export async function mergeIngredientsIntoList(
  listId: string,
  incomingIngredients: Ingredient[],
  userId: string
): Promise<{
  added: Ingredient[]
  increased: { item: ShoppingListItem; delta: number }[]
  needsConfirmation: { incoming: Ingredient; existing: ShoppingListItem }[]
  skipped: Ingredient[]
}>

This function:
1. Fetches ALL current items in the list (all sources)
2. For each incoming ingredient runs determineMergeAction
3. Auto-applies 'skip' and 'increase' actions
4. Returns 'needsConfirmation' items for user review
5. Never double-adds anything without user approval

## 2C — Meal plan day sync tracking

Add to meal_plan_entries table:
ALTER TABLE meal_plan_entries 
  ADD COLUMN IF NOT EXISTS synced_to_list_id uuid REFERENCES shopping_lists(id),
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS synced_ingredients_hash text;

The hash is a fingerprint of the ingredients at sync time.
If recipes change after sync, hash changes → show update warning.

## 2D — User confirmation UI for fuzzy matches

When mergeIngredientsIntoList returns needsConfirmation items,
show a modal/bottom sheet on mobile and a dialog on web:

Title: "Review ingredient conflicts"
For each conflict:
  "Your list has: [existing item + quantity]"
  "New recipe needs: [incoming item + quantity]"
  Three options:
  [Add both separately] [Increase existing] [Skip — have enough]

User must resolve all conflicts before the sync completes.
Never auto-resolve fuzzy matches.

===================================================================
## AREA 3 — MEAL PLAN EDITING + SMART CART SYNC
===================================================================

## 3A — Meal plan card editing on mobile

In apps/mobile/app/(tabs)/plan.tsx:

Each day card needs full edit capability:

### Long press on a meal slot → action sheet:
- "Replace recipe" → opens recipe picker (same as web meal planner)
- "Remove from plan" → removes with confirmation
- "View recipe" → navigates to recipe detail
- "Add to shopping list" → triggers smart merge for just this recipe

### "+" button on each day card:
- Opens recipe picker to add a new meal slot
- User selects: meal type (Breakfast/Lunch/Dinner/Snack)
- Then picks from recipe list with search
- Adds to that day

### Recipe picker for meal plan (mobile):
Create a slide-up bottom sheet with:
- Search bar (auto-focused)
- Filter chips: Cuisine, Course, Quick (<30min)
- FlashList of recipe cards with small thumbnails
- Tapping a recipe selects it and closes the sheet

## 3B — Add day/week to shopping list from meal planner

### Per-day "Add to list" button:
On each day card, add a cart button (🛒):

State 1 — Never synced:
Button shows: 🛒 "Add to list"
Tapping → list selector → picks which shopping list → 
runs mergeIngredientsIntoList → shows conflict resolution if needed

State 2 — Already synced, no changes:
Button shows: ✓ "Added [Apr 3]" in basil green
Tapping → shows: "This day is already in your list.
  Add again? This will only add new items since last sync."

State 3 — Synced but recipe added/changed since:
Button shows: ⚠️ "Update list" in amber
Tapping → shows diff: "Thai Chicken Satay was added since 
  your last sync. Add its ingredients to your list?"
Only the delta is added, never the full day again.

State 4 — Partially synced (some recipes added, not all):
Button shows: ◑ "Partially added" 
Tapping shows which recipes are in the list and which aren't.

### "Add whole week" button:
At the top of the planner, add "Add week to list" button.
Runs mergeIngredientsIntoList for all days in the week.
Shows a summary before confirming:
"Adding 47 ingredients from 8 recipes to [list name].
 12 items already in your list will be updated.
 3 items need your review."

## 3C — Sync state persistence

Store sync state in Supabase (meal_plan_entries table additions above).
Also cache in AsyncStorage on mobile for offline access:
Key: 'meal_plan_sync_[week_start_date]'
Value: { [dayDate]: { listId, syncedAt, hash } }

On meal plan load: compare current recipe hashes to stored hashes.
If different → show ⚠️ update indicator automatically.

===================================================================
## EXECUTION ORDER
===================================================================

Execute in this exact order:

1. Run database migrations (1E + 2C together as one migration file)
2. Create packages/db/src/shopping/deduplication.ts (2B)
3. Upgrade importFromUrl.ts pipeline (1A)
4. Add missing section warnings to mobile recipe detail (1B)
5. Add aiChef flow to mobile and web (1C)
6. Add attribution header to recipe detail mobile + web (1D)
7. Add two-level store navigation to mobile shop tab (2A)
8. Wire deduplication engine to existing add-to-list flows (2B+2D)
9. Add meal plan card editing — long press + add button (3A)
10. Add recipe picker bottom sheet (3A)
11. Add day sync tracking + cart buttons to plan tab (3B+3C)
12. Add "Add whole week" button (3B)
13. Update web shopping list and meal planner to use 
    shared deduplication engine from packages/db (2B)
14. Update web meal planner with sync state indicators (3B)

===================================================================
## RULES
===================================================================
- NEVER call createClient() directly — always import from @chefsbook/db
- NEVER call Claude API directly — always import from @chefsbook/ai
- NEVER duplicate deduplication logic — packages/db is the only place
- NEVER auto-apply aiChef content — user must approve every item
- NEVER duplicate ingredients silently — always flag fuzzy matches
- useTheme().colors always — never hardcode hex
- Fix all errors without stopping
- One adb screenshot per major section to /tmp/cb_screen.png
  Describe in text, delete immediately after
- Do not embed screenshots in conversation
- Commit after each area (3 commits total):
  "feat: import pipeline waterfall + aiChef completion"
  "feat: shopping list store navigation + smart deduplication"
  "feat: meal plan editing + smart cart sync"
