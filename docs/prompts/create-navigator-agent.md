# Create Navigator Agent
# Save to: docs/prompts/create-navigator-agent.md

Read CLAUDE.md and apps/mobile/CLAUDE.md to orient yourself.

Your job is to create a specialized navigator agent for ChefsBook that 
documents every screen in both the mobile and web apps. This agent will 
be read by all other agents before attempting any navigation or UI work.

## Step 1 — Scan the mobile app structure

Read every file under apps/mobile/app/ recursively.
For each screen file collect:
- File path
- Route (derived from file path using Expo Router conventions)
- Screen title (from the component or header)
- How to reach it (which tab, which taps)
- Key UI elements visible on screen
- Any params it accepts (from useLocalSearchParams)
- What actions are available (buttons, gestures)

Also read:
- apps/mobile/app/(tabs)/_layout.tsx — tab structure
- apps/mobile/app/_layout.tsx — root navigation and auth flow
- apps/mobile/components/ — all shared components

## Step 2 — Scan the web app structure

Read every file under apps/web/app/ recursively.
For each page collect:
- File path  
- URL route
- Page title
- How to reach it (sidebar nav, direct URL, link from another page)
- Key UI sections on the page
- Any dynamic params ([id], [token] etc.)

Also read:
- apps/web/app/dashboard/layout.tsx — sidebar structure

## Step 3 — Scan via ADB for ground truth

Take adb screenshots of every major screen to document 
what they actually look like right now:

For each screen below, navigate there and capture:
adb exec-out screencap -p > /tmp/cb_screen.png

Then describe in detail what you see (do NOT embed image).
Then delete: Remove-Item /tmp/cb_screen.png -Force

Screens to capture:
1. Landing/auth screen
2. Recipes tab (with recipes loaded)
3. Search tab (default state)
4. Search tab (with filters open)
5. Scan/Import tab
6. Plan tab
7. Shop tab (with items)
8. Recipe detail screen (open any recipe)
9. Recipe detail — edit mode
10. Recipe detail — cook mode
11. Settings/modal screen
12. Chef/profile screen
13. Share screen

For each: navigate using adb input tap commands,
confirm you reached the right screen via logcat,
describe what you see.

## Step 4 — Create the navigator agent

Create .claude/agents/navigator.md with this structure:

---
# ChefsBook Navigator Agent
# Updated: [today's date]
# Purpose: Read this before any navigation or UI work.
# Update this file whenever screens are added or changed.

## How to use this agent
Before doing any UI work, read this file to understand:
- Exact file paths for every screen
- How to navigate there via adb
- What the screen looks like
- What actions are available

## ADB Navigation Commands
# Reload app
adb shell input key 82  # opens dev menu
# then tap Reload

# Take screenshot (always overwrite same file, always delete after)
adb exec-out screencap -p > /tmp/cb_screen.png
# describe what you see, then:
Remove-Item /tmp/cb_screen.png -Force

# Tap by coordinates
adb shell input tap X Y

# Swipe
adb shell input swipe X1 Y1 X2 Y2 300

# Read JS errors
adb logcat -s ReactNativeJS:V ReactNative:V -d | tail -30

# Get current screen coordinates for tapping
# Emulator resolution: [capture and record here]

## Mobile App Structure
# Base path: apps/mobile/app/

### Auth Flow
[populated from scan]

### Tab 1 — Recipes
Route: /(tabs)/index
File: apps/mobile/app/(tabs)/index.tsx
Reach: Tap "Recipes" tab (leftmost, 🍴 icon)
Elements: [populated from scan]
Actions: [populated from scan]

### Tab 2 — Search  
Route: /(tabs)/search
File: apps/mobile/app/(tabs)/search.tsx
Reach: Tap "Search" tab (🔍 icon)
Toggle: My Recipes | Discover
Filters: Cuisine, Course, Ingredient, Dietary, Tags, Cook Time
Elements: [populated from scan]
Actions: [populated from scan]

### Tab 3 — Scan/Import
Route: /(tabs)/scan
File: apps/mobile/app/(tabs)/scan.tsx
Reach: Tap "Scan" tab (📷 icon, center)
Elements: [populated from scan]
Actions: [populated from scan]

### Tab 4 — Plan
Route: /(tabs)/plan
File: apps/mobile/app/(tabs)/plan.tsx
Reach: Tap "Plan" tab (📅 icon)
Elements: [populated from scan]
Actions: [populated from scan]

### Tab 5 — Shop
Route: /(tabs)/shop
File: apps/mobile/app/(tabs)/shop.tsx
Reach: Tap "Shop" tab (🛒 icon, rightmost)
Elements: [populated from scan]
Actions: [populated from scan]

### Recipe Detail
Route: /recipe/[id]
File: apps/mobile/app/recipe/[id].tsx
Reach: Tap any recipe card from Recipes tab
Params: id (recipe UUID)
Elements: [populated from scan]
Actions: [populated from scan]
Edit mode: Tap Edit button (top right) → [populated from scan]
Cook mode: Tap "Cook" button → [populated from scan]

