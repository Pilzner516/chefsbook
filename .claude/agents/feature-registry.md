# ChefsBook Feature Registry
# Updated: 2026-04-20
# Purpose: Read this before modifying ANY existing feature.
#           Update this before running /wrapup on ANY session.
#
# MANDATORY RULES:
# 1. Never remove or modify a LIVE feature without checking this file first
# 2. If you touch a file that owns a feature, verify that feature still works
# 3. Before /wrapup: update status of any feature you touched
# 4. If a feature breaks during your session, mark it BROKEN — do not hide it

---

## AUTH & ACCOUNTS
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Email/password sign in | LIVE | apps/web/app/auth/, apps/mobile/app/auth/ | 01 | |
| Sign up with username | LIVE | apps/web/app/auth/, apps/mobile/app/auth/ | 29 | Username permanent after set |
| Username family-friendly check | LIVE | packages/ai (isUsernameFamilyFriendly) | 44 | Non-blocking on AI error |
| Google OAuth (stub) | PARTIAL | apps/web/app/auth/, apps/mobile/app/auth/ | 01 | UI exists, not wired |
| Forgot password / reset link | LIVE | apps/web/app/auth/reset/, Resend SMTP | 91 | redirectTo chefsbk.app/auth/reset |
| Change password in settings | LIVE | apps/web/dashboard/settings, apps/mobile/app/modal.tsx | 91 | |
| Session persistence | LIVE | packages/db (configureStorage) | 07 | expo-secure-store on mobile |
| Auto-confirm signup | LIVE | RPi5 GoTrue config | 83 | GOTRUE_MAILER_AUTOCONFIRM=true |

---

## ONBOARDING
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Onboarding bubbles (8 pages) | LIVE | apps/web/components/OnboardingBubble.tsx, useOnboarding hook | 75, 114, 120, 129 | @floating-ui/react; tracks seen pages per user; auto-skips missing targets (5 retries at 200ms); scrolls to target; "Got it" per-page / "Turn off tips" global; re-fetches DB state on page navigation |
| Help Tips toggle in settings | LIVE | apps/web/dashboard/settings | 75, 114, 129 | Proper ON/OFF switch (red/grey); enable/disable + reset seen pages |
| Onboarding overlay in layout | LIVE | apps/web/app/dashboard/layout.tsx | 75 | OnboardingOverlay component |

---

