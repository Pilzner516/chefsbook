# ChefsBook — Create Feature Registry Agent
# Purpose: Build a living feature registry that prevents agents from
#           accidentally breaking or removing existing features
# Run this ONCE before any other sessions

---

## CONTEXT

Read CLAUDE.md and DONE.md fully before starting.
This session creates a new mandatory agent: .claude/agents/feature-registry.md

The problem: agents fix bugs or add features in isolation without awareness of
the full feature surface. This causes regressions where fixing one thing breaks
another, or features disappear silently between sessions.

The solution: a Feature Registry that every agent must read and update.

---

## STEP 1 — Create .claude/agents/feature-registry.md

This file must be comprehensive. Populate it from DONE.md and CLAUDE.md.
Structure it exactly as shown below.

For each feature, record:
- Feature name
- Status: LIVE | BROKEN | PARTIAL | REMOVED
- Files that own this feature (primary files only)
- Which session built it
- Any known fragility or gotchas

---

## FEATURE REGISTRY TEMPLATE

Create .claude/agents/feature-registry.md with this content,
populated with real data from DONE.md:

```markdown
# ChefsBook Feature Registry
# Updated: [today's date]
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
| Username family-friendly check | LIVE | packages/ai/src/moderateUsername.ts | 44 | Non-blocking on AI error |
| Google OAuth (stub) | PARTIAL | apps/web/app/auth/, apps/mobile | 01 | UI exists, not wired |
| Forgot password / reset link | LIVE | apps/web/app/auth/reset/, Resend SMTP | 89 | redirectTo chefsbk.app/auth/reset |
| Change password in settings | LIVE | apps/web/dashboard/settings, apps/mobile settings | 89 | |
| Session persistence | LIVE | packages/db (configureStorage) | 07 | expo-secure-store on mobile |
| Auto-confirm signup | LIVE | RPi5 GoTrue config | 76 | GOTRUE_MAILER_AUTOCONFIRM=true |

---

## ONBOARDING
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Onboarding bubbles (6 pages) | LIVE | apps/web/components/OnboardingBubble.tsx, useOnboarding hook | 65 | @floating-ui/react; tracks seen pages per user in onboarding_seen_pages |
| Help Tips toggle in settings | LIVE | apps/web/dashboard/settings | 65 | Enable/disable + reset seen pages |
| Onboarding on new accounts | LIVE | apps/web/app/dashboard/layout.tsx | 65 | OnboardingOverlay in layout |

---

## RECIPES
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Recipe list (My Recipes) | LIVE | apps/web/dashboard/, apps/mobile/(tabs)/index.tsx | 01 | |
| Recipe detail (read mode) | LIVE | apps/web/dashboard/recipe/[id]/, apps/mobile/app/recipe/ | 01 | |
| Recipe detail (edit mode) | LIVE | same as above | 03 | |
| Recipe versioning | LIVE | packages/db, apps/mobile, apps/web | 06 | parent_recipe_id, version_number |
| Save a Copy | LIVE | apps/mobile/app/recipe/, apps/web | 13 | Creates fully independent clone |
| Recipe visibility (private/shared_link/public) | LIVE | packages/db, RLS policies | 32 | 4-level model baked into RLS |
| Recipe privacy toggle | LIVE | apps/web/dashboard/recipe/[id]/, apps/mobile | 35 | |
| Recipe moderation (AI) | LIVE | packages/ai/moderateRecipe.ts | 41 | Runs on every import + edit |
| Frozen account banner | LIVE | apps/web/dashboard/layout.tsx, apps/mobile/_layout.tsx | 41 | |
| Recipe tags (add/remove/AI suggest) | LIVE | apps/mobile/app/recipe/, apps/web | 04 | |
| Cuisine field on recipe | LIVE | apps/web, apps/mobile | 01 | Currently free text |
| Recipe translation (5 languages) | LIVE | packages/ai/translateRecipe.ts, recipe_translations table | 12 | Cached per recipe+language |
| Recipe likes + like count | LIVE | packages/db, recipe_likes table, trigger | 30 | Optimistic UI |
| Recipe comments (threaded) | LIVE | packages/db, recipe_comments table | 30, 77 | 1-level threading, inline reply |
| Comment moderation (AI) | LIVE | packages/ai/moderateComment.ts | 30 | 3 verdicts |
| Comment flagging | LIVE | comment_flags table | 30 | 3+ flags auto-escalate |
| Attribution (original_submitter locked) | LIVE | packages/db, recipe detail | 31 | Never changes |
| Attribution (shared_by removable) | LIVE | packages/db | 31 | User-removable |
| Attribution pill on recipe detail | LIVE | apps/web/dashboard/recipe/[id]/, apps/mobile | 66 | Shows user/cookbook/URL |
| Add to My Recipes (save/clone public recipe) | LIVE | packages/db/cloneRecipe() | 32 | Sticky Save bar on non-owned recipes |
| Share link generation | LIVE | chefsbk.app/recipe/[id]?ref=[username] | 32 | |
| Guest access (view-only) | LIVE | apps/web/app/recipe/[id]/, guest_sessions table | 32 | Email capture |
| PDF export (Pro plan) | LIVE | apps/web/app/recipe/[id]/pdf/, @react-pdf/renderer | 33,49 | Plan gated |
| Print recipe | LIVE | apps/web | 35 | @media print CSS |
| Recipe saves count | LIVE | recipe_saves table, trigger | session 3 | |

---

## IMPORT & SCAN
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| URL import (JSON-LD first) | LIVE | packages/ai/importFromUrl.ts | 02 | 25k char limit |
| Instagram import | LIVE | packages/ai, apps/mobile/app/scan | 07 | Must route via isInstagramUrl() check |
| Multi-page photo scan | LIVE | apps/mobile/app/scan | 06 | Up to 5 pages |
| Dish identification from photo | LIVE | packages/ai, apps/mobile/app/scan | 21 | classifies → clarifying Qs → recipe |
| Speak a Recipe | LIVE | apps/web/dashboard/speak/, apps/mobile | 06 | Web Speech API |
| File import (PDF/Word/CSV/JSON) | LIVE | apps/web/dashboard/scan/ | 35 | pdf-parse, mammoth, papaparse |
| YouTube import | LIVE | packages/ai | 35 | Data API + transcript + timestamps |
| Cookbook intelligence (ISBN/barcode) | LIVE | packages/ai | 35 | Google Books + OpenLibrary |
| Chrome extension import | LIVE | apps/extension/ | 71 | MV3, plain JS |
| Pexels photo picker | LIVE | packages/ai/searchPexels.ts, PexelsPickerSheet | 11 | 3 images shown |
| PostImportImageSheet | LIVE | apps/mobile/components/PostImportImageSheet | 19 | Shown after all imports |
| aiChef completion (missing sections) | LIVE | packages/ai/generateAiChefSuggestion.ts | session 2 | |

---

## SEARCH & DISCOVERY
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Search page — My Recipes / All Recipes toggle | LIVE | apps/web/dashboard/search/, apps/mobile/(tabs)/search.tsx | 88 | Default = All Recipes |
| Search RPC (ILIKE across title/description/cuisine/ingredients/tags) | LIVE | search_recipes RPC | 35 | |
| Category drill-down filters | LIVE | apps/web/dashboard/search/, apps/mobile | 35 | |
| Public recipe visibility fix (shared_link included) | LIVE | search_recipes RPC, get_public_feed RPC | 92 | visibility IN ('public','shared_link') |
| Discover (redirects to search) | LIVE | apps/web/dashboard/discover/ | 38 | redirect to /search |
| Auto-tag my recipes button | LIVE | apps/web/dashboard/search/ | 35 | Retroactive tagging |
| Technique search | LIVE | apps/web/dashboard/search/ | 35 | |

---

## SHOPPING LIST
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Shopping list CRUD | LIVE | packages/db, apps/web/dashboard/shop/, apps/mobile/(tabs)/shop.tsx | 03 | |
| Store-first list creation | LIVE | StorePickerDialog (web), StorePicker (mobile) | 48 | |
| Store grouping with logos | LIVE | StoreAvatar component | 63 | logo.dev API |
| Department grouping (13 depts) | LIVE | packages/db/addItemsWithPipeline.ts | 03 | |
| 3 view modes (Dept/Recipe/A-Z) | LIVE | apps/web/dashboard/shop/, apps/mobile | 03 | |
| Font size toggle | LIVE | apps/mobile/(tabs)/shop.tsx | session 5 | 3 sizes, SecureStore persisted |
| Consolidated "All [Store]" view | LIVE | apps/web/dashboard/shop/, apps/mobile | 73 | Multi-list stores only |
| Offline shopping cache | LIVE | apps/mobile/lib/shoppingCache.ts | 68 | FileSystem cache, sync on reconnect |
| Add to shopping from recipe | LIVE | apps/web, apps/mobile | 03 | AI purchase unit suggestions |
| Add week/day to shopping from meal plan | LIVE | apps/web/dashboard/plan/, apps/mobile | 04 | |
| Print shopping list | LIVE | apps/web | 35 | @media print CSS |
| Realtime sync (Supabase Realtime) | LIVE | apps/mobile/store/shoppingStore.ts | session 2 | WebSocket via wss://api.chefsbk.app |

---

## MEAL PLAN
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Meal plan calendar (7 days) | LIVE | apps/web/dashboard/plan/, apps/mobile/(tabs)/plan.tsx | 04 | |
| Add recipe to meal plan (MealPlanPicker) | LIVE | MealPlanPicker component | 44 | Chef+ plan gate |
| Daypart pill (Breakfast/Lunch/Dinner/Snack) | LIVE | apps/web, apps/mobile | 64 | Tappable, opens ChefsDialog |
| Servings pill (stepper) | LIVE | apps/web, apps/mobile | 64 | Tappable, opens ChefsDialog |
| Portions mismatch warning | LIVE | apps/web, apps/mobile | 46 | Triggers when >2x serving difference |
| AI Meal Plan Wizard | LIVE | MealPlanWizard component | 07 | 4-step modal |
| Remove recipe from meal plan | LIVE | apps/web, apps/mobile | session 3 | |

---

## NOTIFICATIONS & SOCIAL
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Notification bell + panel (web) | LIVE | NotificationBell component, notifications table | 77 | 5 tabs, mark-all-read |
| Notification types: comment_reply, recipe_comment, recipe_like, new_follower, moderation | LIVE | packages/db/notifications.ts | 77 | |
| Follow / unfollow | LIVE | user_follows table, FollowButton component | 29 | Chef+ plan gate |
| Followers / Following tabs on profile | LIVE | apps/web, apps/mobile | 29 | |
| What's New feed (followed users' recipes) | LIVE | WhatsNewFeed component | 29 | |
| Social share (Instagram/Pinterest/Facebook) | LIVE | SocialShareModal, packages/ai/generateSocialPost.ts | 35 | Pro plan gate |

---

## FEEDBACK & SUPPORT
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| "Got an Idea?" feedback card | LIVE | FeedbackCard component | 69 | Pinned position 1 in recipe grid + FlashList header |
| Feedback stored in help_requests table | LIVE | packages/db, /api/feedback | 69 | |

---

## SETTINGS & PREFERENCES
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Language selector (5 languages only: en/fr/es/it/de) | LIVE | LanguagePickerModal, apps/web settings | 08 | ONLY 5 languages — never add more |
| Metric/imperial toggle | LIVE | preferencesStore, apps/web sidebar | session 3 | useTheme().colors, unitConversion.ts |
| Profile edit (name, bio) | LIVE | apps/web/dashboard/settings, apps/mobile settings | 29 | |
| Privacy toggle (is_searchable) | LIVE | apps/web, apps/mobile | 29 | |
| Avatar upload | LIVE | apps/web/dashboard/settings | 35 | |
| Plan display + upgrade CTA | LIVE | apps/web/dashboard/plans/, apps/mobile | 27 | |

---

## ADMIN
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Admin dashboard at /admin | LIVE | apps/web/app/admin/ | 28 | Client component auth check |
| Admin link in sidebar (admins only, red) | LIVE | apps/web/components/Sidebar | 87,88 | |
| User management (search, sort, role pills) | LIVE | apps/web/app/admin/users/ | 28,88 | |
| Username edit by admin | LIVE | apps/web/app/admin/users/ | 88 | Admin-only override |
| Recipe moderation queue | LIVE | apps/web/app/admin/recipes/ | 28 | |
| Promo code CRUD | LIVE | apps/web/app/admin/promos/ | 28,88 | |
| Plan limits display | LIVE | apps/web/app/admin/limits/ | 28 | |
| Help requests / feedback | LIVE | apps/web/app/admin/help/ | 28 | |
| Suspend / restore user | LIVE | apps/web/app/admin/ | 28 | |
| Proctor role | LIVE | admin_users table | 28 | |

---

## CONTENT TYPES
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Techniques (separate from recipes) | LIVE | apps/web/dashboard/techniques/ | 35 | AI classification, detail page |
| Cookbooks with recipe cards | LIVE | apps/web/dashboard/cookbooks/ | 35 | ISBN lookup, cover photo |

---

## UI SYSTEM
| Feature | Status | Owner Files | Session | Notes |
|---------|--------|-------------|---------|-------|
| Trattoria theme (cream/red/green) | LIVE | packages/ui, NativeWind config | 01 | NEVER hardcode hex |
| ChefsDialog (unified modal) | LIVE | apps/web/components/ChefsDialog, apps/mobile/components/ChefsDialog | 47 | Replaces all native confirm/alert |
| Image proxy /api/image | LIVE | apps/web/app/api/image/ | 24 | Proxies Supabase storage URLs |
| Chef's hat fallback | LIVE | RecipeImage component | 11 | Shows when no recipe image |
| StoreAvatar (logo.dev) | LIVE | StoreAvatar component | 03 | Initials fallback with hash color |
| i18n (web + mobile, 5 locales) | LIVE | apps/web/locales/, apps/mobile/locales/ | 08,53 | |

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
```

---

## STEP 2 — Update wrapup.md to require registry update

Edit .claude/agents/wrapup.md. Add this as the FIRST step before committing:

```
## MANDATORY — Update Feature Registry

Before committing anything:
1. Open .claude/agents/feature-registry.md
2. For every feature you touched this session: update its Status
3. For every new feature: add a row in the correct section
4. For every regression introduced: mark BROKEN (never hide this)
5. Save the file — it must be committed as part of this session
```

---

## STEP 3 — Update CLAUDE.md agent lookup table

Add feature-registry.md to the agent lookup table in CLAUDE.md:

```
| Before modifying ANY existing feature | feature-registry.md (ALWAYS) |
```

And add to SESSION START INSTRUCTIONS as step 3a:
```
3a. Read .claude/agents/feature-registry.md — check status of any feature
    your session will touch before writing a single line of code
```

---

## COMPLETION CHECKLIST

- [ ] .claude/agents/feature-registry.md created with all sections populated
- [ ] Every known feature from DONE.md has a row with correct status
- [ ] wrapup.md updated with mandatory registry update step
- [ ] CLAUDE.md agent table updated with feature-registry.md entry
- [ ] Committed: git add .claude/agents/feature-registry.md && git commit
- [ ] Run /wrapup