### Recipe New
Route: /recipe/new
File: apps/mobile/app/recipe/new.tsx
Reach: Scan tab → Manual Entry

### Cookbook Detail
Route: /cookbook/[id]
File: apps/mobile/app/cookbook/[id].tsx
Reach: [populated from scan]

### Chef Profile
Route: /chef/[id]
File: apps/mobile/app/chef/[id].tsx
Reach: Tap attribution tag on any recipe, or from Discover results

### Share Screen
Route: /share/[token]
File: apps/mobile/app/share/[token].tsx
Reach: Deep link via share URL

### Settings Modal
Route: /modal
File: apps/mobile/app/modal.tsx
Reach: [populated from scan]

### Speak a Recipe
Route: /speak
File: apps/mobile/app/speak.tsx
Reach: Scan tab → Speak a Recipe button

## Web App Structure
# Base URL: http://localhost:3000

### Landing
URL: /
File: apps/web/app/page.tsx

### Dashboard Shell
URL: /dashboard/*
File: apps/web/app/dashboard/layout.tsx
Sidebar nav items: [populated from scan]

### Recipes
URL: /dashboard
File: apps/web/app/dashboard/page.tsx

### Search
URL: /dashboard/search
File: apps/web/app/dashboard/search/page.tsx

### Import & Scan
URL: /dashboard/scan
File: apps/web/app/dashboard/scan/page.tsx

### Meal Plan
URL: /dashboard/plan
File: apps/web/app/dashboard/plan/page.tsx

### Shopping List
URL: /dashboard/shop
File: apps/web/app/dashboard/shop/page.tsx

### Speak a Recipe
URL: /dashboard/speak
File: apps/web/app/dashboard/speak/page.tsx

### Recipe Detail
URL: /recipe/[id]
File: apps/web/app/recipe/[id]/page.tsx

### Cookbooks
URL: /dashboard/cookbooks
File: apps/web/app/dashboard/cookbooks/page.tsx

### Settings
URL: /dashboard/settings
File: apps/web/app/dashboard/settings/page.tsx

### Chef Profile
URL: /chef/[username]
File: apps/web/app/chef/[username]/page.tsx

### Share Landing
URL: /share/[token]
File: apps/web/app/share/[token]/page.tsx

## Common Patterns

### Opening a recipe on mobile via adb
1. Tap Recipes tab: adb shell input tap [X] [Y]
2. Wait 500ms
3. Tap first recipe card: adb shell input tap [X] [Y]
4. Verify with logcat: adb logcat -s ReactNativeJS:V -d | tail -5

### Triggering edit mode on mobile
1. Navigate to recipe detail (see above)
2. Tap Edit button: adb shell input tap [X] [Y]
3. Verify edit fields are visible

### Checking for JS errors after any action
adb logcat -s ReactNativeJS:V ReactNative:V -d | tail -20

### Reloading after a code change
adb shell input key 82
# dev menu opens — tap Reload (top option)

## Screen Coordinate Map
# Emulator: Medium Phone API 33
# Resolution: [populated from adb shell wm size]
# Tab bar Y coordinate: [populated from scan]
# Tab positions (X coordinates):
#   Recipes: [populated]
#   Search:  [populated]
#   Scan:    [populated]
#   Plan:    [populated]
#   Shop:    [populated]

## Changelog
# Update this section whenever screens change
[today's date] — Initial navigator created from full app scan
---

## Step 5 — Populate all [populated from scan] placeholders

Go back through the file you just created and fill in every 
[populated from scan] placeholder with real data from:
- Your file scan in Steps 1 and 2
- Your adb screenshots in Step 3
- adb shell wm size for the screen resolution
- adb shell input tap coordinates derived from screenshot analysis

For the coordinate map specifically:
Run: adb shell wm size
This gives you the screen resolution.
Then calculate approximate tap coordinates for each tab based 
on the tab bar layout (evenly spaced across screen width,
tab bar at bottom ~70px from bottom edge).

## Step 6 — Add navigator instruction to CLAUDE.md

In the root CLAUDE.md and apps/mobile/CLAUDE.md add this section:

## Navigator Agent
Before doing any UI work, navigation, or screen testing:
READ .claude/agents/navigator.md

This file contains:
- Every screen route and file path
- ADB commands to navigate to any screen
- Screen coordinate maps for tapping
- What each screen looks like
- How to verify you reached the right screen

Update navigator.md whenever you add or modify any screen.
Add a changelog entry with the date and what changed.

## Step 7 — Add navigator update to wrapup agent

In .claude/agents/wrapup.md add this step:

After committing all changes:
- Check if any screens were added, removed, or significantly changed
- If yes: update .claude/agents/navigator.md
  - Update the relevant screen entries
  - Add a changelog entry with today's date
  - Commit the updated navigator: git add .claude/agents/navigator.md

## Rules
- Do not embed screenshots in the conversation
- Delete /tmp/cb_screen.png after every capture
- Populate every placeholder with real data — no [TBD] entries
- Fix any errors without stopping
- Commit navigator.md when complete: 
  git add .claude/agents/navigator.md && 
  git commit -m "feat: add navigator agent with full app screen map"
