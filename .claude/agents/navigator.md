# ChefsBook Navigator Agent
# Updated: 2026-04-06
# Purpose: Read this before any navigation or UI work.
# Update this file whenever screens are added or changed.

## How to use this agent
Before doing any UI work, read this file to understand:
- Exact file paths for every screen
- How to navigate there via adb
- What the screen looks like
- What actions are available

## ADB Navigation Commands

```bash
# Reload app
adb shell input key 82  # opens dev menu, then tap Reload

# Take screenshot (always overwrite, always delete after reading)
adb exec-out screencap -p > C:/Users/seblu/aiproj/chefsbook/cb_adb.png
# Describe what you see, then:
rm C:/Users/seblu/aiproj/chefsbook/cb_adb.png

# IMPORTANT: Do NOT use /tmp/ paths — they don't resolve correctly.
# Always write to the project directory.

# Tap by coordinates (1080x2400 screen)
adb shell input tap X Y

# Swipe
adb shell input swipe X1 Y1 X2 Y2 300

# Back button
adb shell input keyevent 4

# Read JS errors
adb logcat -s ReactNativeJS:V ReactNative:V -d | tail -30

# Launch app with Metro connection
adb shell am start -a android.intent.action.VIEW -d "exp+chefsbook://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" com.chefsbook.app

# Port forwarding (required after each rebuild)
adb reverse tcp:8000 tcp:8000   # Supabase
adb reverse tcp:8081 tcp:8081   # Metro
```

## Screen Coordinate Map
# Emulator: Medium Phone API 36
# Resolution: 1080x2400
# Tab bar height: 70px, Y center: ~2330
# Tab bar background: white card with top border

### Tab positions (X coordinates, Y=2330):
#   Recipes:  x=108
#   Search:   x=324
#   Scan:     x=540
#   Plan:     x=756
#   Shop:     x=972

### Common Y coordinates:
#   Status bar bottom: ~80
#   ChefsBook header bottom: ~130
#   First content area: ~160
#   Tab bar top edge: ~2300

## Mobile App Structure
# Base path: apps/mobile/app/

### Auth Flow
Route: / (index)
File: apps/mobile/app/index.tsx
Reach: Shown when not authenticated
Elements: ChefsBook logo (serif, Chefs in black + Book in red), tagline "Your recipes, all in one place.", Sign In button (primary), Create Account button (secondary)
Actions: Sign In → /auth/signin, Create Account → /auth/signup
Auth guard: apps/mobile/app/_layout.tsx — useProtectedRoute() redirects authenticated users to /(tabs), unauthenticated users away from tabs

Route: /auth/signin
File: apps/mobile/app/auth/signin.tsx
Reach: Landing → Sign In button
Elements: Email input, Password input, Sign In button

Route: /auth/signup
File: apps/mobile/app/auth/signup.tsx
Reach: Landing → Create Account button
Elements: Display name input, Email input, Password input, Create Account button

### Tab 1 — Recipes
Route: /(tabs)/index
File: apps/mobile/app/(tabs)/index.tsx
Reach: Tap "Recipes" tab (leftmost, restaurant-outline icon) — adb shell input tap 108 2330
Elements: ChefsBook header, search bar with sort icon (right side), recipe count ("50 recipes"), scrollable list of RecipeCard components with image, title, cuisine badge, cook time
Actions: Tap search bar → filter recipes, Tap sort icon → toggle sort order, Tap any recipe card → /recipe/[id], Pull to refresh

### Tab 2 — Search
Route: /(tabs)/search
File: apps/mobile/app/(tabs)/search.tsx
Reach: Tap "Search" tab (search-outline icon) — adb shell input tap 324 2330
Elements: ChefsBook header, toggle bar "My Recipes" (red active) / "Discover", search input, "Browse by Category" heading, 4x2 grid of filter cards: Cuisine (globe), Course (utensils), Ingredient (apple), Dietary (leaf), Tags (tag), Cook Time (clock), Source (link), Favourites (heart)
Actions: Toggle My Recipes/Discover, Type in search, Tap any category card → filtered results, Tap Discover → public recipe feed