## RECIPES
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Recipe list (My Recipes) | LIVE | apps/web/dashboard/, apps/mobile/(tabs)/index.tsx | 01 | |
| Recipe detail (read mode) | LIVE | apps/web/app/recipe/[id]/, apps/mobile/app/recipe/ | 01 | |
| Recipe detail (edit mode) | LIVE | same as above | 03 | |
| Recipe versioning | LIVE | packages/db, apps/mobile, apps/web | 06 | parent_recipe_id, version_number |
| Cook Mode TTS | LIVE | apps/mobile/app/recipe/[id].tsx (CookMode component) | P-208 | Speaker pill toggle (red on/grey off) in header; "Read this step" pill per step card; expo-speech, zero AI calls. Speaks on step navigation when toggle on. Stop on exit. i18n: recipe.ttsToggle + recipe.readStep in all 5 locales. |
| Save a Copy | LIVE | apps/mobile/app/recipe/, apps/web | 13 | Creates fully independent clone |
| Recipe visibility (private/public) | LIVE | packages/db, RLS policies | 32, 104 | Default = 'public'; shared_link migrated to public |
| Recipe privacy toggle | LIVE | apps/web/app/recipe/[id]/, apps/mobile | 35, P-G | Enforced: blocks Make Public if incomplete or under review; ChefsDialog with specific reason |
| Recipe status pills | LIVE | apps/web/dashboard/page.tsx, apps/web/app/recipe/[id]/page.tsx, lib/recipeCompleteness.ts | P-G | Amber incomplete pill (⚠ Missing X), Red under review pill (🔍); bottom-centre on image; shows on cards + detail hero; owner-facing only |
| Recipe moderation (AI) | LIVE | packages/ai (moderateRecipe) | 41 | Runs on every import + edit |
| Recipe edit re-moderation | LIVE | apps/web/app/recipe/[id]/page.tsx (reModerateIfPublic) | P-J | Non-blocking re-moderation on public recipe edits (title/desc/ingredients/steps/notes); auto-hides if flagged/serious |
| Tag moderation | LIVE | packages/ai (moderateTag), apps/web/app/recipe/[id]/page.tsx, apps/web/app/api/recipes/auto-tag/route.ts | P-J | Async on user-added tags; blocking on import-time tags; removes flagged tags |
| Comment reply moderation | LIVE | apps/web/components/RecipeComments.tsx (handleReply) | P-J | Same moderation as top-level comments; CORS try/catch |
| Profile moderation (bio/display_name) | LIVE | packages/ai (moderateProfile), apps/web/app/dashboard/settings/page.tsx | P-J | Non-blocking; reverts flagged fields |
| Cookbook moderation (name/description) | LIVE | packages/ai (moderateProfile reuse), apps/web/app/dashboard/cookbooks/page.tsx | P-J | Non-blocking; sets visibility=private if flagged (only when public) |
| Frozen account banner | LIVE | apps/web/dashboard/layout.tsx, apps/mobile/_layout.tsx | 41 | |
| Recipe tags (add/remove/AI suggest) | LIVE | apps/mobile/app/recipe/, apps/web | 04 | |
| Recipe translation (5 languages) | LIVE | packages/ai (translateRecipe, translateRecipeTitle), /api/recipes/translate, /api/recipes/translate-title, recipe_translations table | 12, 114, 127 | Two-tier: title-only on import (HAIKU, fire-and-forget), full on detail open (Sonnet, lazy with banner); is_title_only column; cached per recipe+language; backfill script at scripts/backfill-translations.mjs |
| Recipe likes + like count | LIVE | /api/recipe/[id]/like (server), LikeButton.tsx (client), packages/db (toggleLike) | 30, 124, 128, 142 | Server-side API route; plan gate (free=blocked+upgrade dialog) on LikeButton AND on recipe detail top-heart toggleFav (session 142); optimistic UI; notification via supabaseAdmin (no self-like, no unlike) |
| Recipe comments (threaded) | LIVE | packages/db, recipe_comments table | 30, 86, 112 | Unlimited depth; level 3+ collapsed behind expand button; engagement sort (reply+like count DESC) |
| Comment likes | LIVE | comment_likes table, packages/db (toggleCommentLike) | 112 | Heart icon per comment, optimistic toggle, plan gate (Chef+); like_count on recipe_comments via trigger |
| Comment moderation (AI) | LIVE | packages/ai (moderateComment) | 30 | 3 verdicts; CORS fails on web — try/catch |
| Comment flagging | LIVE | comment_flags table | 30 | 3+ flags auto-escalate |
| Comment notifications | LIVE | packages/db (createNotification via supabaseAdmin), RecipeComments components | 112, 120 | recipe_comment for owner, comment_reply for parent commenter; uses supabaseAdmin to bypass RLS |
| Comment username links | LIVE | RecipeComments (web → /dashboard/chef/[username], mobile → /chef/[user_id]) | 112, 126 | Web links to /dashboard/chef/ (sidebar visible); public /u/ kept for external/SEO |
| Attribution (original_submitter locked) | LIVE | packages/db, recipe detail | 31 | Never changes |
| Attribution (shared_by removable) | LIVE | packages/db | 31 | User-removable |
| Attribution pill on recipe detail | LIVE | apps/web/app/recipe/[id]/, apps/mobile | 72,99 | Shows user/cookbook/URL; backfill applied session 99 for pre-session-31 recipes |
| Add to My Recipes (save/bookmark) | LIVE | packages/db (saveRecipe), apps/web/app/recipe/[id]/ | 32, 95, 104 | Uses recipe_saves (no clone); My Recipes shows owned + saved via JOIN |
| Share link generation | LIVE | chefsbk.app/recipe/[id]?ref=[username] | 32 | |
| Guest access (view-only) | LIVE | apps/web/app/recipe/[id]/, guest_sessions table | 32 | Email capture |
| PDF export (Pro plan) | LIVE | apps/web/app/recipe/[id]/pdf/, @react-pdf/renderer | 33, 49, 129, P-209 | Plan gated; options modal before generate; admin bypass: admin_users row → skip plan check on both server and client |
| Print recipe | LIVE | apps/web | 35, 129 | Options modal before print (include image/comments toggles); CSS print-hide class toggled via JS; @media print CSS |
| Recipe saves count | LIVE | recipe_saves table, trigger | 03 | |
| Save count display (bookmark icon) | LIVE | apps/web/app/recipe/[id]/, apps/mobile/app/recipe/, /api/recipe/[id]/savers | 97, 108, 132 | Bookmark icon + count; savers modal fetches via /api/recipe/[id]/savers (server-side supabaseAdmin); proper pluralization |
| Cuisine dropdown (searchable) | LIVE | apps/web/app/recipe/[id]/, apps/mobile/app/recipe/ | 97 | 31 cuisines from CUISINE_LIST; custom entry allowed |

