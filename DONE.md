# DONE.md - Completed Features & Changes
# Updated automatically at every Claude Code session wrap.

## 2026-04-13 (session 127)
- Two-tier recipe translation system: title-only on import (HAIKU) + full on detail open (Sonnet)
- Migration 034: is_title_only column on recipe_translations
- translateRecipeTitle() in packages/ai — single HAIKU call for all 4 languages (~$0.0002/recipe)
- /api/recipes/translate-title server route for fire-and-forget title translation
- saveWithModeration() triggers title translation after every web import
- Recipe list (dashboard) shows translated titles when language != en via getBatchTranslatedTitles()
- /api/recipes/translate now saves full translation to DB (is_title_only=false), checks cache first
- Recipe detail: title-only translation triggers full Sonnet call; "Hang tight" banner with spinner
- getBatchTranslatedTitles() + getFullTranslation() + saveTitleOnlyTranslations() helpers in packages/db
- Backfill script created and run: 67 recipes × 4 languages = 268 title-only translations
- Feature registry + ai-cost.md updated
- tsc --noEmit passes (web)
- Deployed to RPi5 — build succeeded, PM2 online

## 2026-04-13 (session 126)
- Created /dashboard/chef/[username] profile page inside dashboard layout (sidebar visible)
- Updated 7 files: all internal authenticated links changed from /u/[username] to /dashboard/chef/[username] (RecipeComments, NotificationBell, LikeButton, FollowTabs, messages header, recipe detail attribution + savers)
- Public /u/[username] and /chef/[username] pages remain for external/SEO links
- Verified /recipe/[id] already has sidebar via layout.tsx from session 111 — confirmed working in code
- Admin page links kept at /u/ (correct — admin context, not dashboard)
- Feature registry updated (comment username links entry)
- tsc --noEmit passes (web)
- Deployed to RPi5 — build succeeded, /dashboard/chef/pilzner and /dashboard/chef/seblux both return 200

## 2026-04-13 (session 125)
- Messages thread header: role pill (Super Admin red, Admin orange, Proctor blue, Member grey) sourced from admin_users via supabaseAdmin
- ConversationPreview type extended with other_role field; getConversationList() fetches admin_users roles
- Admin users page: ROLE_STYLES.user label renamed from "User" to "Member" (DB values unchanged)
- Searched entire web app for role display labels — only ROLE_STYLES.user was affected
- Feature registry updated (direct messages entry)
- tsc --noEmit passes (web)
- Deployed to RPi5 — build succeeded, PM2 online, /dashboard/messages returns 200

## 2026-04-13 (session 124)
- Root cause confirmed: supabaseAdmin undefined client-side (SUPABASE_SERVICE_ROLE_KEY not exposed to browser; catch {} swallowed error)
- Created /api/recipe/[id]/like server-side route — toggles like + creates notification via supabaseAdmin
- LikeButton now calls API route with JWT auth instead of toggleLike() directly; optimistic UI preserved with revert on error
- toggleLike() in packages/db cleaned up — back to simple insert/delete, no supabaseAdmin dependency
- Verified end-to-end: POST /api/recipe/{id}/like → {"liked":true,"like_count":1} + notification row in DB
- Verified unlike: no notification created on unlike, like_count correctly decremented to 0
- Feature registry updated (recipe likes entry)
- tsc --noEmit passes (web)
- Deployed to RPi5 — build succeeded, PM2 online

## 2026-04-13 (session 123)
- Diagnosed: confirmed zero recipe_like notifications in DB; likes exist but no notification code ran
- Fix: toggleLike() in packages/db now creates recipe_like notification via supabaseAdmin after like INSERT
- No notification on unlike (delete path) or self-like (owner === liker check)
- Notification includes actor_username + recipe_title for display in bell panel Likes tab
- Verified: service-role notification insert succeeds, row appears in notifications table with correct fields
- Feature registry updated (recipe likes entry)
- tsc --noEmit passes (web)
- Deployed to RPi5 — build succeeded, PM2 online, /dashboard returns 200

## 2026-04-13 (session 122)
- Fix: Bell pill in dashboard header now opens NotificationBell slide-in panel (was navigating to /dashboard/messages)
- Sidebar "Messages" link remains for DM navigation — two systems visually and functionally distinct
- NotificationBell panel: 5 tabs (All/Comments/Likes/Followers/Moderation), unread badge from notifications table
- Added "View Profile →" link on new_follower notifications (was missing — only recipe links existed)
- Removed unused unreadMessages state from dashboard page
- Feature registry updated (dashboard header entry)
- tsc --noEmit passes (web)
- Deployed to RPi5 — build succeeded, PM2 online, /dashboard returns 200

## 2026-04-13 (session 121)
- Messages chat UI polish: avatar initials on received messages (left side of bubble)
- Compose area switched from single-line input to auto-resizing multiline textarea
- whitespace-pre-wrap on message content to preserve line breaks
- Supabase Realtime subscription: incoming messages append to open thread and refresh conversation list
- Diagnosed DB: only 1 message existed; added 3 test messages to create a real pilzner↔seblux conversation
- getConversation() verified correct — returns all messages ordered by created_at ASC
- Feature registry updated (direct messages entry)
- tsc --noEmit passes (web)
- Deployed to RPi5 — build succeeded, PM2 online, /dashboard/messages returns 200

## 2026-04-13 (session 120)
- Fix: Onboarding bubbles scroll to target before positioning (scrollIntoView smooth/center)
- Added 2 new onboarding pages: cookbooks + techniques (content + layout pageMap)
- Added 8 data-onboard attributes: scan (scan, url, speak), plan (week-nav, add-meal), shop (store-group), cookbooks (cookbooks-list), techniques (techniques-list)
- Fix: Dismiss UX clarified — "Got it" advances per-page, "Turn off tips" disables globally, removed intermediate confirm dialog
- Fix: createNotification() now uses supabaseAdmin (bypasses RLS — notifications are system-level inserts for another user)
- Diagnosed notification RLS issue: authenticated role INSERT blocked by supautils despite WITH CHECK (true) policy; supabaseAdmin required
- Messages inbox verified working — DM visible to seblux via RLS (was tested before session 119 fix deployed)
- Feature registry updated (onboarding bubbles 8 pages, comment notifications supabaseAdmin)
- tsc --noEmit passes (web)
- Deployed to RPi5 — build succeeded, PM2 online, all pages 200

## 2026-04-13 (session 119)
- Fix: Admin DM RLS bug — sendMessage() now accepts optional client param; admin route passes supabaseAdmin to bypass RLS
- Fix: reply_count trigger — ALTER FUNCTION update_reply_count() SECURITY DEFINER; cross-user reply counts now work
- Fixed 2 stale reply_count values via bulk recalculation
- Pilzner account diagnosed: auth state healthy, login verified working (a@aol.com kept per user request)
- Admin DM verified: POST /api/admin sendMessage → {"ok":true}, message confirmed in direct_messages table
- reply_count trigger verified: seblux reply to pilzner comment incremented reply_count 0→1
- Known issues updated: removed both fixed bugs from CLAUDE.md
- Feature registry updated (direct messages entry)
- Deployed to RPi5 — build succeeded, PM2 online, all pages 200

## 2026-04-13 (session 118)
- Replaced chef hat image with new CBHat.png (1088x1088 RGBA) across web + mobile
- Web: chefs-hat.png + chefs-hat-hd.png replaced in apps/web/public/images/
- Mobile: chefs-hat.png added to apps/mobile/assets/images/, RecipeImage updated to use it (was icon.png)
- Verified object-fit: contain at all hat usage points (landing hero, footer, dashboard cards, plan cards, search cards, extension page, feedback card)
- Web: /images/chefs-hat.png and /images/chefs-hat-hd.png return HTTP 200 on RPi5
- tsc --noEmit passes (web)
- Deployed to RPi5

## 2026-04-13 (session 117 — verification sweep)
- Verification sweep: 10 features tested on live RPi5 via authenticated API calls + psql
- PASS: Comments level-3 depth — reply to reply saves with correct parent_id chain
- PASS: Username links in comments — /u/pilzner and /u/seblux both return HTTP 200
- PASS: Comment likes — insert into comment_likes triggers like_count increment via SECURITY DEFINER trigger
- PASS: Meal plan correct day — insert with local date 2026-04-13 stores and queries correctly
- PASS: Savers modal — two-step supabaseAdmin query returns saver profile without error
- PASS (partial): Recipe translation — /api/recipes/translate route live, authenticates, validates; skipped live Claude call
- CANNOT TEST (3): Comment notifications, onboarding bubbles, help tips toggle — require browser interaction
- FAIL: Admin DM — sendMessage() uses supabase (anon) instead of supabaseAdmin; RLS blocks insert (auth.uid() is null in server context)
- BUG FOUND: reply_count trigger not SECURITY DEFINER — RLS blocks parent comment UPDATE when different user replies
- All test data cleaned up after sweep

## 2026-04-13 (session 116)
- Migration 034: import_site_tracker table + seriouseats.com seed entry
- /admin/import-sites: new page with filter pills (All/Working/Partial/Broken/Unknown), edit modal for status + known issue, mark as reviewed
- URL import route: auto-tracks domain success/failure rates on every import attempt
- /admin/recipes: moderation status info tooltip (clean/mild/serious), ChefsDialog confirmations on approve/reject, approve unfreezes user + sends notification, reject sets private + notifies, search toggle (Title vs Username)
- /admin/flags: rewritten to query comment_flags (was broken — queried notifications table), shows comment content + commenter + recipe + flagged-by, approve/remove actions
- /admin/messages: now includes user-flagged messages (via message_flags table), shows flag count + reasons per message
- /admin/reserved-usernames: approve modal with user search dropdown (sets approved_for_user_id), AI-flagged usernames section at top (username_impersonation flags), Approved For column with profile link
- Import Sites added to admin sidebar nav
- PostgREST restarted after migration
- All admin queries through /api/admin route (no client-side supabaseAdmin)
- Feature registry updated (5 new/updated entries)
- tsc --noEmit passes (web)
- Deployed to RPi5 — all admin pages return 200

## 2026-04-13 (session 115)
- Fix: Meal plan date timezone bug — formatDate() used toISOString() (UTC), causing date to roll forward in evening hours; replaced with local date formatting in MealPlanPicker (web + mobile), plan page (web + mobile), and mealPlanStore
- Root cause diagnosed via psql: inserts were happening but dates shifted by UTC conversion
- Fix: Consolidated store list formatting — web now uses same shop-item-grid CSS class as individual lists (responsive 5/6-column layout)
- Fix: Consolidated list view mode toggle (Dept/Recipe/A-Z) added to both web and mobile
- Fix: Mobile consolidated list now has font size toggle and "in recipe" usage text matching individual list format
- Feature registry updated (MealPlanPicker timezone fix, consolidated list formatting)
- tsc --noEmit passes both apps (mobile has pre-existing auth/expo-file-system errors only)
- Deployed to RPi5 — build succeeded, plan + shop pages return 200

## 2026-04-13 (session 114)
- Fix: Onboarding bubbles not showing — added missing data-onboard="logo" to Sidebar ChefsBook link (first bubble target was unanchored)
- Fix: OnboardingOverlay auto-skips bubbles whose DOM target doesn't exist (prevents sequence from blocking on missing elements)
- Fix: Settings Help Tips toggle — replaced plain "Toggle" text button with proper ON/OFF switch (red when on, grey when off)
- Fix: Added missing data-onboard="plan-tier" on settings plan section
- Fix: Recipe content translation on web — created /api/recipes/translate server-side API route (recipe page already called it but route was never created; Claude API blocks browser CORS)
- Feature registry updated (onboarding bubbles, help tips toggle, recipe translation)
- Deployed to RPi5 — build succeeded, all pages return 200