### Tab 3 — Scan/Import
Route: /(tabs)/scan
File: apps/mobile/app/(tabs)/scan.tsx
Reach: Tap "Scan" tab (camera-outline icon, center) — adb shell input tap 540 2330
Params: importUrl (optional, from share sheet)
Elements: ChefsBook header, "Add a Recipe" title (22px bold), "Choose how to add" subtitle, red hero "Speak a Recipe" button (80px, accent red bg, mic icon, pulse animation), 2x2 grid cards (Scan Photo/camera, Import URL/link, Choose Photo/gallery, Manual Entry/pencil), collapsible URL input (shown when Import URL tapped — text input, Paste button, Import button, Chrome share hint), "Share recipes directly from Chrome" banner with 3-step instructions
Actions: Speak a Recipe → /speak, Scan Photo → camera picker → AI scan, Import URL → expand URL input → fetch+import, Choose Photo → image library picker → AI scan, Manual Entry → /recipe/new, Clipboard paste suggestion (shown if clipboard contains URL)
Import flow: Sets importStatus to 'importing' → progress bar below header → on success green "Recipe saved! View it →" → tap navigates to /recipe/[id]

### Tab 4 — Plan
Route: /(tabs)/plan
File: apps/mobile/app/(tabs)/plan.tsx
Reach: Tap "Plan" tab (calendar-outline icon) — adb shell input tap 756 2330
Elements: ChefsBook header, week navigator ("< Prev  date-range  Next >"), daily cards for each day of the week showing: day name + date, meal slots (BREAKFAST/LUNCH/DINNER labels in red) with recipe names, "No meals planned" for empty days
Actions: Prev/Next week navigation, Tap a meal slot → recipe detail or add recipe, Tap a recipe name → /recipe/[id]

### Tab 5 — Shop
Route: /(tabs)/shop
File: apps/mobile/app/(tabs)/shop.tsx
Reach: Tap "Shop" tab (cart-outline icon, rightmost) — adb shell input tap 972 2330
Elements: ChefsBook header, "Shopping Lists" heading, red "New Shopping List" button (full width), list of shopping list cards with name and x delete button (e.g. "Week of 2026-03-30", "list 2", "list seb", "Monday meals")
Actions: New Shopping List → create new list, Tap list card → open list detail with items grouped by aisle (checkboxes), x button → delete list
Font size preference: persisted via expo-secure-store (key: shopping_font_size)

### Recipe Detail
Route: /recipe/[id]
File: apps/mobile/app/recipe/[id].tsx
Reach: Tap any recipe card from Recipes tab or Search results
Params: id (recipe UUID)
Elements: Back arrow + "Recipe" header, title (bold), description text, badges row (cuisine, course, cook time), action buttons row (Save heart, Share link, Pin red), "Edit Recipe" button (pencil icon), green "Cook Mode" button (full width), Steps section (numbered with instructions), timer badges on steps with timers (red, tappable → CountdownTimer), Ingredients section (with quantities, scalable), Cooking Notes section ("+ Add" → text input), Tags section with AI auto-tag
Actions: Save/unsave (heart toggle), Share → native share sheet, Pin → pinned bar, Edit Recipe → inline edit mode (title, description, ingredients, steps become editable inputs, Save/Cancel buttons), Cook Mode → full-screen step-by-step view, Timer badges → tap to start CountdownTimer, Add cooking note, Manage tags (add/remove, AI suggest)
Edit mode: Inline — fields become TextInputs, ingredients/steps editable, cuisine/course/dietary pickers, save calls updateRecipe + replaceIngredients + replaceSteps
Cook mode: Full screen, "Step X of Y", large instruction text (22px centered), Previous/Next/Done buttons, CountdownTimers auto-detected from step text, useKeepAwake to prevent screen sleep, "Exit cook mode" link

### Recipe New
Route: /recipe/new
File: apps/mobile/app/recipe/new.tsx
Reach: Scan tab → Manual Entry card
Elements: Title input, Description input (multiline), Servings input, Prep/Cook minutes inputs, Cuisine input, Ingredients (multiline, one per line), Steps (multiline, one per line), Notes input, Save button
Actions: Save → creates recipe via addRecipe, navigates to /recipe/[id]

### Cookbook Detail
Route: /cookbook/[id]
File: apps/mobile/app/cookbook/[id].tsx
Reach: (Not directly accessible from current tab UI — accessed via deep link or future cookbooks feature)
Params: id (cookbook UUID)

### Chef Profile
Route: /chef/[id]
File: apps/mobile/app/chef/[id].tsx
Reach: Tap attribution tag on any recipe, or from Discover results
Params: id (user UUID)
Elements: Avatar, display name, @username, plan badge, follower/following counts, tab toggle (Recipes / About), recipe grid (public recipes if viewing other user, all recipes if own profile), Follow/Unfollow button (if not own profile), Clone recipe button on each recipe card
Actions: Follow/Unfollow, Tap recipe → /recipe/[id], Clone recipe → copies to own collection