---

## IMPORT & SCAN
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| URL import (JSON-LD first) | LIVE | packages/ai (importFromUrl), apps/web/app/api/import/ | 02, 152 | 25k char limit; session 152 added import-time translation (detectLanguage→translateRecipeContent when source!=user lang) |
| Instagram import | REMOVED | packages/ai (commented), apps/mobile/app/scan | 07, 138 | Removed session 138 — scraping unreliable, no native SEND-intent receiver wired. Use photo scan on a screenshot instead. fetchInstagramPost / extractRecipeFromInstagram kept in source but no longer exported from packages/ai. scanRecipe prompt now handles social media screenshots (caption extraction). |
| Multi-page photo scan | LIVE | apps/mobile/app/(tabs)/scan.tsx | 06, P-208 | Up to 5 pages. takePhoto() throws on non-cancel errors; addScanPage() catch shows Alert instead of silent page loss. |
| Dish identification from photo | LIVE | packages/ai (analyseScannedImage), apps/mobile/app/scan | 21 | classifies → clarifying Qs → recipe |
| Guided scan flow (A→B→C→D) | LIVE | apps/mobile/components/GuidedScanFlow.tsx, packages/ai/scanGuidedFollowUps.ts | 203 | Replaces DishIdentificationFlow for dish photos. Step A title+comments, Step B 0–3 Haiku questions (skipped when none), Step C anything-else?+final thoughts, Step D single Sonnet gen via generateDishRecipe. Logs scan_guided_followups (haiku) + scan_guided_generation (sonnet) via logAiCallFromClient. Plan-gated at startScan entry. |
| Speak a Recipe | LIVE | apps/web/dashboard/speak/, apps/mobile | 06 | Web Speech API |
| File import (PDF/Word/CSV/JSON) | LIVE | apps/web/app/api/import/file | 35 | pdf-parse, mammoth, papaparse |
| YouTube import | LIVE | packages/ai (importFromYouTube) | 35 | Data API + transcript + timestamps |
| Bookmark batch import | LIVE | apps/web/dashboard/scan/ | 35 | Parses bookmarks.html |
| Cookbook intelligence (ISBN/barcode) | LIVE | packages/ai, apps/web/app/api/cookbooks/ | 35 | Google Books + OpenLibrary |
| Chrome extension import | LIVE | apps/extension/ | 78 | MV3, plain JS, production URLs |
| Pexels photo picker | LIVE | PexelsPickerSheet component | 11 | 3 images shown |
| PostImportImageSheet | LIVE | apps/mobile/components/PostImportImageSheet | 19 | Shown after all imports |
| aiChef completion (missing sections) | LIVE | packages/ai | 02 | |
| Reimport (re-fetch URL, update AI fields) | LIVE | apps/web/app/api/import/reimport | 35 | Preserves user edits |
| Auto-tag recipes button | LIVE | apps/web/dashboard/search/, /api/recipes/auto-tag | 35 | Retroactive bulk tagging (no body → loops over all user recipes needing tags) |
| Auto-tag on every import | LIVE | packages/ai/suggestTagsForRecipe.ts, /api/recipes/auto-tag (single-recipe mode), apps/web/lib/saveWithModeration.ts, /api/extension/import | 189 | Fire-and-forget post-insert when persisted tags < 3. Haiku ~$0.0002/recipe. createRecipe now also inserts tags column directly (was silently dropped pre-session-189). Logged via logAiCall(suggest_tags/haiku). |
| AI ingredient generation | LIVE | packages/ai (generateMissingIngredients), /api/recipes/[id]/generate-ingredients | 166 | Sonnet ~$0.003/call; generates ingredients from title+description+steps when extraction missed them; user preview before save |

---

## SEARCH & DISCOVERY
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Search page — All / My Recipes toggle | LIVE | apps/web/dashboard/search/, apps/mobile/(tabs)/search.tsx | 90 | Default = All Recipes |
| Search RPC (pg_trgm fuzzy) | LIVE | search_recipes RPC | 35 | title/description/cuisine/ingredients/tags |
| Category drill-down filters | LIVE | apps/web/dashboard/search/, apps/mobile | 35 | Cuisine, course, source, tags, time, dietary, ingredient |
| Public recipe visibility fix (shared_link) | LIVE | search_recipes RPC, get_public_feed RPC | 92 | visibility IN ('public','shared_link') |
| Discover (redirects to search) | LIVE | apps/web/dashboard/discover/ | 38 | |
| Technique search | LIVE | apps/web/dashboard/search/ | 35 | |

