# ChefsBook Feature Registry
# Updated: 2026-04-13
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
| Onboarding bubbles (6 pages) | LIVE | apps/web/components/OnboardingBubble.tsx, useOnboarding hook | 75, 114 | @floating-ui/react; tracks seen pages per user; auto-skips missing targets |
| Help Tips toggle in settings | LIVE | apps/web/dashboard/settings | 75, 114 | Proper ON/OFF switch (red/grey); enable/disable + reset seen pages |
| Onboarding overlay in layout | LIVE | apps/web/app/dashboard/layout.tsx | 75 | OnboardingOverlay component |

---

## RECIPES
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Recipe list (My Recipes) | LIVE | apps/web/dashboard/, apps/mobile/(tabs)/index.tsx | 01 | |
| Recipe detail (read mode) | LIVE | apps/web/app/recipe/[id]/, apps/mobile/app/recipe/ | 01 | |
| Recipe detail (edit mode) | LIVE | same as above | 03 | |
| Recipe versioning | LIVE | packages/db, apps/mobile, apps/web | 06 | parent_recipe_id, version_number |
| Save a Copy | LIVE | apps/mobile/app/recipe/, apps/web | 13 | Creates fully independent clone |
| Recipe visibility (private/public) | LIVE | packages/db, RLS policies | 32, 104 | Default = 'public'; shared_link migrated to public |
| Recipe privacy toggle | LIVE | apps/web/app/recipe/[id]/, apps/mobile | 35 | |
| Recipe moderation (AI) | LIVE | packages/ai (moderateRecipe) | 41 | Runs on every import + edit |
| Frozen account banner | LIVE | apps/web/dashboard/layout.tsx, apps/mobile/_layout.tsx | 41 | |
| Recipe tags (add/remove/AI suggest) | LIVE | apps/mobile/app/recipe/, apps/web | 04 | |
| Recipe translation (5 languages) | LIVE | packages/ai (translateRecipe), /api/recipes/translate, recipe_translations table | 12, 114 | Cached per recipe+language; web uses server-side API route (CORS); mobile calls AI directly |
| Recipe likes + like count | LIVE | packages/db, recipe_likes table, trigger | 30 | Optimistic UI |
| Recipe comments (threaded) | LIVE | packages/db, recipe_comments table | 30, 86, 112 | Unlimited depth; level 3+ collapsed behind expand button; engagement sort (reply+like count DESC) |
| Comment likes | LIVE | comment_likes table, packages/db (toggleCommentLike) | 112 | Heart icon per comment, optimistic toggle, plan gate (Chef+); like_count on recipe_comments via trigger |
| Comment moderation (AI) | LIVE | packages/ai (moderateComment) | 30 | 3 verdicts; CORS fails on web — try/catch |
| Comment flagging | LIVE | comment_flags table | 30 | 3+ flags auto-escalate |
| Comment notifications | LIVE | packages/db (createNotification), RecipeComments components | 112 | recipe_comment for owner, comment_reply for parent commenter |
| Comment username links | LIVE | RecipeComments (web → /u/[username], mobile → /chef/[user_id]) | 112 | Web was 404 (linked by user_id); fixed to use username |
| Attribution (original_submitter locked) | LIVE | packages/db, recipe detail | 31 | Never changes |
| Attribution (shared_by removable) | LIVE | packages/db | 31 | User-removable |
| Attribution pill on recipe detail | LIVE | apps/web/app/recipe/[id]/, apps/mobile | 72,99 | Shows user/cookbook/URL; backfill applied session 99 for pre-session-31 recipes |
| Add to My Recipes (save/bookmark) | LIVE | packages/db (saveRecipe), apps/web/app/recipe/[id]/ | 32, 95, 104 | Uses recipe_saves (no clone); My Recipes shows owned + saved via JOIN |
| Share link generation | LIVE | chefsbk.app/recipe/[id]?ref=[username] | 32 | |
| Guest access (view-only) | LIVE | apps/web/app/recipe/[id]/, guest_sessions table | 32 | Email capture |
| PDF export (Pro plan) | LIVE | apps/web/app/recipe/[id]/pdf/, @react-pdf/renderer | 33, 49 | Plan gated |
| Print recipe | LIVE | apps/web | 35 | @media print CSS |
| Recipe saves count | LIVE | recipe_saves table, trigger | 03 | |
| Save count display (bookmark icon) | LIVE | apps/web/app/recipe/[id]/, apps/mobile/app/recipe/ | 97, 108 | Bookmark icon + count; savers modal uses supabaseAdmin (two-step query); proper pluralization |
| Cuisine dropdown (searchable) | LIVE | apps/web/app/recipe/[id]/, apps/mobile/app/recipe/ | 97 | 31 cuisines from CUISINE_LIST; custom entry allowed |

---

