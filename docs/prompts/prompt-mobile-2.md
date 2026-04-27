# Prompt: Mobile-2 — Social Features Parity
# Model: OPUS
# Launch: Read docs/prompts/prompt-mobile-2.md and execute fully.

---

## MANDATORY PRE-FLIGHT

Read ALL of these:
- CLAUDE.md
- apps/mobile/CLAUDE.md
- docs/agents/feature-registry.md — find Prompt O (social features) entry
- docs/agents/testing.md — ADB screenshots mandatory
- docs/agents/ui-guardian.md

**Codebase audit — read before writing anything:**
- apps/web/app/dashboard/ — find the Following tab and What's New feed (web reference)
- apps/web/components/ — find like/save count display components (web reference)
- apps/mobile/app/(tabs)/ — understand current tab structure
- apps/mobile/app/(tabs)/index.tsx — current recipe list (home tab)
- apps/mobile/components/ — scan for existing like/social components

**Launch emulator:**
```bash
emulator -avd Medium_Phone_API_36.1 -no-snapshot -gpu host
```
ADB screenshot of current Discover tab and home tab as baseline.

**Check what social data is available:**
```bash
ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
  -c 'SELECT table_name FROM information_schema.tables
      WHERE table_name LIKE '"'"'%like%'"'"'
         OR table_name LIKE '"'"'%follow%'"'"'
         OR table_name LIKE '"'"'%save%'"'"'
      ORDER BY table_name;'"
```

---

## SCOPE — THREE FEATURES

1. Like and save counts on recipe cards
2. Following tab in Discover (recipes from users you follow)
3. What's New feed (recent public recipes from the community)

---

## FEATURE 1 — Like and Save Counts on Recipe Cards

**Web reference:** Like and save counts appear on recipe cards in search results
and collection views. Find the web component and replicate the data + display.

**What to build:**
- Recipe cards in the home tab (My Recipes) show:
  - ❤️ count — total likes on the recipe
  - 🔖 count — total saves/bookmarks
- Recipe cards in the Discover tab show the same
- Counts are read-only display — tapping the heart still performs the like action
  (already implemented), just ensure the count reflects reality

**Data source:**
- Check if `recipes` table has `like_count` / `save_count` columns
  or if it's computed via JOIN on a likes/saves table
- Match however the web does it — read the web component

**ADB screenshot:** home tab cards showing like/save counts

---

## FEATURE 2 — Following Tab in Discover

**Web reference:** The web dashboard has a "Following" tab showing recipes
from users the current user follows. Find it in apps/web/app/dashboard/.

**What to build:**
- Add a "Following" tab/segment to the Discover screen (alongside "All" or "Popular")
- Shows public recipes from accounts the current user follows
- Sorted by most recent first
- If following nobody: empty state "Follow some chefs to see their recipes here"
  with a "Browse Chefs" CTA

**Data source:**
- Find the follows/following table (from the schema check above)
- Query: public recipes WHERE user_id IN (SELECT following_id FROM follows WHERE follower_id = me)

**ADB screenshot:** Following tab — both populated state and empty state

---

## FEATURE 3 — What's New Feed

**Web reference:** "What's New" shows recent public recipes from the community.
Find the web implementation.

**What to build:**
- "What's New" section or tab in Discover
- Shows the most recent 20 public recipes from any user (not just following)
- Recipe cards with author avatar + username
- Sorted by created_at DESC

**If Discover already has a feed:** verify it's using the right query
(public recipes, sorted by recency) and add the author attribution if missing.

**ADB screenshot:** What's New feed with at least 3 recipes showing

---

## GUARDRAILS

- Do not change web files
- Follow the mobile tab/navigation patterns already established — read existing
  Discover tab code before adding to it
- Recipe card design must match existing mobile card style — do not redesign cards
- All social counts must use the same data source as web (same table/RPC)
- useTheme().colors always — never hardcode hex values

---

## TYPESCRIPT CHECK
```bash
cd apps/mobile && npx tsc --noEmit
```

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION MOBILE-2]`) must include:
- Like/save counts: ADB screenshot filename + which table/field used
- Following tab: ADB screenshot filename + empty state confirmed
- What's New: ADB screenshot filename
- tsc clean confirmed
- EXPLICITLY LIST as SKIPPED: Mobile-3, 4, 5