---

## SHOPPING LIST
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Shopping list CRUD | LIVE | packages/db, apps/web/dashboard/shop/, apps/mobile/(tabs)/shop.tsx | 03 | |
| Store-first list creation | LIVE | StorePickerDialog (web), StorePicker (mobile) | 48 | |
| Store grouping with logos | LIVE | StoreAvatar component | 69 | logo.dev API |
| Store name normalization (Title Case) | LIVE | packages/db (createStore) | 82 | Case-insensitive unique index |
| Department grouping (13 depts) | LIVE | packages/db (addItemsWithPipeline) | 03 | |
| 3 view modes (Dept/Recipe/A-Z) | LIVE | apps/web/dashboard/shop/, apps/mobile | 03 | |
| Font size toggle | LIVE | apps/mobile/(tabs)/shop.tsx | 05 | 3 sizes, SecureStore persisted |
| Consolidated "All [Store]" view | LIVE | apps/web/dashboard/shop/, apps/mobile | 84,96,115 | Uses same shop-item-grid layout as individual lists; view mode toggle (Dept/Recipe/A-Z); font size toggle; purchase unit + recipe source + usage |
| Offline shopping cache | LIVE | apps/mobile/lib/shoppingCache.ts | 74 | FileSystem cache, sync on reconnect |
| Add to shopping from recipe | LIVE | apps/web, apps/mobile | 03 | AI purchase unit suggestions |
| Add week/day to shopping from meal plan | LIVE | apps/web/dashboard/plan/, apps/mobile | 04 | |
| Print shopping list | LIVE | apps/web | 35 | @media print CSS |
| Realtime sync (Supabase Realtime) | LIVE | apps/mobile shoppingStore | 02 | WebSocket via wss://api.chefsbk.app |

---

## MEAL PLAN
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Meal plan calendar (7 days) | LIVE | apps/web/dashboard/plan/, apps/mobile/(tabs)/plan.tsx | 04 | |
| Add recipe to meal plan (MealPlanPicker) | LIVE | MealPlanPicker component | 44, 115 | Chef+ plan gate; timezone fix (toISOString→local date) |
| Daypart pill (Breakfast/Lunch/Dinner/Snack) | LIVE | apps/web, apps/mobile | 70 | ChefsDialog picker |
| Servings pill (stepper) | LIVE | apps/web, apps/mobile | 70 | ChefsDialog stepper |
| Portions mismatch warning | LIVE | apps/web, apps/mobile, MealPlanPicker | 46,96 | Triggers on cart-add AND recipe-add when >2x serving diff |
| AI Meal Plan Wizard | LIVE | MealPlanWizard component | 07 | 4-step modal |
| Menu templates | LIVE | apps/web/dashboard/plan/templates/ | 04 | |

---

## NOTIFICATIONS & SOCIAL
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Dashboard header (NotificationBell + Select + Add Recipe) | LIVE | apps/web/app/dashboard/page.tsx, NotificationBell.tsx | 101, 122 | Bell icon opens slide-in notification panel (5 tabs); sidebar "Messages" link handles DMs separately |
| Notification types | LIVE | packages/db (likesComments.ts) | 86 | comment_reply, recipe_comment, recipe_like, new_follower, moderation |
| Follow / unfollow | LIVE | user_follows table, packages/db (follows.ts) | 29 | Chef+ plan gate |
| Followers / Following tabs on profile | LIVE | apps/web, apps/mobile | 29 | |
| What's New feed (followed users' recipes) | LIVE | apps/mobile/(tabs)/search.tsx | 29 | |
| Social share (Instagram/Pinterest/Facebook) | LIVE | SocialShareModal, packages/ai | 35 | Pro plan gate |
| Direct messages | LIVE | packages/db/messages.ts, apps/web/dashboard/messages, apps/mobile/chef | 98, 119, 121, 125 | AI moderation (haiku), 1000 char limit; sendMessage optional client; chat UI: avatars, textarea, Realtime; thread header shows role pill (Super Admin/Admin/Proctor/Member) |
| Message button on profiles | LIVE | apps/web (MessageButton), apps/mobile (chef/[id]) | 98, 101 | Not on own profile; mobile uses bottom sheet (not Alert.prompt) |
| Message moderation (admin) | LIVE | apps/web/admin/messages/ | 98 | Approve/Remove flagged messages |
| Message flags | LIVE | message_flags table | 98 | Inappropriate/Harassment/Spam/Other |