## IMPORT & SCAN
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| URL import (JSON-LD first) | LIVE | packages/ai (importFromUrl), apps/web/app/api/import/ | 02 | 25k char limit |
| Instagram import | LIVE | packages/ai, apps/mobile/app/scan | 07 | Must route via isInstagramUrl() check |
| Multi-page photo scan | LIVE | apps/mobile/app/scan | 06 | Up to 5 pages |
| Dish identification from photo | LIVE | packages/ai (analyseScannedImage), apps/mobile/app/scan | 21 | classifies → clarifying Qs → recipe |
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
| Auto-tag recipes button | LIVE | apps/web/dashboard/search/, /api/recipes/auto-tag | 35 | Retroactive tagging |

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
| Dashboard header (Messages pill + Select + Add Recipe) | LIVE | apps/web/app/dashboard/page.tsx | 101 | Single flex row; Messages pill has bell icon + unread badge |
| Notification types | LIVE | packages/db (likesComments.ts) | 86 | comment_reply, recipe_comment, recipe_like, new_follower, moderation |
| Follow / unfollow | LIVE | user_follows table, packages/db (follows.ts) | 29 | Chef+ plan gate |
| Followers / Following tabs on profile | LIVE | apps/web, apps/mobile | 29 | |
| What's New feed (followed users' recipes) | LIVE | apps/mobile/(tabs)/search.tsx | 29 | |
| Social share (Instagram/Pinterest/Facebook) | LIVE | SocialShareModal, packages/ai | 35 | Pro plan gate |
| Direct messages | LIVE | packages/db/messages.ts, apps/web/dashboard/messages, apps/mobile/chef | 98, 119 | AI moderation (haiku), 1000 char limit; sendMessage accepts optional client param for admin (supabaseAdmin) |
| Message button on profiles | LIVE | apps/web (MessageButton), apps/mobile (chef/[id]) | 98, 101 | Not on own profile; mobile uses bottom sheet (not Alert.prompt) |
| Message moderation (admin) | LIVE | apps/web/admin/messages/ | 98 | Approve/Remove flagged messages |
| Message flags | LIVE | message_flags table | 98 | Inappropriate/Harassment/Spam/Other |

---

## FEEDBACK & SUPPORT
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| "Got an Idea?" feedback card | LIVE | FeedbackCard component (web + mobile) | 73, 103 | Inline error display; min 10 chars; errors show inside modal |
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
| Admin dashboard at /admin | LIVE | apps/web/app/admin/layout.tsx, /api/admin/route.ts | 28, 88, 109 | All data via /api/admin (server-side supabaseAdmin); client pages use adminFetch/adminPost |
| Admin link in sidebar (admins only, red) | LIVE | apps/web/components/Sidebar.tsx | 87, 90 | Pomodoro red, same size as Settings |
| User management (search, sort, role pills) | LIVE | apps/web/app/admin/users/ | 28, 90 | Sortable columns |
| Username edit by admin | LIVE | apps/web/app/admin/users/ | 90 | Inline edit with availability check |
| Recipe moderation queue | LIVE | apps/web/app/admin/recipes/ | 28, 116 | ChefsDialog confirmations; info tooltip; approve unfreezes + notifies; reject sets private + notifies; search by title/username |
| Promo code CRUD | LIVE | apps/web/app/admin/promos/ | 28, 90 | supabaseAdmin + error feedback |
| Plan limits display | LIVE | apps/web/app/admin/limits/ | 28 | supabaseAdmin |
| User Ideas (was Help Requests) | LIVE | apps/web/app/admin/help/ | 28, 106, 107 | Avatar + @username link + email + relative time per message |
| Suspend / restore user | LIVE | apps/web/app/admin/users/ | 28 | |
| Admin RLS (non-recursive) | LIVE | admin_users table RLS | 89 | user_id = auth.uid() direct check |
| Reserved usernames | LIVE | reserved_usernames table, /admin/reserved-usernames | 110, 116 | 22 seed entries; signup blocks reserved; admin CRUD; approve with user search dropdown; AI-flagged usernames section |
| Account status tags | LIVE | user_account_tags table, /admin/users | 110 | Color-coded pills; tag filter; admin-only |
| User flags | LIVE | user_flags table, /admin/users | 110 | ⚑ icon on flagged users; resolve via click |
| Admin email column | LIVE | /admin/users, /api/admin (auth.admin.listUsers) | 110 | Reads from auth.users via service role |
| Admin DM + bulk messaging | LIVE | /admin/users, /api/admin (sendMessage) | 110 | Single + bulk compose; progress indicator |
| Admin recipes sorting | LIVE | /admin/recipes | 110 | Sortable columns + submitter pill |
| Import site tracker | LIVE | import_site_tracker table, /admin/import-sites, /api/import/url | 116 | Auto-tracks domain success rates; filter pills; admin edit + review |
| Flagged comments (admin) | LIVE | /admin/flags, /api/admin (flagged-comments) | 116 | Queries comment_flags; shows comment + commenter + recipe; approve/remove |
| Flagged messages (admin) | LIVE | /admin/messages, /api/admin (messages) | 116 | Includes user-flagged messages via message_flags; shows flag count + reasons |

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
| Image proxy /api/image | LIVE | apps/web/app/api/image/ | 24 | Proxies Supabase storage URLs with apikey |
| Chef's hat fallback | LIVE | RecipeImage component | 11 | Shows when no recipe image |
| StoreAvatar (logo.dev) | LIVE | StoreAvatar component | 69 | Initials fallback with hash color |
| i18n (web + mobile, 5 locales) | LIVE | apps/web/locales/, apps/mobile/locales/ | 08, 53 | react-i18next |
| FloatingTabBar (mobile) | LIVE | apps/mobile/components/FloatingTabBar.tsx | 01 | 5 tabs with i18n labels |

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