## 2026-04-13 (session 112)
- Migration 033: comment_likes table with RLS + like_count column on recipe_comments + trigger
- Comment sorting: top-level comments sorted by engagement (reply_count + like_count DESC), replies chronological
- Comment likes: toggleCommentLike() + heart icon with optimistic UI on web + mobile; plan-gated (Chef+)
- Unlimited comment depth: replies to replies supported; level 3+ collapsed behind "N more replies" expand button
- Reply button on every comment at every depth level (was only on top-level)
- Web username link fix: /chef/{user_id} → /u/{username} (was 404)
- Comment notifications: recipe owner notified on new comment (recipe_comment); parent commenter notified on reply (comment_reply)
- getComments() now accepts optional currentUserId for isLiked per comment
- PostgREST restarted after migration
- Feature registry updated (3 new entries + 1 updated)
- tsc --noEmit passes both apps
- Deployed to RPi5

## 2026-04-12 (session 110)
- Migration 032: reserved_usernames (22 seed entries), user_account_tags, user_flags tables
- /admin/reserved-usernames page: CRUD with All/Reserved/Approved filter pills
- Signup: blocks reserved usernames (checks reserved_usernames table with public SELECT RLS)
- /admin/users: email column (via auth.admin.listUsers), account status tags (color-coded pills + popover), flag icon (⚑), message button, bulk select + bulk messaging with progress
- /admin/users: tag filter pills (dynamic from DB), flagged-only filter
- /admin/recipes: sortable columns (title, submitter, visibility, status, date) + submitter attribution pill
- /api/admin route: 10 new actions (reserved CRUD, tags, flags, sendMessage)
- All via /api/admin server-side — zero supabaseAdmin in client code
- Feature registry updated (6 new entries)
- Build now requires 1280MB on RPi5 (was 1024)
- Deployed to RPi5

## 2026-04-12 (session 109)
- Architecture: moved ALL supabaseAdmin calls from client components to server-side /api/admin route
- Created /api/admin/route.ts: GET (users, recipes, messages, promos, help) + POST (15 mutation actions)
- Created adminFetch/adminPost helpers (apps/web/lib/adminFetch.ts)
- Rewrote 5 admin pages: users, recipes, messages, promos, help — zero supabaseAdmin in client code
- Admin auth verified server-side (JWT + admin_users check) in every API call
- SUPABASE_SERVICE_ROLE_KEY confirmed present on RPi5
- Feature registry updated
- Deployed to RPi5 — all 6 admin pages return 200

## 2026-04-12 (session 108)
- Fix: Savers modal — getSavers() rewritten as two-step query via supabaseAdmin (was failing: recipe_saves FK→auth.users not user_profiles)
- Fix: Savers modal loading/error states (was stuck on "Loading..." forever on failure)
- Fix: Pluralization "1 person saved this" / "N people saved this"
- Fix: Deleted duplicate Homemade Biscuits recipe (3e3131f1) + child rows (notifications, ingredients, steps, etc.)
- search_recipes RPC: added DISTINCT ON (r.id) to prevent duplicate rows
- Verified on RPi5: 1 Homemade Biscuits, 1 recipe_saves row (seblux), 68 total recipes
- Feature registry updated
- Deployed to RPi5

## 2026-04-12 (session 107)
- Admin User Ideas: sender avatar (initials circle, clickable → /u/[username]) + @username link + email + relative timestamp per message
- Graceful fallback: "Anonymous" shown when username is null
- Subject "Feedback" hidden (redundant — all are feedback)
- Verified: 2 test messages (pilzner + seblux) have username + email populated in DB
- Feature registry updated
- Deployed to RPi5 — /admin/help returns 200

## 2026-04-12 (session 106)
- Renamed "Help Requests" → "User Ideas" in admin nav + page title (DB table unchanged)
- Admin help page: switched from supabase to supabaseAdmin (was blocked by RLS), shows username + email
- Admin messages page: added try/catch + error state (was stuck on Loading on failure)
- Admin recipes page: added try/catch + error state
- Admin users page: switched user_profiles query from supabase to supabaseAdmin + try/catch
- All 4 admin pages: loading=false guaranteed in both success and error paths
- Feature registry updated
- Deployed to RPi5 — all admin pages return 200

## 2026-04-12 (session 105)
- Fix: Feedback card — added "Minimum 10 characters" helper below textarea (muted grey when empty, red with count when <10, green "Ready to send" at 10+)
- Fix: Cuisine dropdown — now shows full list of 31 cuisines on open (was filtering by saved value, showing only 1 match)
- Root cause: input `value={recipe.cuisine}` used saved value as filter; fixed to use separate `cuisineFilter` state that starts empty
- Current cuisine highlighted in dropdown with primary color + light background
- Typing filters the list; selecting saves and closes
- Deployed to RPi5 — build succeeded, site loads (200)

## 2026-04-12 (session 104)
- BUG 1: Default recipe visibility changed from shared_link to public (DB + migration 030)
- Migrated all 65 shared_link recipes to public
- BUG 2: "Add to my Chefsbook" now uses saveRecipe() (recipe_saves) instead of cloneRecipe() (no more duplicates)
- Updated: web recipe detail, mobile search, mobile chef profile, mobile share page
- listRecipes() fallback now includes saved recipes via recipe_saves JOIN
- search_recipes RPC updated to include saved recipes in user's results (migration 031)
- Cleaned up 1 existing clone → converted to recipe_saves row
- PostgREST restarted for new function
- Feature registry updated (visibility, save-not-clone)
- Deployed to RPi5

## 2026-04-12 (session 103)
- Fix: Feedback card submit — errors now display inline inside modal (was closing modal then showing separate error dialog, making errors invisible)
- Diagnosed DB: help_requests table + RLS correct; insert works via authenticated JWT (verified with curl)
- Root cause: catch block closed modal before error could be shown; also min-length hint was missing from placeholder
- Test row confirmed in help_requests on RPi5
- Feature registry updated
- Deployed to RPi5

## 2026-04-12 (session 102)
- Fix: Bookmark save count icon now always visible on recipe detail (was hidden when save_count = 0)
- Root cause: conditional `(recipe.save_count ?? 0) > 0 &&` hid the entire bookmark section — all recipes have 0 saves
- Web: removed >0 gate, bookmark icon + "0" always renders next to like heart (owner can still click to see savers when count > 0)
- Mobile: same fix on recipe detail Likes + Saves row
- Deployed to RPi5 — build succeeded, recipe page returns 200

## 2026-04-12 (session 101)
- Dashboard header: removed floating bell + duplicate Add Recipe from layout
- Dashboard page: Messages pill (red border, bell icon, unread badge) in clean flex row with Select + Add Recipe
- Mobile: message compose via bottom sheet (char counter, error handling) — replaced broken Alert.prompt
- Sidebar: Messages nav shows live unread count badge
- Feature registry updated (header, message button entries)
- Cloudflare tunnel restart needed (502 → 200 after systemctl restart cloudflared)
- Deployed to RPi5

## 2026-04-12 (session 100)
- Fix: Attribution pills missing — root cause: original_submitter_id was NULL on all 69 recipes (backfill never ran)
- DB backfill: SET original_submitter_id = user_id, original_submitter_username = profile.username for all 69 recipes
- Verified: 0 recipes remaining with NULL original_submitter_id
- Verified: Homemade Biscuits now has original_submitter_username = 'pilzner' + source_url = preppykitchen.com
- Verified: Web attribution row code (line 883) already shows BOTH @username pill AND source URL pill side by side — no code changes needed
- Verified: Mobile attribution row (line 1190) uses same pattern — also correct
- Recipe page loads (200) — both pills now render from backfilled data
- Feature registry updated: attribution pill note "backfill applied session 99"
- No code changes or deploy needed — data-only fix

## 2026-04-12 (session 99)
- Web: useUnits() shared hook — reads unit preference from DB, syncs across components via localStorage events
- Web recipe detail: ingredients convert via convertIngredient() based on user's kg/lb preference
- Web shopping list: raw quantity/unit converted on display
- Web sidebar toggle refactored to use shared useUnits() (reactive across all pages)
- Mobile: conversion already wired (preferencesStore + convertIngredient) — no changes needed
- Feature registry: Metric/Imperial toggle PARTIAL → LIVE
- Deployed to RPi5

## 2026-04-12 (session 98)
- Migration 029: direct_messages + message_flags tables, unread_messages_count on user_profiles, trigger for unread increment
- DB: sendMessage, getConversation, getConversationList, markMessagesRead, flagMessage, deleteMessage, getUnreadMessageCount in packages/db
- AI: moderateMessage() using HAIKU model (~$0.00016/call) — clean/mild/serious verdicts
- Web: /dashboard/messages page with conversation list (left) + thread view (right), compose area, flag flow
- Web: MessageButton component on /u/[username] and /chef/[username] profiles (hidden on own profile)
- Web: Messages link added to sidebar nav
- Web: Admin /admin/messages page with approve/remove for flagged messages
- Mobile: Message button on chef profile with Alert.prompt compose
- Feature registry updated: 4 new direct messaging entries
- tsc --noEmit passes both apps
- Deployed to RPi5 — build succeeded, /dashboard/messages returns 200, direct_messages table confirmed in DB

## 2026-04-12 (session 97)
- Web: Cuisine field replaced with searchable dropdown combobox (31 cuisines + custom entry)
- CUISINE_LIST expanded from 20 to 31 cuisines in packages/ui
- Web + Mobile: Save count bookmark icon + count displayed next to likes on recipe detail
- Web: Savers modal — owner clicks save count to see who saved (same pattern as likers)
- getSavers() function added to @chefsbook/db
- Attribution row verified: already shows both submitter + source URL (no fix needed)
- Feature registry updated
- Deployed to RPi5

## 2026-04-12 (session 96)
- Web+Mobile: Servings mismatch warning in MealPlanPicker — triggers when adding recipe with >2x serving difference vs existing day meals
- Web: Combined shopping list upgraded — checkboxes (local-only), dept grouping, view mode toggle, font size, purchase unit (red), usage amount (green), recipe source per item, banner with source list names
- Mobile: Combined shopping list upgraded — checkboxes (local-only), green usage amount, recipe source per item
- Feature registry updated: consolidated view + portions mismatch entries
- tsc --noEmit passes both apps
- Deployed to RPi5 — build succeeded, /dashboard/shop returns 200

## 2026-04-12 (session 95)
- Fix: Comments show on ALL recipe pages (removed visibility === 'public' gate)
- Fix: Notification bell LEFT of "Add Recipe" button in dashboard header
- Fix: Language selector filtered to 5 supported languages (was showing 28)
- Fix: "Add to my Chefsbook" clones recipe via cloneRecipe() (was just link to /dashboard)
- Metric/imperial toggle marked PARTIAL (saves to DB, web recipe detail conversion not wired)
- Feature registry updated for all touched features
- Deployment pending — RPi5 unreachable

## 2026-04-12 (session 94)
- Created .claude/agents/feature-registry.md — 90+ features across 13 sections populated from DONE.md
- Updated wrapup.md — mandatory registry update step before committing
- Updated CLAUDE.md — feature-registry.md in agent table + session start step 3a
- CLAUDE.md improvements: fixed subscription tiers, updated nav names, added supabaseAdmin, --no-lint build fix