---

## FEEDBACK & SUPPORT
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| "Got an Idea?" feedback card | LIVE | FeedbackCard component (web + mobile) | 73, 103 | Inline error display; min 10 chars; errors show inside modal |
| QA Notepad send-to-admin | LIVE | apps/mobile/components/QANotepad.tsx | P-206 | Paper-plane icon in header sends all items as [QA NOTEPAD]-prefixed help_request; ChefsDialog confirm; success toast 2.5s; clears notepad on success |
| Feedback stored in help_requests table | LIVE | packages/db, /api/feedback | 73 | |
| Privacy policy page | LIVE | apps/web/app/privacy/ | 77 | |

---

## SETTINGS & PREFERENCES
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Language selector (5 languages: en/fr/es/it/de) | LIVE | LanguagePickerModal, apps/web sidebar | 08, 95 | ONLY 5 — filtered via SUPPORTED_LANGUAGES |
| Metric/imperial toggle | LIVE | preferencesStore, apps/web sidebar (useUnits hook) | 03, 99 | unitConversion.ts in packages/ui — display-only, never writes to DB; reactive via localStorage events |
| Profile edit (name, bio) | LIVE | apps/web/dashboard/settings, apps/mobile settings | 29 | |
| Privacy toggle (is_searchable) | LIVE | apps/web, apps/mobile | 29 | |
| Avatar upload | LIVE | apps/web/dashboard/settings | 35 | |
| Plan display + upgrade CTA | LIVE | apps/web/dashboard/plans/, apps/mobile | 27 | |

---

