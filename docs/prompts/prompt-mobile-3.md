# Prompt: Mobile-3 — Chef Public Profiles + Verified Badge
# Model: OPUS
# Launch: Read docs/prompts/prompt-mobile-3.md and execute fully.

---

## MANDATORY PRE-FLIGHT

Read ALL of these:
- CLAUDE.md
- apps/mobile/CLAUDE.md
- docs/agents/feature-registry.md — find Chef public profiles (Prompt W) entry
- docs/agents/testing.md — ADB screenshots mandatory
- docs/agents/ui-guardian.md

**Codebase audit — read before writing anything:**
- apps/web/app/chef/[username]/ — the full web chef profile page (reference)
- apps/web/components/ — find the verified badge component
- apps/mobile/app/ — understand current navigation structure
- Check if a profile screen already exists in mobile:
  ```bash
  find apps/mobile/app -name "*.tsx" | xargs grep -l "profile\|chef\|username" 2>/dev/null
  ```

**Launch emulator:**
```bash
emulator -avd Medium_Phone_API_36.1 -no-snapshot -gpu host
```
ADB screenshot baseline of current state.

**Check profile/badge schema:**
```bash
ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
  -c 'SELECT column_name FROM information_schema.columns
      WHERE table_name = '"'"'user_profiles'"'"'
      ORDER BY ordinal_position;'"
```
Look for: `is_verified`, `verified_at`, `bio`, `website`, `avatar_url`,
`display_name`, `follower_count`, `recipe_count`.

---

## SCOPE — TWO FEATURES

1. Chef public profile screen in mobile
2. Verified badge (Twitter-style red ✓) wherever usernames appear in mobile

---

## FEATURE 1 — Chef Public Profile Screen

**Web reference:** `apps/web/app/chef/[username]/page.tsx` — read it fully.
The mobile version should match the web layout adapted for mobile viewport.

**What to build:**
- New screen: `apps/mobile/app/chef/[username].tsx`
- Accessible by tapping any username/avatar in the app
  (recipe cards, comments, social feed — wherever @username appears)

**Screen contents:**
- Header: avatar (large, 80px), display name, @username, verified badge if applicable
- Bio text (if set)
- Stats row: X Recipes | X Followers | X Following
- Follow / Unfollow button (if not viewing own profile)
- Recipe grid below — public recipes by this chef
  (same card style as existing recipe lists, tappable to open recipe)
- Empty state if chef has no public recipes

**Navigation:**
- Back button to return to previous screen
- Tapping a recipe card opens recipe detail (existing flow)

**Own profile:** If viewing your own profile, show "Edit Profile" instead of Follow.
Do not build the edit profile screen in this session — just the button state.

**ADB screenshots:** Full profile screen, follow button, recipe grid

---

## FEATURE 2 — Verified Badge

**Web reference:** Find the verified badge component in apps/web/components/.
It's a red ✓ checkmark (pomodoro red `#ce2b37`) displayed inline next to
the username.

**What to build:**
- A `VerifiedBadge` React Native component: small red ✓ icon, 14px
- Apply it everywhere a username appears in mobile:
  1. Recipe cards (next to @username attribution)
  2. Recipe detail screen (next to author name)
  3. Chef profile screen header (built above)
  4. Comments/messages (next to commenter username)
  5. Discover/social feed (next to recipe author)

**Data source:**
- `user_profiles.is_verified` boolean — check this exists from schema audit
- Only show badge when `is_verified === true`

**Design:**
- Match web badge exactly — same red colour, same size proportionally
- Do not use an emoji — use a proper icon (lucide-react-native or a simple SVG)

**ADB screenshots:** Recipe card with badge, recipe detail with badge,
chef profile header with badge

---

## GUARDRAILS

- Do not change web files
- Navigation must use the existing mobile router pattern — read how other
  detail screens are navigated before adding the new route
- The chef profile screen must feel native to the app — match existing screen
  structure (SafeAreaView, ScrollView, existing header pattern)
- useTheme().colors always — `#ce2b37` for badge only as a design constant
  (acceptable exception for a brand colour)
- Do not build edit profile, settings, or any other profile sub-screens

---

## TYPESCRIPT CHECK
```bash
cd apps/mobile && npx tsc --noEmit
```

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION MOBILE-3]`) must include:
- Chef profile: ADB screenshot filenames (full screen, recipe grid, follow button)
- Verified badge: list every screen/component where badge was added
- ADB screenshot showing badge on at least one recipe card
- is_verified column confirmed in schema (show psql result)
- tsc clean confirmed
- EXPLICITLY LIST as SKIPPED: Mobile-4, 5