## 2026-04-11 (session 93)
- Web sidebar: Recipes → My Recipes, Techniques → My Techniques, Cookbooks → My Cookbooks (5 locales)
- Mobile tab bar: Recipes → My Recipes (5 locales)
- Deployed to RPi5

## 2026-04-11 (session 92)
- Fix: Recipe visibility — `shared_link` recipes were invisible to other users in search, feed, profiles, and follows
- Root cause: all public recipe queries filtered `visibility = 'public'` only, excluding `shared_link` (66 of 69 recipes)
- Updated `search_recipes` RPC: `r.visibility IN ('public', 'shared_link')` when `p_include_public = true`
- Updated `get_public_feed` RPC: same `IN ('public', 'shared_link')` filter (dropped + recreated)
- Updated `listPublicRecipes()`, `getFollowedRecipes()`, `getPublicProfileWithRecipes()` in packages/db
- Updated web profile pages (`/u/[username]`, `/chef/[username]`) and mobile chef profile
- PostgREST restarted to pick up new function definitions
- Verified: seblux100 now sees 69 recipes (was 3) via search_recipes RPC
- Deployed to RPi5 — build succeeded, site loads (200)

## 2026-04-11 (session 91)
- SMTP configured on RPi5 (Resend) — password recovery emails working
- GOTRUE_SITE_URL set to https://chefsbk.app with redirect allowlist
- Web: "Forgot password?" link on sign-in, /auth/reset page handles token + password update
- Web: Change Password section in dashboard settings
- Mobile: Forgot password modal on sign-in screen
- Mobile: Change Password card in settings modal
- i18n keys for password features (5 locales)
- Deployed to RPi5

## 2026-04-11 (session 90)
- Promo code placeholder changed to "disco20" on signup page
- Admin promos: supabaseAdmin + error feedback on create/delete/toggle
- Admin users: Role column with color-coded pills (super_admin/admin/proctor/user)
- Admin users: sortable columns (username, plan, role, joined) with arrow indicators
- Admin users: inline username edit with availability check via supabaseAdmin
- Sidebar Admin link: pomodoro red, same font size as Settings
- Admin recipes: supabaseAdmin, public recipe limit raised to 200
- Web search: "All Recipes" / "My Recipes" pill toggle, default All (includes public)
- Mobile search: default All Recipes, swapped pill order, i18n keys (5 locales)
- Deployed to RPi5 — all pages return 200

## 2026-04-11 (session 89)
- Root-caused /admin redirect: admin_users RLS policy had infinite recursion (EXISTS subquery on same table triggers same policy)
- Fixed RLS: replaced self-referencing policy with direct `user_id = auth.uid()` column check
- Verified end-to-end: seblux100 sign-in → JWT → admin_users query returns super_admin via production API
- Migration 028: `20260411_028_fix_admin_rls.sql` applied and saved
- Confirmed chefsbk.app/admin returns 200

## 2026-04-11 (session 88)
- Root-caused /admin redirect bug: server component getSession() returns null (no auth cookie context)
- Converted admin layout.tsx to client component — auth check runs in browser with live session
- Admin sub-pages (overview, limits) switched to supabaseAdmin for server-side data access
- Deployed to RPi5 — /admin returns 200, admin check works correctly

## 2026-04-08 (session 87)
- Created `supabaseAdmin` service role client export in `@chefsbook/db` (bypasses RLS)
- Fixed /admin route — layout.tsx uses service role client to query admin_users
- Added Admin link with shield icon in web sidebar (visible only to admin users)
- Verified admin_users DB state: both pilzner + seblux rows correct with super_admin role
- Deployed to RPi5 — chefsbk.app/admin accessible for both admin accounts

## 2026-04-11 (session 86)
- Migration 027: reply_count + trigger on recipe_comments, notifications expanded
- Web: threaded comments — nested replies, inline reply input, "▶ N more replies" expander
- `postComment()` accepts parentId; reply creates notification for parent commenter
- DB helpers: createNotification, getNotifications, getUnreadCount, markRead, markAllRead
- NotificationBell: pulse badge, slide-in panel with 5 tabs, mark-all-read
- Tested all 3 notification types via psql; deployed to RPi5

## 2026-04-11 (session 85)
- Fix: "Database error querying schema" on sign-in for seblux100@gmail.com
- Root cause: GoTrue can't scan NULL token columns (confirmation_token, recovery_token, email_change_token_new, etc.) — user was created with auto-confirm which left tokens as NULL
- Fix: SET all NULL token columns to empty string for seblux100 user in auth.users
- PostgREST restarted (not the root cause — schema cache loaded fine with 59 relations)
- Verified: both pilzner and seblux100 accounts sign in successfully via API (JWT returned)
- Verified: /auth page loads (200)

## 2026-04-11 (session 84)
- Web: "All [Store]" combined entry added as FIRST item in store groups with 2+ lists (green COMBINED badge)
- Web: Combined view — fetches items from all lists for a store, merges by ingredient+unit, groups by department
- Web: Combined view is read-only with banner showing source list names and "View individual lists →" link
- Web: Back button returns to shopping overview; single-list stores show no combined entry
- Mobile: Combined entry + CombinedStoreView already existed from session 03 — verified still working
- Verified: Whole Foods has 3 lists (27 total items) → combined entry shows; ShopRite/DeCiccos have 1 list → no combined
- Deployed to RPi5 — build succeeded, /dashboard/shop returns 200
- Consolidated store list view implemented and tested — stores with 2+ lists show 'All [Store]' combined entry as first item; combined view merges items by ingredient+unit with department grouping; verified on both web and mobile.

## 2026-04-11 (session 83)
- Enabled GOTRUE_MAILER_AUTOCONFIRM=true on RPi5 (no SMTP configured)
- Created seblux100@gmail.com account (auth.users + user_profiles: username seblux, Pro plan)
- admin_users: pilzner + seblux both super_admin
- CLAUDE.md: email config + admin accounts documented

## 2026-04-11 (session 82)
- DB: Normalized all store names to Title Case (stores table + shopping_lists.store_name)
- DB: Added case-insensitive unique index on stores (user_id, lower(name)) — prevents duplicate store creation
- DB: Verified zero duplicate stores after normalization
- Web: Store grouping now case-insensitive — groups by lower(store_name), displays Title Case
- Mobile: Store grouping now case-insensitive — same pattern
- Code: createStore() now normalizes name to Title Case via toTitleCase() before insert
- Verified: 3 Whole Foods shopping lists all show same store_name + same store_id with logo
- Deployed to RPi5 — build succeeded, /dashboard/shop returns 200

## 2026-04-11 (session 81)
- Fix: comments not loading — root cause: ambiguous FK `user_profiles!inner` on `recipe_comments` (two FKs: user_id + reviewed_by)
- Changed to explicit `user_profiles!recipe_comments_user_id_fkey` in `getComments()`
- Test comment posted + verified via curl (API returns comments with username)
- Deployed to RPi5

## 2026-04-11 (session 80)
- Fix: Store logos not showing on web — root cause: logo_url was NULL for all 5 stores (backfilled before createStore existed)
- DB backfill: set domain + logo_url for 4 real stores (Whole Foods, ShopRite, Stop and Shop, DeCiccos) using logo.dev URLs
- Verified: logo.dev returns 200 image/jpeg for wholefoodsmarket.com
- No code changes needed — web StoreAvatar already renders <img src={store.logo_url}> when present
- Fix: Site was crash-looping (502) due to duplicate React — ran npm install react@19.1.0 + npm dedupe + rebuild
- Deployed to RPi5 — build succeeded, pm2 restarted, chefsbk.app + /dashboard/shop both return 200

## 2026-04-11 (session 79)
- Web+Mobile: removed 3 duplicate source references (old attribution pill, View Original link, "Original recipe at" text)
- Only attribution row pills remain as single source reference
- Deployed to RPi5

## 2026-04-11 (session 78)
- Extension production-ready: URLs → chefsbk.app, dev creds removed, button red, manifest v1.0.0
- Extension packaged as zip; download route at `/extension/download` (200, application/zip)
- Install page at `/extension` — how-it-works, manual install steps, download link
- "Extension" added to sidebar with puzzle piece icon
- Deployed to RPi5 — page + download verified live
- Chrome Web Store next: register dev account ($5), upload zip, fill listing, submit for review

## 2026-04-11 (session 77)
- Privacy policy page at `/privacy` — 10 sections, plain language, Trattoria styling
- Footer link added to landing page
- Deployed to RPi5 — HTTP 200 confirmed

## 2026-04-11 (session 76)
- Web+Mobile: attribution row shows both user pill + source pill side by side (was either/or)
- User pill falls back to current user's username when original_submitter is empty
- Removed "Public" badge from recipe detail read-mode (web + mobile)
- Deployed to RPi5

## 2026-04-11 (session 75)
- Migration 026: onboarding columns on user_profiles
- `OnboardingBubble` component with @floating-ui/react positioning, arrow, step indicator
- `useOnboarding` hook — tracks seen pages per user, dismiss confirmation, completion celebration
- 6 pages of bubble content (dashboard, recipe, scan, shop, plan, settings)
- `data-onboard` attributes on sidebar nav items; `OnboardingOverlay` in dashboard layout
- Settings: Help Tips toggle (enable/disable + reset)
- Deployed to RPi5

## 2026-04-11 (session 74)
- Mobile: `shoppingCache.ts` — FileSystem cache for lists (detail, overview, checked items, pending edits)
- Mobile: shopping store offline fallback — fetch fails → load from cache, `isOffline`/`checkedItemIds` state
- Mobile: `toggleItemLocal()` local-only check-off + `syncPendingEdits()` on reconnect
- Mobile: offline amber banner in list detail
- Web: sync status indicator (↻ Syncing / ✓ Synced / ⚠️ Connection issue); deployed
- Note: airplane mode test pending (no emulator connected)

## 2026-04-11 (session 73)
- DB: help_requests table updated with user_email, username, message columns + INSERT RLS policy
- Web: FeedbackCard — pinned at position 1 in recipe grid, modal form, ChefsDialog thank-you/error
- Mobile: FeedbackCard — FlashList header, bottom sheet form with safe area insets
- i18n: `feedback` namespace; deployed to RPi5

## 2026-04-11 (session 72)
- Web: Attribution pill on recipe detail — shows user (@username), cookbook (📖 title), or URL (🔗 domain ↗) below title
- Mobile: Attribution pill on recipe detail — same logic with TouchableOpacity, theme colors, Linking for external URLs
- Attribution priority: original_submitter_username → cookbook_id → source_url → null (no pill)
- Verified: source_url stored on URL-imported recipes (5 confirmed in DB)
- Verified: no original_submitter or cookbook data in current recipes → URL pill is primary visible attribution
- tsc --noEmit passes both apps
- Deployed to RPi5 — build succeeded, pm2 restarted, recipe page loads (200)

## 2026-04-11 (session 71)
- Fix: Meal type picker dialog — moved 4 buttons from dialog footer into body as 2x2 grid, eliminates overflow
- Deployed to RPi5