## ADMIN
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Admin dashboard at /admin | LIVE | apps/web/app/admin/layout.tsx, /api/admin/route.ts | 28, 88, 109, 134 | All data via /api/admin (server-side supabaseAdmin); ALL client pages use adminFetch/adminPost (no direct supabaseAdmin imports) |
| Admin link in sidebar (admins only, red) | LIVE | apps/web/components/Sidebar.tsx | 87, 90 | Pomodoro red, same size as Settings |
| User management (search, sort, role pills) | LIVE | apps/web/app/admin/users/ | 28, 90 | Sortable columns |
| Username edit by admin | LIVE | apps/web/app/admin/users/ | 90 | Inline edit with availability check |
| Recipe moderation queue | LIVE | apps/web/app/admin/recipes/ | 28, 116 | ChefsDialog confirmations; info tooltip; approve unfreezes + notifies; reject sets private + notifies; search by title/username |
| Promo code CRUD | LIVE | apps/web/app/admin/promos/ | 28, 90 | supabaseAdmin + error feedback |
| Plan limits display | LIVE | apps/web/app/admin/limits/ | 28, 134 | Client component via /api/admin?page=limits |
| User Ideas (was Help Requests) | LIVE | apps/web/app/admin/help/ | 28, 106, 107 | Avatar + @username link + email + relative time per message |
| Suspend / restore user | LIVE | apps/web/app/admin/users/ | 28 | |
| Admin RLS (non-recursive) | LIVE | admin_users table RLS | 89 | user_id = auth.uid() direct check |
| Reserved usernames | LIVE | reserved_usernames table, /admin/reserved-usernames | 110, 116 | 22 seed entries; signup blocks reserved; admin CRUD; approve with user search dropdown; AI-flagged usernames section |
| Account status tags | LIVE | user_account_tags table, /admin/users | 110 | Color-coded pills; tag filter; admin-only |
| User flags | LIVE | user_flags table, /admin/users | 110 | ⚑ icon on flagged users; resolve via click |
| Admin email column | LIVE | /admin/users, /api/admin (auth.admin.listUsers) | 110 | Reads from auth.users via service role |
| Admin DM + bulk messaging | LIVE | /admin/users, /api/admin (sendMessage) | 110 | Single + bulk compose; progress indicator |
| Admin recipes sorting | LIVE | /admin/recipes | 110 | Sortable columns + submitter pill |
| Import site tracker | LIVE | import_site_tracker table, /admin/import-sites, /api/import/url | 116, 141 | Auto-tracks domain success rates; filter pills; admin edit + review; session 141 added rating 1-5, blocked toggle, block_reason, failure_taxonomy, sample_failing_urls, auto_test_enabled, KPI cards, CSV export |
| Import completeness gate | LIVE | packages/db (checkRecipeCompleteness, applyCompletenessGate, applyAiVerdict), /api/recipes/finalize | 141 | Runs after every recipe save; visibility locked to private until title+description+≥2 ingredients w/qty+≥1 step+≥1 tag + AI approved |
| isActuallyARecipe (HAIKU AI check) | LIVE | packages/ai (isActuallyARecipe) | 141 | Runs after completeness passes; verdicts: approved/flagged/not_a_recipe |
| Import attempts log | LIVE | import_attempts table, logImportAttempt() | 141 | Per-attempt row; auto-updates import_site_tracker aggregates |
| Site compatibility testing | LIVE | /api/admin/test-sites, KNOWN_RECIPE_SITES, site_test_runs table | 141, 161 | Full import pipeline per site (not just JSON-LD check); logs to site_test_runs; results summary modal with CSV export; detects needsExtension; NULL rating for blocked sites |
| Blocked site handling | LIVE | getSiteBlockStatus, /api/import/url | 141 | Domain pre-check returns friendly error with alternative; rating ≤2 shows warning |
| Incomplete recipes admin | LIVE | /admin/incomplete-recipes, /api/admin?page=incomplete-recipes | 141 | Lists all is_complete=false + flagged recipes; force approve / remove |
| User import stats card | LIVE | /dashboard/settings, ImportActivityCard.tsx, /api/user/import-stats | 141, 144 | Shows imported/with issues/flagged + "N sites you helped discover" (session 144) + "View" modal |
| Unknown site discovery | LIVE | recordSiteDiscovery (packages/db), /api/import/url, /api/sites/discovery, /api/recipes/finalize, DiscoveryToast (web + mobile) | 144 | First-time domains auto-inserted with is_user_discovered=true; warm green-bordered toast thanks the user; successful imports auto-promoted to added_to_list rating 4; per-user sites_discovered_count attribution |
| Admin New Discoveries tab | LIVE | /admin/import-sites, /api/admin (updateImportSite reviewStatus) | 144 | 🌍 filter pill green-tinted when pending; Add/Ignore per-row actions; pendingDiscoveries in KPI payload |
| Site compatibility crawl v3 | LIVE | packages/ai/src/siteList.ts, scripts/test-site-compatibility.mjs | 143, 145, 154 | v3: --targets flag for 35 priority sites; passes userLanguage:'en' for translation; tags ChefsBook-v2; NULL rating for blocked sites (not 1★); uses localhost:3000 import endpoint. Session 154: 16 recipes saved in English, 5 translated (fr/it/es→en), 5 sites marked extension-required |
| Extension silent handoff for blocked sites | LIVE | apps/extension/content-script.js, apps/extension/background.js, apps/extension/popup.js | 146 | Extension v1.1.0 injects presence marker on chefsbk.app, listens for CHEFSBOOK_PDF_IMPORT postMessages, opens + scrapes target URL in background tab (1.5s settle), posts to /api/extension/import. Popup uses calm "Getting full recipe..." label on 60 known Cloudflare-protected domains. |
| Refresh recipe from source | LIVE | /api/recipes/refresh, RefreshFromSourceBanner, /api/admin/refresh-incomplete, /admin/incomplete-recipes | 146 | Merge-only re-import (never overwrites existing fields), re-runs completeness gate + isActuallyARecipe. Amber banner on any incomplete recipe detail. Admin bulk runner at 1/5s with progress summary. Hands off to extension via postMessage when server-side fetch is blocked. |
| Sous Chef suggest (incomplete recipes) | LIVE | /api/recipes/[id]/sous-chef-suggest, RefreshFromSourceBanner, SousChefSuggestModal | P-B | AI-powered gap-fill for incomplete recipes; Haiku model ~$0.0003–$0.0006/call; 8s source re-fetch timeout; user review modal with editable suggestions; appends ingredients (never replaces); only adds steps if 0 exist; publish prompt if completeness gate met after save; web only |
| Recipe image lightbox | LIVE | RecipeLightbox component, apps/web/app/recipe/[id]/page.tsx | P-C | Full-screen image viewer on recipe detail; click hero image to open; left/right arrows, keyboard (ArrowLeft/Right/Escape), touch swipe navigation; counter shown when 2+ images; body scroll lock; click outside/X to close; wrapping navigation; createPortal for z-index isolation; web only |
| extraction_method tracking | LIVE | migration 038, import_attempts | 146 | Records which method succeeded per attempt for admin analytics (json-ld / claude-html / claude-only / pdf-fallback / vision-screenshot / manual / extension-html / refresh-from-source). |
| Incomplete recipes banner | LIVE | /dashboard, IncompleteRecipesBanner.tsx | 141 | Amber banner, dismissible via localStorage |
| Flagged comments (admin) | LIVE | /admin/flags, /api/admin (flagged-comments) | 116 | Queries comment_flags; shows comment + commenter + recipe; approve/remove |
| Flagged messages (admin) | LIVE | /admin/messages, /api/admin (messages) | 116 | Includes user-flagged messages via message_flags; shows flag count + reasons |
| Step rewriting on import | LIVE | packages/ai (rewriteRecipeSteps), apps/web/lib/saveWithModeration.ts | 147 | HAIKU ~$0.0003/recipe; fire-and-forget on URL/extension imports; backfill script at scripts/rewrite-imported-steps.mjs |
| AI image generation | LIVE | apps/web/lib/imageGeneration.ts, /api/recipes/generate-image, /api/recipes/regenerate-image, packages/ai/src/imageThemes.ts | 147, 156, 181, 184B, 192 | Replicate Flux Dev ~$0.025/image at ALL levels (session 192 unified — prompt_strength spectrum replaces model switching). Visible ChefsBook badge watermark (session 180). Creativity levels 1-5 from system_settings.image_creativity_level map to prompt_strength {1:0.2, 2:0.4, 3:0.6, 4:0.8, 5:0.95}. img2img when recipes.source_image_url is populated — passes og:image URL as Flux `image` param; aspect_ratio of output matches source. Falls back to text-to-image at same prompt_strength with console.warn when source_image_url is NULL (legacy recipes pre-session-181). Level-1 prompt still leads with "match this source very closely: <describeSourceImage output>" when source_image_description exists. Regeneration limit = 5 per recipe (session 184B); regen_count is incremented (read-then-write). |
| AI image generation (mobile) | LIVE | apps/mobile/components/AiImageGenerationModal.tsx, /api/recipes/mobile-generate-image | P-207 | Same Replicate backend as web. Modal: 4 states — free plan gate, loading, preview, config. Theme picker (horizontal scroll, emoji tile cards). Creativity slider 1–5 (segment tap + ±buttons). REGEN_LIMIT=5. 402→upgrade alert; 429→regen limit alert. Auto-opens after Speak-a-Recipe save. i18n: 33 keys in imageManager namespace across all 5 locales. |
| Change Image overlay (mobile) | LIVE | apps/mobile/app/recipe/[id].tsx | P-207 | Owner-only semi-transparent bar over hero image. Taps → action sheet: GENERATE AI IMAGE / CHOOSE FROM LIBRARY / TAKE A PHOTO. |
| Image watermark check | LIVE | packages/ai (checkImageForWatermarks), /api/recipes/check-image | 147 | HAIKU Vision ~$0.005/check; blocks high-risk uploads, warns on medium; runs before every user image upload |
| Copyright confirmation modal | LIVE | apps/web/app/recipe/[id]/page.tsx, apps/mobile/components/EditImageGallery.tsx | 147 | ChefsDialog (web) / Alert (mobile) before every image upload; confirms user owns the image |
| Recipe flagging system | LIVE | recipe_flags table, /api/recipes/flag, apps/web/app/recipe/[id]/page.tsx | 147, 148 | Report modal with 6 pill reasons + optional comment; users report only — NO auto-visibility changes; admins act via /admin/copyright |
| Copyright review admin | LIVE | /admin/copyright, /api/admin (copyright actions) | 147 | Approve (auto-restore previous visibility) / Remove (permanent private + DM) / Dismiss; flagger reputation shown |
| Copyright visibility lock | LIVE | apps/web/app/recipe/[id]/page.tsx | 147, 148 | Visibility toggle disabled while copyright_review_pending=true; amber banner for owner; ONLY set by admin action, never by user flag |
| AI moderation toggle | LIVE | system_settings table, /admin/settings, saveWithModeration.ts | 148 | ON/OFF toggle; serious+ON=auto-hide; serious+OFF=flag-only; mild=always flag-only |
| AI spam detection | LIVE | packages/ai (moderateRecipe), apps/web/lib/saveWithModeration.ts | P-K2 | Extends existing moderateRecipe call with spam signals (no new AI cost); auto-creates recipe_flags with flagged_by=null (AI Proctor) |
| Admin flagged recipes queue | LIVE | /admin/flagged-recipes, /api/admin/flags/route.ts, /api/admin/flags/[recipeId]/action/route.ts | P-K2 | Lists recipes with pending flags; actions: Make Private/Hide/Delete/Dismiss; flag detail drawer shows AI Proctor for null flagged_by |