### Share Screen
Route: /share/[token]
File: apps/mobile/app/share/[token].tsx
Reach: Deep link via share URL (exp+chefsbook://share/[token])
Params: token (share token string)
Elements: Full recipe view (if valid token) — title, description, badges, ingredients, steps. "Add to my ChefsBook" CTA button. Also handles external URLs (if token starts with http → import flow)
Actions: Add to my ChefsBook → clones recipe to user's collection

### Settings Modal
Route: /modal
File: apps/mobile/app/modal.tsx
Reach: (No visible button in current tab UI — accessed programmatically or via gesture)
Elements: If authenticated: Avatar, display name, @username, plan badge, Subscription card (current plan, recipe/scan limits), Sign Out button. If anonymous: Sign In / Sign Up form (email, password, display name toggle)
Actions: Sign Out (with confirmation alert), Sign In, Create Account, View subscription details

### Speak a Recipe
Route: /speak
File: apps/mobile/app/speak.tsx
Reach: Scan tab → Speak a Recipe hero button
Elements: 3-step flow: Step 1 — Record (mic button, transcript preview, manual text input fallback), Step 2 — Generating (AI processing indicator with step descriptions), Step 3 — Review (formatted recipe preview with title, ingredients, steps — edit before saving)
Actions: Start/stop recording (Voice API), Edit transcript manually, Generate recipe from transcript (AI), Review and edit generated recipe, Save → creates recipe via addRecipe → navigates to /recipe/[id]
Note: @react-native-voice/voice loaded via lazy require() in try/catch — may not be available on all devices

## Mobile Components
# Base path: apps/mobile/components/

- **UIKit.tsx** — Design system: Button (primary/secondary/ghost, sm/md/lg), Card, Input, Badge, Avatar, SectionHeader, EmptyState, Loading, Chip, Divider, RecipeCard
- **ChefsBookHeader.tsx** — App header with "ChefsBook" logo (serif font, Chefs black + Book red accent)
- **CountdownTimer.tsx** — Countdown timer component for cook mode and recipe steps, with start/pause/reset
- **ImportBanner.tsx** — Banner showing batch import progress (shown in root layout)
- **PinnedBar.tsx** — Floating bar at bottom showing pinned recipe for quick access

## Mobile Zustand Stores
# Base path: apps/mobile/lib/zustand/

- **authStore** — Session, profile, planTier, init(), signIn(), signUp(), signOut()
- **recipeStore** — recipes[], addRecipe(), fetchRecipes(), updateRecipe()
- **cookbookStore** — Cookbook collections
- **mealPlanStore** — Meal plan data by week
- **shoppingStore** — Shopping lists and items
- **cookingNotesStore** — Per-recipe cooking journal notes
- **importStore** — Batch import job tracking
- **pinStore** — Pinned recipe for quick access

## Web App Structure
# Base URL: http://localhost:3000

### Landing
URL: /
File: apps/web/app/page.tsx
Reach: Direct URL, or unauthenticated redirect

### Auth
URL: /auth
File: apps/web/app/auth/page.tsx
Reach: Landing CTA or redirect from dashboard when not authenticated

### Pricing
URL: /pricing
File: apps/web/app/pricing/page.tsx
Reach: Landing page pricing link

### Dashboard Shell
URL: /dashboard/*
File: apps/web/app/dashboard/layout.tsx
Auth: Redirects to /auth if not authenticated
Sidebar nav items (top to bottom):
1. Search → /dashboard/search
2. Recipes → /dashboard (with recipe count)
3. Techniques → /dashboard/techniques (with count)
4. Cookbooks → /dashboard/cookbooks
5. Discover → /dashboard/discover
6. Shopping → /dashboard/shop
7. Meal Plan → /dashboard/plan
8. Import & Scan → /dashboard/scan
9. Speak a Recipe → /dashboard/speak (PRO badge)
Bottom: Settings → /dashboard/settings
Sidebar: collapsible (hamburger toggle), persists state in localStorage

### Recipes (Dashboard Home)
URL: /dashboard
File: apps/web/app/dashboard/page.tsx
Reach: Sidebar → Recipes
Elements: Recipe grid with search, filter pills, cards with tags/source URL, grid/list/table view toggle, sort options

### Search
URL: /dashboard/search
File: apps/web/app/dashboard/search/page.tsx
Reach: Sidebar → Search

### Import & Scan
URL: /dashboard/scan
File: apps/web/app/dashboard/scan/page.tsx
Reach: Sidebar → Import & Scan
Elements: 3 panels — OCR image upload, URL import, bookmark batch import

### Techniques
URL: /dashboard/techniques
File: apps/web/app/dashboard/techniques/page.tsx
Reach: Sidebar → Techniques

### New Technique
URL: /dashboard/techniques/new
File: apps/web/app/dashboard/techniques/new/page.tsx
Reach: Techniques page → New button

### Meal Plan
URL: /dashboard/plan
File: apps/web/app/dashboard/plan/page.tsx
Reach: Sidebar → Meal Plan
Elements: Weekly meal plan calendar, recipe picker

### Menu Templates
URL: /dashboard/plan/templates
File: apps/web/app/dashboard/plan/templates/page.tsx
Reach: Plan page → Templates link

### Shopping
URL: /dashboard/shop
File: apps/web/app/dashboard/shop/page.tsx
Reach: Sidebar → Shopping
Elements: Shopping lists grouped by aisle, checkboxes

### Cookbooks
URL: /dashboard/cookbooks
File: apps/web/app/dashboard/cookbooks/page.tsx
Reach: Sidebar → Cookbooks
Elements: Cookbook shelf with covers, ratings, ingredient search

### Cookbook Detail
URL: /dashboard/cookbooks/[id]
File: apps/web/app/dashboard/cookbooks/[id]/page.tsx
Reach: Cookbooks page → tap a cookbook

### Discover
URL: /dashboard/discover
File: apps/web/app/dashboard/discover/page.tsx
Reach: Sidebar → Discover
Elements: Public recipe feed

### Speak a Recipe
URL: /dashboard/speak
File: apps/web/app/dashboard/speak/page.tsx
Reach: Sidebar → Speak a Recipe

### Settings
URL: /dashboard/settings
File: apps/web/app/dashboard/settings/page.tsx
Reach: Sidebar bottom → Settings

### Recipe Detail (Public)
URL: /recipe/[id]
File: apps/web/app/recipe/[id]/page.tsx
Reach: Click any recipe card, or direct URL
Params: id (recipe UUID)
Elements: Hero image, servings scaler, ingredients, steps, share CTA

### Technique Detail
URL: /technique/[id]
File: apps/web/app/technique/[id]/page.tsx
Reach: Click any technique card

### Chef Profile
URL: /chef/[username]
File: apps/web/app/chef/[username]/page.tsx
Reach: Click chef attribution
Params: username (string)

### Share Landing
URL: /share/[token]
File: apps/web/app/share/[token]/page.tsx
Reach: Share link from recipe
Params: token (share token)
Elements: Full recipe view, "Add to my Chefsbook" CTA

## Common Patterns

### Opening a recipe on mobile via adb
1. Tap Recipes tab: adb shell input tap 108 2330
2. Wait 2s: sleep 2
3. Tap first recipe card (center of first card): adb shell input tap 540 400
4. Screenshot to verify: adb exec-out screencap -p > C:/Users/seblu/aiproj/chefsbook/cb_adb.png

### Navigating to Scan tab
1. adb shell input tap 540 2330
2. sleep 2
3. Screenshot to verify

### Checking for JS errors after any action
adb logcat -s ReactNativeJS:V ReactNative:V -d | tail -20

### Reloading after a code change
Press r in Metro terminal, or:
adb shell input key 82
# Dev menu opens — tap Reload (position varies)

### Note on ADB tap precision
React Native views don't align with Android's uiautomator — UI hierarchy dumps show no text content. Coordinate-based tapping works for tabs and large touch targets, but small buttons (Edit Recipe, Cook Mode) may not respond reliably. For testing specific button interactions, use the app's JS navigation (router.push) or modify code to expose test hooks.

## Changelog
# Update this section whenever screens change
2026-04-06 — Initial navigator created from full app scan + ADB verification
2026-04-06 — Scan tab redesigned: hero Speak button with pulse, 2x2 icon grid, collapsible URL input, clipboard paste, Chrome share banner
2026-04-06 — Android share target registered (intent filters for VIEW http/https + SEND text/plain)
2026-04-06 — Linking handler added to _layout.tsx for incoming shared URLs
2026-04-17 — Scan tab: dish-photo path now opens GuidedScanFlow (Step A confirm + comments → B 0-3 AI questions → C Anything else? → D single-Sonnet generation) replacing DishIdentificationFlow. Recipe-document path unchanged. Plan gate at startScan() entry blocks free tier before camera opens.
2026-04-17 — Cold launch: 3-second branded splash overlay (cream #faf7f0 bg, chefs-hat asset, "ChefsBook" serif wordmark, "Welcome to ChefsBook" tagline). expo-splash-screen preventAutoHideAsync at module scope + SPLASH_MIN_MS-gated hideAsync. Warm resume never re-shows splash.