## 2026-04-11 (session 70)
- Web: Daypart pill opens ChefsDialog with 4 pill buttons (Breakfast/Lunch/Dinner/Snack), current slot highlighted red
- Web: Servings pill opens ChefsDialog with −/count/+ stepper (min 1, max 20), pre-filled with current value
- Both dialogs update meal_plans DB and refresh pill on card immediately
- Removed all native prompt() calls from web meal plan page (zero remaining anywhere in web app)
- Verified: mobile pills already use styled components from session 46 — no fix needed
- Deployed to RPi5 — build succeeded, pm2 restarted, chefsbk.app/dashboard/plan loads (200)

## 2026-04-11 (session 69)
- Web: `StoreAvatar` component (logo.dev + initials fallback with color hash)
- Web shopping: lists grouped by store with StoreAvatar headers, "Other" for unassigned
- Stores fetched in parallel via `getUserStores()`
- Deployed to RPi5 (build requires 1024MB — 768MB causes OOM)

## 2026-04-11 (session 68)
- Web parity sweep: all pages verified HTTP 200 (shopping, plan, settings, auth, plans, recipe detail, admin redirect)
- Image proxy + chef's hat + Supabase REST API all confirmed working via curl
- TypeScript clean, no debug console artifacts
- Built release APK (111MB) — includes all sessions 26-67 features

## 2026-04-11 (session 67)
- Fix: Dark overlay blocking chefsbk.app — root cause was corrupted `.next` build dir from a failed SIGKILL build
- Clean rebuild (`rm -rf .next` + remove duplicate React) resolved the issue
- User confirmed site fully interactive after redeploy

## 2026-04-11 (session 66)
- Fix: NEXT_PUBLIC_SUPABASE_URL changed to `https://api.chefsbk.app` on RPi5 — eliminates mixed content ws:// error
- Created `apps/web/.env.production` with public Supabase URL
- Verified Cloudflare Tunnel passes Supabase API + WebSocket upgrade
- Confirmed `api.chefsbk.app` baked into client JS bundle; deployed to RPi5

## 2026-04-10 (session 65)
- Fix: PostgREST schema cache refreshed — `docker restart supabase-rest`; recipe_comments now accessible
- Fix: Web LikeButton — heart toggle separated from count click; owner count opens likers modal; non-owner count is plain text
- Fix: Duplicate React build failure resolved (rm apps/web/node_modules/react before build)
- Deployed to RPi5 — shopping, recipe detail, comments all return HTTP 200

## 2026-04-10 (session 64)
- Verified: suggestPurchaseUnits already on claude-haiku-4-5-20251001 (model: HAIKU, maxTokens: 800) — no change needed
- Confirmed: all ai-cost agent known problems resolved (moderation, username check, purchase units all on Haiku)

## 2026-04-10 (session 63)
- DB backfill: 6 shopping lists updated with store_id FK matching stores table by store_name
- Verified: 4 lists without store_name remain with NULL store_id (correct)
- Added store_id to ShoppingList type in packages/db/src/types.ts
- Verified: queries use select('*') without INNER JOIN — no crash for NULL store_id
- Verified: all web + mobile components use store_name (string), not store.name (join) — safe for null
- Verified: createShoppingList already passes store_id from StorePicker
- LEFT JOIN test confirmed: stores join returns NULL gracefully for storeless lists
- Deployed to RPi5 — build succeeded, pm2 restarted, chefsbk.app shopping page loads (200)

## 2026-04-10 (session 62)
- Installed ai-cost.md agent in `.claude/agents/`
- CLAUDE.md: added ai-cost.md to agent lookup table (MANDATORY for AI features)
- CLAUDE.md: SESSION START updated to 9 steps (added ai-cost.md as step 5)

## 2026-04-10 (session 61)
- Full AI cost audit: identified 28 callClaude() invocations across 19 files in @chefsbook/ai
- Added `model` parameter to `callClaude()` — defaults to Sonnet, accepts `HAIKU` constant for cheap tasks
- Switched 12 classification functions to claude-haiku-4-5-20251001 (~4x cheaper):
  - moderateComment, moderateRecipe, isUsernameFamilyFriendly, classifyContent, classifyPage
  - suggestPurchaseUnits, analyseScannedImage, reanalyseDish, matchFolderToCategory
  - readBookCover, generateSocialPost, generateHashtags
- Kept Sonnet for 16 complex generation/extraction calls (translate, import, scan, meal plan, etc.)
- Trimmed moderateRecipe prompt: ingredients capped at 5, steps at 3 (100 chars each), description/notes at 200 chars
- Tightened max_tokens: moderateComment 200→100, moderateRecipe 200→150, username check 100→50, purchase units 1500→800
- Added AI cost reference table to CLAUDE.md with per-function model, cost estimate, and cache status
- Deployed to RPi5 — build succeeded, pm2 restarted, chefsbk.app live

## 2026-04-10 (session 60)
- Fix: I18nProvider no longer blocks render — renders children immediately with English, loads user language async
- Fix: Shopping list openList() wrapped in try/catch — shows user-friendly error instead of crash
- Verified DB: shopping_lists.store_id column exists, stores table has 5 backfilled rows
- Deployed to RPi5 — shopping page returns HTTP 200

## 2026-04-10 (session 59)
- Migration 025: Shared recipe translations — RLS changed from owner-only to public-read + auth-write
- Verified: no user_id column on recipe_translations (already correct), UNIQUE(recipe_id, language) already in place
- Verified: getRecipeTranslation/saveRecipeTranslation already have no user_id scoping
- Verified: replaceIngredients + replaceSteps already invalidate translation cache (inline supabase.delete)
- Verified: 2 existing French translations preserved after migration (Ramen au Poulet Frit, La Tarte aux Poires)
- RLS tested: SELECT policy now USING(true) — any user can read translations (not just recipe owner)
- Deployed to RPi5 — build succeeded, pm2 restarted, chefsbk.app live

## 2026-04-10 (session 58)
- Web i18n: installed react-i18next, copied 5 locale files to apps/web/locales/ with `web` namespace
- I18nProvider reads user's preferred_language from profile, wraps entire app
- Sidebar nav labels + Settings + Sign out translated via useTranslation()
- Language switcher calls activateLanguage() for instant translation without page reload
- Deployed to RPi5

## 2026-04-10 (session 57)
- Fix: PDF download auth — replaced window.open() with fetch + Authorization Bearer header
- Fix: PDF download shows "Generating..." loading state while fetching
- Fix: Free user sees 403 error message instead of black Unauthorized screen
- Tested live: unauthenticated → 401, Pro user → 200 + 51KB PDF, Free user → 403 "Pro plan required"
- Verified: StorePickerDialog wired to all 3 web entry points (shop, recipe detail, meal plan)
- Verified: StorePicker wired to all 3 mobile entry points (shop, recipe detail, meal plan)
- Deployed to RPi5 — build succeeded, pm2 restarted, chefsbk.app live

## 2026-04-10 (session 56)
- Verified 8 agent files in .claude/agents/ (4 updated + 2 new: testing.md, deployment.md)
- CLAUDE.md: agent lookup table updated with mandatory testing.md + deployment.md
- CLAUDE.md: SESSION START updated to 8-step sequence including schema verification
- wrapup.md: added MANDATORY PRE-WRAPUP TESTING (DB, cross-platform, entry points, schema, deployment)
- CLAUDE.md: added KEY TABLE SCHEMAS section (recipe_user_photos, user_follows, shopping_list_items, stores)

## 2026-04-10 (session 55)
- Web: StorePickerDialog wired to recipe detail "Add to shopping list → new list" (replaces old text input form)
- Web: StorePickerDialog wired to meal plan "add day to cart → new list" and "add week → new list"
- Web: Shopping list button colour audit — all Create/Add/New List buttons changed from green to pomodoro red
- Web: Recipe detail list hover colour changed from green to red
- Mobile: StorePicker wired to recipe detail "Add to shopping list → new list" (replaces auto-create)
- Mobile: StorePicker wired to meal plan "New shopping list" button (replaces auto-create)
- tsc --noEmit passes both apps
- Deployed to RPi5 (required npm install for stale node_modules), build succeeded, pm2 restarted, chefsbk.app live

## 2026-04-10 (session 54)
- Mobile: `StorePicker` bottom sheet — store dropdown with logos/initials, new store input, auto-fill list name
- Mobile shopping tab: replaced old NewListModal with StorePicker
- Button colour fix: all shopping creation buttons now pomodoro red (cb-primary) — web StorePickerDialog, recipe detail, meal plan
- Deployed to RPi5

## 2026-04-10 (session 53)
- Web: Complete PDF export redesign using @react-pdf/renderer with raw recipe data (not web page rendering)
- PDF: Recipe hero image fetched server-side with apikey header, converted to base64 for @react-pdf/renderer Image
- PDF: Clean layout — red header line, hero image (220px max), title (28px bold), metadata row, ingredients with bullet list, numbered steps with timer indicators, notes section
- PDF: Attribution in hero section + footer on every page (original_submitter + shared_by)
- PDF: Filename format "ChefsBook - [Recipe Title].pdf" with sanitized special characters
- PDF: Footer on every page with "Saved with ChefsBook · chefsbk.app" + page numbers
- PDF: Ingredient grouping by group_label (section headers like "For the dough:")
- PDF: Steps use wrap={false} to prevent page breaks mid-step
- PDF: No web UI elements (no photo strip, buttons, navigation, comments, etc.)
- Verified: downloaded real 2-page PDF (Thai Chicken Satay, 51KB) with correct filename and layout
- Deployed to RPi5 — build succeeded, pm2 restarted, chefsbk.app live

## 2026-04-10 (session 52)
- Migration 024: `stores` table + `store_id` FK on shopping_lists; backfill 5 stores from existing data
- DB queries: getUserStores, createStore (logo.dev guess + known domains), updateStoreLogo
- `createShoppingList()` accepts optional `storeId`
- Web: StorePickerDialog — store dropdown with logos/initials, "New store..." input, list name auto-fill
- Web shopping: "New List" opens StorePickerDialog; deployed to RPi5

## 2026-04-10 (session 51)
- Web: ChefsDialog component — unified modal with backdrop, rounded container, pill buttons (primary/secondary/cancel/positive)
- Web: useConfirmDialog + useAlertDialog hooks — imperative confirm/alert replacements using ChefsDialog
- Mobile: ChefsDialog component — same spec using React Native Modal + StyleSheet
- Mobile: useConfirmDialog + useAlertDialog hooks for mobile
- Web: Replaced all 8 native confirm() calls across 8 files with ChefsDialog (comments, follow, meal plan, dashboard, shop, cookbook, scan, admin promos)
- Web: Replaced key alert() calls in RecipeComments + MealPlanPicker with styled dialogs
- Mobile: Replaced delete recipe confirmation in recipe detail with ChefsDialog
- Deployed to RPi5 — build succeeded, pm2 restarted, chefsbk.app live with styled dialogs

## 2026-04-10 (session 50)
- Web: daypart pill (bottom-left, dark bg) + servings pill (bottom-right, white bg) on meal plan cards, tappable to change
- Mobile: meal plan cards upgraded to image cards with daypart + servings pills
- Portions mismatch warning when adding day to cart with >2x serving difference (mobile Alert + web confirm)
- i18n: `mealCard` namespace
- Deployed to RPi5

## 2026-04-10 (session 49)
- Fix: Comment post button — moderateComment() CORS error now caught separately, post goes through without moderation on web
- Fix: Shopping list RLS — addItemsWithPipeline() accepts optional dbClient param; API route passes service role client to bypass RLS
- Fix: Shopping list insert RLS policy updated to allow list-owner inserts (fallback for direct client calls)
- Both fixes deployed to RPi5, tested live — comments insert to DB, shopping list API returns 401 correctly without auth
- Comment row confirmed in recipe_comments table via psql