---

## CONTENT TYPES
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Techniques (separate from recipes) | LIVE | apps/web/dashboard/techniques/, techniques table | 35 | AI classification |
| Cookbooks with recipe cards | LIVE | apps/web/dashboard/cookbooks/ | 35 | ISBN lookup, cover photo |

---

## UI SYSTEM
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Trattoria theme (cream/red/green) | LIVE | tailwind.config.ts, ThemeContext | 01 | NEVER hardcode hex |
| ChefsDialog (unified modal) | LIVE | apps/web/components/useConfirmDialog, apps/mobile/components/ChefsDialog | 47 | Replaces all native confirm/alert |
| Image proxy /api/image | LIVE | apps/web/app/api/image/ | 24, 132 | Allowlisted hosts only (RPi5, api.chefsbk.app, logo.dev, Pexels, Unsplash); returns 403 for others; adds apikey for Supabase URLs |
| Chef's hat fallback | LIVE | RecipeImage component | 11 | Shows when no recipe image |
| StoreAvatar (logo.dev) | LIVE | StoreAvatar component | 69 | Initials fallback with hash color |
| i18n (web + mobile, 5 locales) | LIVE | apps/web/locales/, apps/mobile/locales/ | 08, 53 | react-i18next |
| FloatingTabBar (mobile) | LIVE | apps/mobile/components/FloatingTabBar.tsx, apps/mobile/app/_layout.tsx | 01, 203 | 5 tabs with i18n labels. Session 203: mounted at root Stack (not inside (tabs) Tabs layout) so it persists on detail screens (recipe/[id], cookbook/[id], chef/[id], share/[token]). Hidden on /, /auth/*, /modal, /messages. |
| Branded launch splash (3s min) | LIVE | apps/mobile/app/_layout.tsx (SplashOverlay) | 203 | expo-splash-screen preventAutoHideAsync at module scope; React overlay shows chef-hat asset + "ChefsBook" serif wordmark + "Welcome to ChefsBook" tagline for SPLASH_MIN_MS=3000. Warm resume never re-shows. |
| Web loading splash | LIVE | apps/web/app/loading.tsx | P-209 | Next.js Suspense fallback: cream #faf7f0, chef hat from /images/chefs-hat.png, ChefsBook Georgia serif wordmark, Welcome tagline. Zero network calls, all assets local. |

---

## AI COST & THROTTLE
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| AI usage logging | LIVE | packages/db (logAiCall), ai_usage_log table | 174 | Logs action, model, tokens, cost per call; wired into /api/import/url + /api/recipes/generate-image |
| AI cost dashboard | LIVE | /admin/costs, /api/admin?page=costs | 174 | KPI cards (today/month/avg/throttled), cost by action bars, cost by model, top users, throttled users list with remove/whitelist |
| Throttle system | LIVE | packages/db (checkAndUpdateThrottle, isUserThrottled), user_throttle table | 174 | Yellow/red levels from system_settings; grace period for new users; admin override; auto-restore at billing cycle |
| Admin overview overhaul | LIVE | /admin page.tsx | 174 | Command center: 6 health KPIs, MRR/AI cost/margin, plan distribution, quick action links |

---

## INFRASTRUCTURE
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| supabaseAdmin (service role client) | LIVE | packages/db/src/client.ts | 87 | Bypasses RLS; server-side only |
| SMTP via Resend | LIVE | RPi5 supabase .env | 91 | smtp.resend.com, noreply@chefsbk.app |
| Cloudflare Tunnel | LIVE | RPi5 systemd cloudflared | 25 | chefsbk.app + api.chefsbk.app |
| PM2 web server | LIVE | RPi5 /mnt/chefsbook/repo/apps/web | 25 | chefsbook-web process |

---

## MANDATORY UPDATE RULES

Before running /wrapup on any session:

1. For every feature you TOUCHED: update its Status if it changed
2. For every NEW feature you built: add a row to the correct section
3. For every feature you REMOVED or BROKE: mark as BROKEN or REMOVED
   — do not hide regressions, they need to be visible
4. If you are unsure whether a feature still works: mark it PARTIAL

Format for new rows:
| Feature name | LIVE | primary/owner/files.ts | session# | Any gotcha |

Never delete rows. Change status instead.