## 2026-04-10 (session 48)
- Fixed duplicate Share button on web recipe detail — kept dropdown with correct share icon
- Mobile: MealPlanPicker — week nav, colour-coded day/meal slots, conflict warning, servings stepper, Chef+ gate
- Web: MealPlanPicker modal — same features, calendar button in header actions
- i18n: `mealPicker` namespace
- Deployed to RPi5

## 2026-04-10 (session 47)
- Verified `photo_url` column issue does NOT exist — code already uses `url` everywhere
- Backfill SQL: 13 recipes updated with storage URLs from recipe_user_photos (fixed is_primary filter)
- Image proxy verified for backfilled URLs (200, image/jpeg)
- Deployed to RPi5

## 2026-04-10 (session 46)
- Full verification sweep: 31 pass, 0 fail, 17 not tested (interactive/mobile)
- QA report at `docs/QA-REPORT-2026-04-10.md`
- Confirmed: PM2 online, image proxy, landing page, admin redirect, Discover removed, settings labels

## 2026-04-10 (session 45)
- Migration 023: recipe moderation columns (moderation_status, flag_reason, flagged_at, reviewed_by/at) + user_profiles recipes_frozen columns
- `moderateRecipe()` in @chefsbook/ai — AI content moderation for recipe title/description/ingredients/steps/notes
- `freezeUserRecipes()` + `unfreezeUserRecipes()` + `approveRecipeModeration()` + `rejectRecipeModeration()` in packages/db
- Mobile: moderation runs on every addRecipe + editRecipe in recipeStore (clean/mild/serious handling)
- Web: `createRecipeWithModeration()` wrapper used on scan + speak pages
- Mobile: frozen account banner in _layout.tsx (amber warning with Contact Support + Dismiss)
- Web: frozen account banner in dashboard layout (amber bar with Contact Support)
- Admin: recipe moderation queue with approve/reject on flagged recipes, red SERIOUS / yellow MILD badges
- Admin: approve unfreezes user + sends notification; reject keeps private + notifies user
- i18n: `moderation` namespace added to all 5 locales (en/fr/es/it/de)
- Migration applied to RPi5, tsc --noEmit passes both apps
- Deployed to RPi5 — build succeeded, pm2 restarted, chefsbk.app live

## 2026-04-10 (session 44)
- Fix shopping list create crash: try/catch + default store_name + user-friendly error
- Web settings: username read-only with lock icon, removed from save; display name helper text
- `isUsernameFamilyFriendly()` in @chefsbook/ai with Claude moderation
- Family-friendly username check integrated into signup (mobile + web)
- Fixed missing `moderateRecipe.ts` that blocked web build
- Deployed to RPi5

## 2026-04-10 (session 43)
- Web: Full image proxy sweep — all 12 files with `<img>` tags now route Supabase storage URLs through `/api/image?url=`
- Fix: Search page recipe cards (broken images → proxied)
- Fix: Meal plan day cards + recipe picker modal (broken images → proxied)
- Fix: Chef profile avatar + recipe images (broken → proxied)
- Fix: Technique detail + list images (broken → proxied)
- Fix: Settings page avatar (broken → proxied)
- Fix: Share page hero image (broken → proxied)
- Fix: Cookbook detail + list cover images (broken → proxied)
- Fix: Recipe detail hero fallback to image_url (was unproxied)
- Fix: Recipe detail "Your Photos" thumbnails (broken → proxied)
- Fix: SocialShareModal + WhatsNewFeed recipe images (broken → proxied)
- Deployed to RPi5 — build succeeded, pm2 restarted, chefsbk.app live

## 2026-04-10 (session 42)
- Web recipe detail: moved LikeButton below title with Public badge
- Share dropdown: Copy link + Download PDF (Pro gated) + Social post (Pro gated)
- Removed Discover from sidebar nav; `/dashboard/discover` redirects to `/dashboard/search`
- Deployed to RPi5 — build successful, PM2 restarted, live at chefsbk.app

## 2026-04-10 (session 41)
- Fix: All landing page CTA buttons routed from 404 `/auth/signup` to correct `/auth` route
- Fix: Nav + footer "Sign in" links routed from `/dashboard` to `/auth`
- Fix: "See how it works" hero button anchor changed from `#features` to `#how-it-works` with matching section id
- Fix: Recipe sign-in wall links (`/auth/signin`, `/auth/signup`) all corrected to `/auth`
- Fix: Guest banner "Sign up" link and bottom CTA corrected to `/auth`
- Deployed to RPi5 — build succeeded, pm2 restarted, chefsbk.app verified with all routes working (no 404s)

## 2026-04-10 (session 40)
- Web: HD chef's hat logo (1024x1024 from mobile assets) at 128px in hero + footer
- Web: Feature card emoji icons removed, replaced with red left border accent (3px #ce2b37) + 22px headers
- Web: "How it works" redesigned as 4 white shadow cards with 48px red step number circles + dashed connector line (desktop)
- Web: Monthly/Annual toggle fixed — labels use leading-none + flex align-items-center, "Save 20%" as green pill badge
- Web: Section background for "How it works" changed to white for visual break from cream
- Deployed to RPi5 — build succeeded, pm2 restarted, chefsbk.app confirmed live with all changes

## 2026-04-10 (session 39)
- Built release APK (111MB) — includes all sessions 26-38: usernames, plan tiers, follows, likes/comments, attribution, share links, PDF export, admin, web images
- No debug console.log artifacts; tsc --noEmit clean

## 2026-04-09 (session 38)
- `/api/image` proxy route for Supabase storage URLs (apikey injection, 86400s cache)
- `getRecipeImageUrl()` + `proxyIfNeeded()` utilities in `apps/web/lib/recipeImage.ts`
- Chef's hat asset at `apps/web/public/images/chefs-hat.png`
- Dashboard recipe cards (grid/list/table): batch primaryPhotos, priority chain (user photo → image_url → chef's hat)
- Recipe detail hero: userPhotos proxied via `/api/image`, falls back to image_url
- Discover page: batch primaryPhotos for public feed with same priority

## 2026-04-09 (session 37)
- Web: Moved kg/lb unit toggle from sidebar header to bottom section above Settings (fixes clipping on narrow screens)
- Web: Full landing page refresh — updated hero with chef's hat logo + AI headline, 4-group feature section reflecting all built features
- Web: Added 4-tier pricing section (Free/Chef/Family/Pro) with monthly/annual toggle and 20% savings badge
- Web: Updated "How it works" section to match actual user journey (sign up → import → organise → discover)
- Web: Updated footer with feature/pricing/sign-in/download links and chefsbk.app branding
- Web: Chef plan highlighted as "Most Popular" in pricing cards
- Web: Pricing cards responsive — 1 column mobile, 2 columns tablet, 4 columns desktop
- Fix: pre-existing TypeScript error in PDF route (Buffer type cast)
- tsc --noEmit passes web app

## 2026-04-09 (session 36)
- Installed `@react-pdf/renderer` in apps/web
- `/recipe/[id]/pdf` route: plan-gated PDF generation with formatted layout (header, ingredients, steps, notes, attribution)
- Mobile: PDF download via expo-file-system + expo-sharing, wired into share action sheet
- Web: PDF download link on recipe detail page
- Non-Pro users see upgrade prompt on mobile

## 2026-04-09 (session 35)
- Migration 022: guest_sessions table for share link guest email capture
- Mobile: Share action sheet with "Share via link" + "Share as PDF" (Pro gated) options
- Mobile: Privacy warning for private recipes before sharing — updates visibility to shared_link
- Mobile: Share URLs now use chefsbk.app/recipe/[id]?ref=[username] format with clipboard copy
- Mobile: Sticky "Save to my ChefsBook" bottom bar on non-owned recipe detail with plan gating + attribution
- Mobile: Deep link handler routes chefsbk.app/recipe/[id] URLs directly to recipe detail
- Mobile: Intent filter in app.json with autoVerify for chefsbk.app/recipe paths (Android App Links)
- Web: Sign-in wall overlay on /recipe/[id] for unauthenticated users (Sign in / Create account / Download app / Guest)
- Web: Guest email capture flow — stores in guest_sessions table, shows recipe with persistent banner
- Web: CTA card at bottom of recipe for guest/unauthenticated users ("Love this recipe? Save it")
- Web: assetlinks.json created at /.well-known/ for Android App Links verification
- i18n: `share` namespace with 16 keys added to all 5 locales (en/fr/es/it/de)
- Migration applied to RPi5, tsc --noEmit passes both apps

## 2026-04-09 (session 34)
- Migration 021: recipe_likes + trigger, recipe_comments + trigger, comment_flags, blocked_commenters tables
- `moderateComment()` in @chefsbook/ai — Claude moderation (clean/mild/serious verdicts)
- DB queries: toggleLike, isLiked, getLikers, getComments, postComment, deleteComment, flagComment, blockCommenter, toggleComments
- Mobile: LikeButton (optimistic toggle, owner likers sheet) + RecipeComments (post w/ moderation, delete, block, flag, plan gating)
- Web: LikeButton + RecipeComments with same features, wired into recipe detail
- Added like_count, comment_count, comments_enabled to Recipe type; comments_suspended to UserProfile
- i18n: likes + comments namespaces

## 2026-04-09 (session 33)
- Migration 021: Updated clone_recipe RPC to set original_submitter_id/username (chains from source recipe)
- Added original_submitter_id/username and shared_by_id/username fields to Recipe type in packages/db
- cloneRecipe() now accepts optional sharedByUsername param, sets shared_by after clone
- Added removeSharedBy() function in packages/db for user-removable shared_by tags
- Mobile recipe detail: attribution pills — locked red original_submitter pill + removable grey shared_by pill
- Mobile recipe cards: "by @username" line shown for non-own recipes with original_submitter
- Web recipe detail: attribution pills (locked original, shared_by) replace old attributed_to display
- Web dashboard recipe grid + list: "by @username" for attributed recipes
- Share URLs now include ?ref=username for attribution tracking (mobile + web)
- Web share page: proper "Add to my Chefsbook" save button with cloneRecipe + ?ref= attribution
- Mobile share page: save button with cloneRecipe + ref param parsing
- i18n: `attribution` namespace added to all 5 locales (en/fr/es/it/de)
- Migration applied to RPi5, tsc --noEmit passes both apps

## 2026-04-09 (session 32)
- Migration 019: admin_users, is_suspended, plan_limits (DB-driven), help_requests tables
- Super admin seeded for pilzner; plan_limits seeded for all 4 tiers
- Admin dashboard at /admin with layout, sidebar nav, route protection (silent redirect for non-admins)
- Overview: total users, new today, recipes, flagged comments, users by plan
- User management: search/filter table, plan change, suspend/restore, add proctor role
- Flagged comments, recipe moderation, promo code CRUD, plan limits display, help requests
- Suspended user handling: mobile full-screen notice, web /suspended page
- Added is_suspended to UserProfile type

## 2026-04-09 (session 31)
- Migration 020: user_follows table + RLS + count triggers, notifications table + new_follower trigger
- DB queries: followUser, unfollowUser, isFollowing, getFollowers, getFollowing, getFollowedRecipes in packages/db
- Added `canFollow` to PLAN_LIMITS (free=false, chef/family/pro=true)
- Mobile: Follow/Following button on chef profile with optimistic update, unfollow confirmation, plan gating
- Mobile: Followers/Following tabs on chef profile (avatar + username list, tap to navigate)
- Mobile: What's New card in Search tab + full-screen feed modal (recipes from followed users with @username + time ago)
- Web: FollowButton component on /u/[username] and /chef/[username] with plan gating
- Web: FollowTabs component showing followers/following lists on both profile pages
- Web: WhatsNewFeed component on Discover page (expandable feed with recipe cards)
- Web: chef/[username] page updated from old `follows` table to new `user_follows` + profile counts
- Updated Follow type in packages/db (following_id replaces followed_id, removed status field)
- i18n: `follow` namespace with 28 keys added to all 5 locales (en/fr/es/it/de)
- Migration applied to RPi5, tsc --noEmit passes both apps

## 2026-04-09 (session 30)
- Migration 018: promo_codes table, family_members table, plan billing fields on user_profiles
- Rewrote PLAN_LIMITS with 4 tiers (free/chef/family/pro) + new feature flags (canImport, canAI, canPDF, etc.)
- PlanTier type updated to include `chef`; promo code validation + application functions
- Promo code field on mobile + web signup; `pro100` seeded and Bob set to Pro
- Mobile plans page: 4 tier cards, monthly/annual toggle, dev mode instant upgrade/downgrade
- Web plans page at `/dashboard/plans` with same layout
- Settings modal: "Your Plan" card with See Plans navigation
- i18n: full `plans` namespace with tier names, prices, features, gate messages

## 2026-04-09 (session 29)
- Migration 017: username, bio, is_searchable, follower/following/recipe counts + recipe attribution columns
- DB queries: getProfileById, getProfileByUsername, checkUsernameAvailable, setUsername, updateProfile, searchUsers
- Mobile signup: username field with debounced availability check (green/red/spinner)
- Mobile settings: privacy toggle with warning modal for private mode
- Mobile profile: Edit Profile modal with read-only username, editable name/bio (200 char counter)
- Mobile search: People section above recipe results (avatar, @username, follower count)
- Web profile page at `/u/[username]` with stats and public recipes grid
- Web signup: username field with same availability check
- Set `pilzner` username for Bob's account
- i18n: profile, signup, settings privacy, search people strings

## 2026-04-09 (session 28)
- Cloudflare Tunnel setup: chefsbk.app live via tunnel `chefsbook` on RPi5
- Installed cloudflared 2026.3.0, Node.js 22, PM2 on RPi5
- Cloned repo to /mnt/chefsbook/repo, built Next.js production (35 pages)
- DNS: chefsbk.app, www.chefsbk.app, api.chefsbk.app all routed via CNAME
- PM2 running chefsbook-web; cloudflared running as systemd service
- Fixed PipelineStage type (added `json-ld+claude`, `claude`) for web build
- Added `not-found.tsx` to fix SSG 404 build error
- Created apps/mobile/.env.production with public URLs
- Added Public URLs section to CLAUDE.md with restart/log commands

## 2026-04-09 (session 27)
- Fix IG URL routing: `handleImport()` checks `isInstagramUrl()` first, redirects to IG handler — no more misroute
- Manual dish name input: new `manual_name` step in DishIdentificationFlow with TextInput + safe area insets
- "Type it myself" option on unclear screen, confirm_dish screen, and "None of these" on dish_options
- Ran all 3 agent pre-flight and post-flight checklists (ui-guardian, import-pipeline, image-system)

## 2026-04-09 (session 26)
- Installed 4 specialist agents in `.claude/agents/`: ui-guardian, import-pipeline, image-system, data-flow
- Added AGENT SYSTEM section to CLAUDE.md with agent lookup table and invocation instructions
- Added SESSION START INSTRUCTIONS to CLAUDE.md (6-step mandatory launch sequence)
- Updated wrapup.md with POST-FLIGHT AGENT CHECKS (UI, import, image, data, general)

## 2026-04-08 (session 25)
- Removed debug `console.log`/`console.warn` from EditImageGallery, recipeStore, recipe detail, speak.tsx
- Built release APK (111MB, 56s) — includes all sessions 20-24 features and fixes

## 2026-04-08 (session 24)
- Fix Instagram paste routing: clipboard handler detects IG URLs and routes to Instagram import, not standard import
- Instagram URL validation: non-IG URLs in IG input show friendly error instead of silent failure
- Fix scan page button layout: 2-row layout (Add page + From gallery top, Done scanning full-width below) with safe area insets
- New "Additional context" step in dish identification flow: 200-char free text input between dish confirm and action sheet
- Context text appended to search query and Claude generation prompt ("User notes")

## 2026-04-08 (session 23)
- Removed `console.warn` debug artifact from `searchPexels()` in `@chefsbook/ai`
- Built release APK via Gradle `assembleRelease` (111MB) — includes sessions 20-22 features
- APK at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

## 2026-04-08 (session 22)
- Instagram import: `fetchInstagramPost()` extracts og:image + caption from public posts
- `extractRecipeFromInstagram()` sends image + caption to Claude; returns recipe or dish_name if no recipe
- Share handler routes Instagram URLs (`/p/`, `/reel/`) to dedicated Instagram import flow
- No-recipe Instagram posts route to DishIdentificationFlow with dish_name pre-filled
- Private/failed fetches show friendly error with manual entry fallback
- "Instagram" grid cell added to scan tab (3+2 layout); manual paste input with clipboard button
- PostImportImageSheet: "From Instagram post" option shown first when IG image available
- Grid cells resized for 3-column rows (48px icons, 120px height)

## 2026-04-08 (session 21)
- Dish identification scan flow: `analyseScannedImage()` classifies image as recipe document / dish photo / unclear
- `reanalyseDish()` re-analyses with user answers + cuisine hint; `generateDishRecipe()` creates full recipe from dish name + image
- `DishIdentificationFlow` component: cuisine quick-select, clarifying question pills (max 3), dish options radio, confirm dish, action sheet
- Scan tab routes single-page scans through classification first; recipe documents use existing unchanged flow
- "Find matching recipes" navigates to search tab in discover mode with dish name pre-filled (`q` param)
- "Generate a recipe" creates AI recipe and auto-uploads scanned dish photo as primary image
- Unclear image handler: user can force recipe scan or enter dish identification flow
- `dishId` i18n namespace with all new strings

## 2026-04-08 (session 20)
- Fix stale recipe card images: `useFocusEffect` on recipe list tab refreshes recipes + primary photos on every focus
- Fix HeroGallery not refreshing after image edits: added `refreshKey` prop, bumped on edit save/cancel
- Fix scan prompt missing description: updated Claude Vision prompt to always extract or generate a 1-2 sentence description

## 2026-04-08 (session 19)
- PostImportImageSheet: new bottom sheet for choosing cover photo after any import (URL, scan, file)
- Pexels pre-fetched in parallel with import (domain guess first, refetch with actual title when available)
- URL import: og:image extracted from HTML, offered as "From website" option in sheet
- Camera scan: `scanRecipeMultiPage` prompt detects `has_food_photo` + `food_photo_region`
- ScannedRecipe type extended with `has_food_photo`, `food_photo_region`, `image_url`
- Scan flow: scanned page image offered as "From scan" when food photo detected by Claude Vision
- Old "Add cover photo?" inline prompt removed, replaced by PostImportImageSheet
- i18n: `postImport` namespace added for the new image selection sheet

## 2026-04-08 (session 18)
- Hero image gallery: uploaded photos show as full-width hero on recipe detail, chef's hat only when 0 images
- Swipeable hero pager with dot indicators for 2–4 images (FlatList horizontal, pagingEnabled)
- Removed separate thumbnail strip from read-only recipe detail (replaced by hero gallery)
- Recipe cards show primary user photo via batch `getPrimaryPhotos()` lookup, falls back to `image_url` then chef's hat
- `listRecipePhotos` reordered by `is_primary DESC, created_at ASC` (primary always first)
- Edit mode: star indicator on primary thumbnail, auto-primary when only 1 image, "Set as cover photo" toast on long-press
- New `HeroGallery` component, new `getPrimaryPhotos` batch query in `@chefsbook/db`

## 2026-04-08 (session 17)
- Fix: image not displaying after upload — Kong gateway returns 401 on public bucket URLs without `apikey` header
- Fix: added `apikey` header to `<Image>` sources in EditImageGallery (read-only + edit mode)
- Fix: added conditional `apikey` header in RecipeImage component for Supabase storage URLs
- Debug: added onError/onLoad logging to image components for future troubleshooting
- Verified: file in storage.objects, URL uses Tailscale IP, image renders and persists after navigation

## 2026-04-07 (session 15)
- Pexels picker: fixed AbortSignal.timeout crash (not available in Hermes — replaced with AbortController)
- Pexels picker: fixed env var not reaching shared package (pass key explicitly from app code)
- Pexels picker: vertical full-width layout (was tiny side-by-side thumbnails)
- Pexels search: removed " food" suffix causing irrelevant results (pizza for "pear pie")
- Pexels picker: fixed tap not firing (nested TouchableOpacity swallowing events → plain View)
- Pexels upload: replaced FileReader blob approach with expo-file-system download + processImage
- Pexels upload: rewrote to use FileSystem.uploadAsync with manual JWT headers (bypass Supabase JS client)
- Storage investigation: root cause is PostgreSQL 42501 on set_config in storage middleware (supabase_storage_admin role)
- Storage investigation: granted INHERIT + anon + authenticated to supabase_storage_admin, full service restart — still fails
- Storage investigation: disabled RLS on both storage.objects and recipe_user_photos — still fails
- Storage investigation: ALL 9 approaches tried failed — error is in Supabase self-hosted storage middleware, not in RLS policies
- BLOCKER: Mobile storage uploads do not work — zero files in storage.objects ever. Web uploads work fine (service role key).
- Next step: create API route proxy in apps/web that accepts images from mobile and uploads server-side

## 2026-04-07 (session 14)
- Fix: removed "Staging" pill from ChefsBookHeader — was pushing kg/lb toggle off screen
- Fix: language translation now works — `activateLanguage()` wired into `preferencesStore.setLanguage()`, `loadFromLocal()`, and `loadFromSupabase()`
- Fix: Pexels API key added to mobile `.env.local` and `.env.staging` — key was only in monorepo root, not in Expo project dir
- Safe area: new shopping list modal (`NewListModal`) — added `paddingBottom: insets.bottom + 16`
- Safe area: MealPlanWizard — footer buttons + scroll container now use `insets.bottom`
- Safe area: PexelsPickerSheet — replaced hardcoded `paddingBottom: 40` with `insets.bottom + 16`
- Safe area: LanguagePickerModal — bottom spacer now uses `insets.bottom + 16`
- Safe area: FilterBottomSheet (search.tsx) — apply button area uses `insets.bottom + 16`
- Safe area: recipe picker modal (plan.tsx) — outer container uses `insets.bottom + 16`
- Safe area: version picker modal (index.tsx) — outer container uses `insets.bottom + 16`
- CLAUDE.md: added "Non-Negotiable UI Rules" section with mandatory Android safe area rule
- Diagnostic: added `console.warn` to `searchPexels` for missing key debugging

## 2026-04-07 (session 13)
- Fix: "Rendered more hooks than during previous render" crash — moved `useMemo` hooks above early return in recipe detail
- Fix: removed copy/duplicate icon from recipe detail action bar (was confusing with version system)
- "Save a Copy" button added to recipe edit mode — creates fully independent recipe clone with " (Copy)" suffix, copies tags + dietary flags
- Jetifier fix: re-added `android.enableJetifier=true` to gradle.properties (wiped by `prebuild --clean`)
- i18n: `recipe.saveACopy` + `recipe.copySaved` keys added to all 5 locales

## 2026-04-07 (session 12)
- Recipe content translation system: `translateRecipe()` in `@chefsbook/ai` via Claude Sonnet
- Migration 016: `recipe_translations` table with RLS policies, applied to RPi5
- DB functions: `getRecipeTranslation()`, `saveRecipeTranslation()`, `deleteRecipeTranslations()` in `@chefsbook/db`
- Mobile recipe detail: cached translation lookup → background translate → "Translating…" pill → re-render with translated content
- Web recipe detail: same translation flow — fetches user `preferred_language` from `user_profiles`, caches + displays
- Cache invalidation: `replaceIngredients()` and `replaceSteps()` auto-delete all translations for edited recipe
- English always shows original content — no translation API call
- i18n: `recipe.translating` key added to all 5 locales
- Web speak/image route updated to accept `EXPO_PUBLIC_PEXELS_API_KEY` env var name

## 2026-04-07 (session 11)
- Pexels 3-image picker: shared `searchPexels()` in `@chefsbook/ai`, `PexelsPickerSheet` modal component
- Pexels wired into EditImageGallery action sheet ("Find a photo" option), Speak a Recipe Step 3, and scan tab post-import cover prompt
- Chef's hat default placeholder: `RecipeImage` shared component replaces all recipe image fallbacks (cards, detail hero, edit empty state watermark)
- Chef's hat watermark at 18% opacity in EditImageGallery dashed placeholder zone
- i18n: `gallery.findPhoto` + `pexels.*` keys added to all 5 locale files (en/fr/es/de/it)
- `PEXELS_API_KEY` / `EXPO_PUBLIC_PEXELS_API_KEY` env var documented in CLAUDE.md
- Web parity: TODO comment added for chef's hat placeholder + Pexels picker on web dashboard
- Release APK network fix: `network_security_config.xml` + release AndroidManifest override to allow cleartext HTTP to Tailscale Supabase IP

## 2026-04-07 (session 10)
- Release APK built: expo prebuild --clean + expo run:android --variant release, 111 MB APK at apps/mobile/android/app/build/outputs/apk/release/app-release.apk
- Smoke test passed: landing screen renders with chef's hat icon, Sign In/Create Account/Continue as guest buttons, no dots below tagline
- Jetifier fix: re-added android.enableJetifier=true to gradle.properties (wiped by prebuild --clean)
- Known: emulator screencap returns black when screen is off — must wake with KEYCODE_WAKEUP first

## 2026-04-07 (session 9)
- Language selector limited to 5 supported languages (en/fr/es/it/de), removed search bar and priority logic
- Removed unused LANGUAGES/PRIORITY_LANGUAGES imports from LanguagePickerModal

## 2026-04-07 (session 8)
- Full i18n system: react-i18next installed, i18n.ts init with lazy-loaded locales, activateLanguage() synced to preferences store
- Locale files: en.json (350+ keys), fr.json, es.json, it.json, de.json — all fully translated
- i18n string replacement: every user-visible hardcoded English string replaced with t() calls across all screens and components
- Language selector wired to i18n: selecting a language immediately translates the entire app UI without restart
- Shopping list button: replaced hardcoded marginBottom with useSafeAreaInsets().bottom + 16
- plan.tsx modal safe areas: recipe picker confirmation and shopping list picker both use insets.bottom padding
- StoreAvatar logo.dev: updated all logo URLs from clearbit.com to img.logo.dev with API token

## 2026-04-07 (session 7)
- Search filter bottom sheet: category cards now open a modal with scrollable options, search input for long lists, Clear/Apply buttons
- FilterBottomSheet component: supports text input (ingredient/tags) and chip selection (cuisine/course/dietary) modes
- AI Meal Plan Wizard on mobile: 4-step full-screen modal (Days & Meals → Preferences → Sources → Review)
- MealPlanWizard component: day/slot chips, dietary/cuisine/effort preferences, source selection, swap/remove per slot, save to plan
- Portions stepper: +/- servings input in meal add bottom sheet, defaults to recipe's base servings, saved to meal_plans.servings
- No migration needed: servings column already exists on meal_plans (numeric(6,2) from migration 001)

## 2026-04-07 (session 6)
- Migration 014: recipe versioning columns (parent_recipe_id, version_number, version_label, is_parent) applied to RPi5
- Recipe type + queries: version fields on Recipe interface, getRecipeVersions(), getVersionCount(), createRecipeVersion()
- Version pill on recipe cards: shows "N versions" badge on multi-version recipes
- Version picker bottom sheet: opens on tap of multi-version card, sub-cards per version with label/description
- Child version filtering: recipe list hides child versions, only shows parent/standalone recipes
- Add version button: copy-outline icon on recipe detail launches new recipe form with parentId
- Version indicator on detail: "Version N · Label — tap to switch" with version switcher alert
- New recipe form: accepts parentId param, creates version via createRecipeVersion instead of standalone
- Auto-tag multi-select: suggestion pills toggle on/off with checkmark, "Add N tags" confirm button, Dismiss option
- Web parity TODOs: version sub-cards (dashboard), version picker + auto-tag multi-select (recipe detail)

## 2026-04-07 (session 5)
- Plan gate on photo uploads: maxPhotosPerRecipe (Free=3, Pro/Family=10) in PLAN_LIMITS, enforced in EditImageGallery before upload
- "Add cover photo?" prompt: shown after URL import when no image returned, camera/library/skip options
- Web parity TODOs: added multi-page scan + cover photo prompt comments in apps/web/app/api/import/url/route.ts
- Fix: ScannedRecipe type error — check recipe.image_url (saved Recipe) not scanned.image_url (ScannedRecipe has no image_url)

## 2026-04-07 (session 4)
- Recipe edit image gallery: EditImageGallery component with add/delete/set-primary, dashed placeholder for no images, upload to Supabase Storage
- Recipe detail read-only photo gallery: horizontal scroll of user photos below hero image
- Multi-page recipe scanning: capture up to 5 pages with thumbnail strip, "Add page" / "Done scanning" UI, cancel flow
- Multi-page Claude Vision: scanRecipeMultiPage() sends all page images in one API call, unified recipe extraction
- callClaude multi-image support: images[] parameter for sending multiple images in content array
- Speak a Recipe cover photo: camera/library picker on Step 3 before save, uploads to recipe-user-photos on save
- Scan auto-photo: first scanned page auto-uploaded as recipe photo after save
- Web parity TODOs: flagged multi-page scan + speak image picker in scan.tsx and speak.tsx

## 2026-04-07 (session 3)
- StoreAvatar component: logo from Clearbit for 12 known stores, initials fallback with deterministic hash color
- Store-first list creation: 2-step modal (select/create store → optional list name), store_name passed through to DB
- Store grouping on shopping list overview: lists grouped by store_name with StoreAvatar headers
- Concatenated "All [Store]" view: read-only merged item list across all lists for a store, quantity merging, department grouping
- Shopping store addList updated: Zustand store accepts storeName option, wired through to createShoppingList
- Web parity TODOs flagged in shop.tsx and StoreAvatar.tsx

## 2026-04-07 (session 2)
- QA Notepad: moved "Clear All" button from header to bottom of note list, added confirmation dialog with spec text
- QA Notepad: added bottom safe area inset (insets.bottom) to "Add Item" footer button
- Shopping list: added marginBottom to "New Shopping List" button, consistent button label across levels
- Safe area audit: flagged 2 modal bottom issues in plan.tsx (recipe picker + shopping list picker) — not fixed per scope

## 2026-04-07
- Bug fix: recipe save payload — strip undefined values from updateRecipe/updateRecipeMetadata, only send dietary_flags when changed
- Bug fix: session persistence — wired expo-secure-store as Supabase auth storage adapter via configureStorage() in @chefsbook/db
- Bug fix: empty meal plan week — always render 7 day cards (Mon-Sun) regardless of whether meals exist, removed EmptyState gate
- Bug fix: favorites filter — tap Favorites card directly toggles filter (removed intermediate subcategory expansion), active state highlight
- Bug fix: blank app icon — ran expo prebuild --clean to regenerate Android mipmap icons from correct adaptive-icon.png + backgroundColor
- Bug fix: landing page dots — removed decorative three-dot element below tagline
- Bug fix: dry ingredient conversion — volume units (cup/Tbsp/tsp) for dry ingredients now convert to g/kg in metric mode, not ml
- Bug fix: language selector — header now shows flag emoji + code (e.g. "🇫🇷 FR") for clear visual feedback on language change

## 2026-04-06 (session 3)
- Floating pill tab bar: removed elevated Scan button, all 5 tabs flat and identical inside pill
- Meal plan add flow: bottom sheet recipe picker with meal type selector (Breakfast/Lunch/Dinner/Snack), save to plan, toast confirmation
- Day-to-cart flow: cart icon on plan day cards, list picker bottom sheet, merge ingredients with AI purchase unit suggestions
- Remove recipe from shopping list: trash icon on recipe group headers in recipe view mode with confirmation
- Recipe detail: replaced Save/Share/Pin pill buttons with icon row (heart, share, pushpin emoji, pencil)
- Recipe detail: added ChefsBookHeader with language/unit controls
- Recipe image: added hero image with placeholder (cream bg + restaurant icon) when no image
- Favorite heart: fixed toggleFav to update currentRecipe state, fixed pin reactivity via selector
- Language selector: 28 languages with flag emojis, bottom sheet picker with search, priority languages
- Metric/imperial toggle: [kg|lb] pill in header, unit conversion across recipe detail + shopping list
- Unit conversion: full ladder system (ml→L, g→kg, oz→lb, tsp→Tbsp→cup→qt), dry ingredient classification
- Unit conversion fix: everything converts consistently — no more mixing metric/imperial in same recipe
- Unit abbreviation: teaspoons→tsp, tablespoons→Tbsp etc. on all display paths, numberOfLines={1}
- Preferences store: Zustand + SecureStore persistence, Supabase sync on login
- Web sidebar: language dropdown + unit toggle, reads/writes user_profiles
- QA Notepad: hidden testing tool triggered by logo tap, persists to expo-file-system JSON, export to clipboard
- Recipe saves: recipe_saves table with auto save_count trigger, save count badge on recipe cards + detail
- Red heart on Favorites category card in search
- DB migrations: user_preferences (language/units), recipe_saves + save_count + trigger + RLS
- American spelling: Favourites → Favorites throughout mobile app

## 2026-04-06 (session 2)
- Import pipeline waterfall: JSON-LD first → Claude gap-fill → Claude-only fallback; `import_status` + `missing_sections` + `aichef_assisted` fields on recipes
- aiChef completion system: `generateAiChefSuggestion()` in `@chefsbook/ai` for suggesting missing recipe sections with user review
- Shopping list store navigation: two-level hierarchy (stores → items), smart deduplication with quantity merging
- Meal plan editing: inline edit, remove meal, smart cart sync UI (synced_to_list_id/synced_at/synced_ingredients_hash on meal_plans)
- Fixed TypeScript crash: made new DB fields optional (`?:`) on MealPlan and Recipe interfaces — required fields without values caused "Maximum update depth exceeded"
- Emulator debugging: identified Metro hostname issue (Tailscale IP vs localhost), fixed with `REACT_NATIVE_PACKAGER_HOSTNAME=localhost`
- Documented reliable emulator launch: must use CLI with `-no-snapshot -gpu host`, not Android Studio Device Manager

## 2026-04-06 (session 1)
- Fixed Android build: added android.enableJetifier=true to resolve androidx/support-compat duplicate class conflict
- Redesigned mobile Scan/Import tab: hero Speak button with pulse animation, 2x2 icon grid, collapsible URL input, clipboard paste helper, Chrome share banner
- Registered ChefsBook as Android share target (intent filters for VIEW http/https + SEND text/plain in app.json)
- Added expo-linking handler in _layout.tsx for incoming shared URLs with auto-import
- Installed expo-clipboard for paste-from-clipboard workflow
- Created .claude/agents/navigator.md — full screen map (17 mobile + 18 web screens, ADB coordinates, components, stores)
- Created .claude/agents/wrapup.md — end-of-session navigator update check
- Added Navigator Agent section to root CLAUDE.md and apps/mobile/agents/CLAUDE.md

## 2026-04-05 (session 5)
- Fixed recipe detail notes rendering: paragraph splitting on newlines and labeled sections (e.g. "Rub:", "Sauce:"), proper line spacing and margins
- Shopping list item layout overhaul: purchase unit as prominent left element in accent red (`colors.accent`), usage amount in green (`colors.accentGreen`) below item name, removed green "Buy:" label
- Shopping list font size control: 3 sizes (Small/Medium/Large) with `A`/`A+`/`A++` cycle toggle in header, persisted via `expo-secure-store`
- ADB verified: Red purchase units and green usage amounts display correctly
- ADB verified: Font size toggle visible in header, cycling through Small → Medium → Large works with visible text scaling

## 2026-04-05 (session 4)
- Mobile tag management on recipe detail: TagManager component with add/remove tag pills (accentSoft bg, pomodoro red text), inline text input, AI auto-tag via `callClaude` from `@chefsbook/ai`
- Auto-tag sends recipe title, cuisine, ingredients, steps to Claude and returns 5-8 suggested tags as green dashed pills; tap to add
- Tag sanitization: lowercase, no special characters, no duplicates
- ADB verified: Tags section renders on recipe detail with Auto-tag + Add Tag buttons
- ADB verified: Manual tag add ("bbq" pill with × remove button), tag removal (reverts to empty state)
- ADB verified: Auto-tag AI returns 7 suggestions (pork, ribs, oven-baked, barbecue, tender, american, comfort-food) as green dashed pills
- ADB verified: Tags persist to Supabase and sync to web (confirmed via REST API query)

## 2026-04-05 (session 3)
- Fixed React hooks violation in shop.tsx — useMemo calls were after early return, causing "Rendered fewer hooks than expected" crash when navigating back from list detail to list overview
- ADB verified: Shop tab loads correctly, "Week of 2026-03-30" list shows 41 items with department grouping (Produce, Meat & Seafood, Dairy & Eggs, Baking, Pasta & Grains, Canned & Jarred, Condiments & Sauces, Spices & Seasonings) and purchase units
- ADB verified: Navigate back from list detail → list overview — no crash (hooks fix confirmed)
- Web app shop page verified loading (HTTP 200) — same data via shared Supabase backend
- Committed 98-file batch covering all features from sessions 1-3

## 2026-04-05 (session 2)
- Mobile shopping list overhaul: shared `addItemsWithPipeline()` pipeline in `@chefsbook/db` (single source of truth for web + mobile)
- Mobile shopping UI: 3 view modes (Dept/Recipe/A-Z), 13 department groupings, inline quantity editing, manual item add, check/delete/clear completed
- Mobile recipe editing: inline edit mode with per-ingredient row editor (qty/unit/name, add/remove), per-step textarea, save/cancel
- Recipe-to-shopping integration: "Add to Shopping List" calls AI `suggestPurchaseUnits` + shared pipeline, shows "X new, Y merged" result
- Fixed Voice module crash in speak.tsx (lazy `require()` with try/catch instead of static import)
- Refactored web `add-items` API route to use shared `addItemsWithPipeline` from `@chefsbook/db`
- Supabase Realtime subscriptions for shopping lists and items in mobile store
- TypeScript compiles clean for both mobile and web

## 2026-04-05
- Android dev client built and running on emulator-5554 (npx expo run:android)
- Fixed JAVA_HOME, ANDROID_HOME, DuplicateRelativeFileException (AndroidX vs support lib), React 19.1.4 frozen objects crash, duplicate react-native in Metro bundle
- Pinned React to 19.1.0 across monorepo (root overrides + web package.json)
- Added Metro blockList to prevent root node_modules react/react-native from bundling
- Landing screen with ChefsBook branding (cream bg, serif logo, sign in/create account)
- Sign in screen (email/password, Supabase auth, error handling, Google OAuth stub)
- Sign up screen (name/email/password, validation, Supabase auth, Google OAuth stub)
- Auth protection: useProtectedRoute() hook in root layout + guard in tab layout
- Removed anonymous auth — app shows landing when unauthenticated
- adb reverse port forwarding for emulator ↔ host Metro/Supabase connectivity

## 2026-03-31
- Fix: meal planner shopping list aggregation — recipes appearing multiple times now multiply ingredient quantities by occurrence count (addWeekToShoppingList + addDayToShoppingList)
- Confirmed recipe detail servings scaling to shopping list was already correct (no fix needed)
- CLAUDE.md cleanup: removed stale session history, resolved known issues, deduplicated decisions log, expanded API routes table (8 → 17)
- Added Substack integration to AGENDA.md backlog (Tier 4)

## 2026-03-30
- Shopping list overhaul: DB schema (store_name, color, pin, 13 departments, sharing, realtime), 3 view modes (dept/recipe/alpha), pin/unpin, font size, manual add, Supabase Realtime sync
- Shopping list AI pipeline: purchase_unit + store_category suggestion via Claude, duplicate aggregation, centralized `/api/shopping/add-items` endpoint
- Shopping list column layout: 6-column CSS grid (checkbox, purchase_unit, qty, name, recipe source, delete), responsive mobile layout
- Shopping list print: print button + @media print CSS with two-column layout for long lists
- Supermarket department categories: 13 real aisle sections (Produce, Meat & Seafood, Dairy & Eggs, Baking, etc.)
- Ingredient name cleanup: `cleanIngredientName()` strips prep adjectives, preserves item-identity words
- Unit abbreviation system: `abbreviateUnit()` (short: T, t, c) and `abbreviateUnitMedium()` (readable: Tbsp, tsp, cup)
- Add to shopping list from recipe cards: cart icon on all 3 dashboard views (grid/list/table) with card picker popover
- Meal plan "Add week to list" + per-day cart button with list selector
- Meal planner overhaul: smart recipe picker panel (slide-in, filters, favourites/all tabs), notes on day cards (amber sticky-note style), two-row calendar layout (Mon-Fri / Sat-Sun), recipe images on day cards
- Meal plan day off-by-one fix: local date formatting instead of UTC toISOString()
- AI Meal Planner Wizard: 4-step modal (Days & Meals → Preferences → Sources → Review), generates full week plan via Claude with dietary/cuisine/effort preferences, swap/remove individual slots
- Sidebar overhaul: extracted shared Sidebar component, collapsible with hamburger toggle, recipe/technique counts, reordered nav (Search → Recipes → Techniques → Cookbooks → Discover → Shopping → Meal Plan → Import & Scan → Speak a Recipe), Settings at bottom
- Sidebar on recipe/technique pages: layout wrappers show sidebar for authenticated users
- Sidebar fixed height: `h-screen sticky top-0 overflow-y-auto` — no more stretching with content
- Settings page: /dashboard/settings with account (avatar, name, username), profile (bio), plan switcher (Free/Pro/Family, no Stripe), appearance
- Plan switching: immediate DB update, no Stripe, beta mode
- Recipe privacy toggle: visibility column (private/shared_link/public), red lock icon + PRIVATE badge, share link blocks private recipes
- Recipe editing (inline): title, description, ingredients (per-field row editor), steps (per-step textarea), notes, cuisine, course, tags
- Dynamic filter pills: derived from actual recipe data (courses, top cuisines, favourites, quick)
- Recipe collection view modes: Grid/List/Table with localStorage persistence, sort dropdown
- Favourite toggle: heart button on dashboard cards + recipe detail nav bar
- Cooking notes UI: full log section on recipe detail (add/list/delete)
- Import summary + retry: failed URLs collapsible list with "Retry failed" button
- Discover page: /dashboard/discover with public recipe feed, cuisine filter
- Search page: /dashboard/search with category drill-down (Cuisine, Course, Source, Tags, Cook Time), active filter pills, sort, technique results
- Search RPC upgraded: ILIKE-based search across title, description, cuisine, ingredients, tags (replaced broken pg_trgm)
- Auto-tagging: Claude extraction prompts updated to always return tags (5-8 lowercase), retroactive "Auto-tag my recipes" button on search page
- Voice recipe entry (Speak a Recipe): dedicated /dashboard/speak page, 3-step flow (Record → Review → Recipe), Web Speech API, shared RecipeReviewPanel component
- Voice recipe image: Pexels API search by recipe name, 3-image picker with thumbnails, upload option
- YouTube import: URL detection, Data API metadata, transcript, Claude extraction with timestamps, video_only fallback, description link follower
- Technique content type: separate table, AI classification, extraction prompts, detail page (two-column tips/mistakes/steps), dashboard, sidebar nav, manual entry form, extension auto-detect
- Cookbook intelligence: ISBN lookup (Google Books + OpenLibrary), cover photo AI reading, AI table-of-contents generation, cookbook detail page with recipe cards (Import/View buttons), recipe-to-cookbook linking
- Cookbook import review: RecipeReviewPanel shown before saving, cookbook cover as default image, "Book:" tag + "AI Adaptation" tag, page number in description, cookbook attribution card on recipe detail
- Cookbook import search: DuckDuckGo web search for recipe URLs, JSON-LD-first extraction, AI generation with strict no-placeholder prompt, ingredient grouping for multi-stage recipes
- Social sharing: /api/social/generate for platform-specific post text + hashtags, SocialShareModal with Instagram/Pinterest/Facebook tabs, copy/download/open actions, Pro gate
- User photos on recipes: recipe_user_photos table + storage bucket, horizontal gallery on recipe detail, set as primary, upload, delete
- Chrome extension: 500ms DOM capture delay for recipe plugins, technique auto-detect in extension import
- Import failure handling: null title fallback (titleFromUrl), non-recipe URL detection (preflight), Puppeteer 403 fallback chain, ScrapingBee, _unresolved/_incomplete tags
- JSON-LD-first extraction pipeline: extractJsonLdRecipe + checkJsonLdCompleteness, skip Claude when structured data complete, 25k char limit
- Universal file import: PDF (pdf-parse), Word (mammoth), CSV (papaparse), JSON, TXT/RTF support on Import & Scan page
- Print feature: recipe detail + shopping list print buttons, @media print CSS
- Recipe image remote patterns: next.config.ts allows all domains
- README.md created
- RLS recursion fix: shopping list policies split by operation (SELECT/INSERT/UPDATE/DELETE)
- Multiple DB migrations: YouTube (007), Techniques (008), Shopping overhaul (009), User photos (010), Cookbook intelligence (011)
