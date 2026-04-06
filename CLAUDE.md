# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Multi-tenant SaaS recipe app. Turborepo monorepo with two apps and three shared packages.

| Workspace | Stack | Purpose |
|-----------|-------|---------|
| `apps/mobile` | Expo SDK 54, React Native 0.81, Expo Router v6, NativeWind v4, Zustand v5 | iOS/Android app |
| `apps/web` | Next.js 15, React 19, Tailwind CSS 3 | Web app |
| `packages/db` | Supabase client, queries, types | All database access |
| `packages/ai` | Claude Sonnet API wrapper | Recipe scanning, URL import, suggestions |
| `packages/ui` | Pure utility functions | Formatting (duration, fractions, servings), groupBy |
| `apps/extension` | Chrome/Edge browser extension (MV3, plain JS, no build) | One-click recipe import from any page |

See `apps/mobile/agents/CLAUDE.md` and `apps/web/CLAUDE.md` for app-specific instructions.

## Build & dev commands

```bash
# Full monorepo
turbo dev                                    # all apps
npm run mobile                               # mobile only (turbo dev --filter=@chefsbook/mobile)
npm run web                                   # web only (turbo dev --filter=@chefsbook/web)
turbo build                                  # build all

# Individual apps
cd apps/mobile && npx expo start --dev-client
cd apps/web && npm run dev

# Type checking (no test suite yet)
cd apps/mobile && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
cd apps/web && npm run lint                  # next lint (only web has lint)

# EAS builds (local builder on dev PC — cloud quota limited)
cd apps/mobile && eas build --platform android --profile development --local
cd apps/mobile && eas build --platform ios --profile development --local
```

## Infrastructure

- **Supabase**: Self-hosted on rpi5-eth (Raspberry Pi 5) at http://100.110.47.62:8000
- **Supabase Studio**: http://100.110.47.62:8000 (login: supabase)
- **Postgres**: port 5432 on 100.110.47.62 (internal only)
- **Network**: Tailscale mesh — accessible from any device on the tailnet
- **Storage**: 54GB USB drive mounted at /mnt/chefsbook on rpi5-eth
- **NOT using**: supabase.com cloud — everything is self-hosted

## Environment variables (in .env.local at monorepo root)

```
EXPO_PUBLIC_SUPABASE_URL=http://100.110.47.62:8000
NEXT_PUBLIC_SUPABASE_URL=http://100.110.47.62:8000
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>    # server-side only
EXPO_PUBLIC_ANTHROPIC_API_KEY=<key>             # mobile + web AI calls
ANTHROPIC_API_KEY=<key>                         # server-side fallback
STRIPE_SECRET_KEY=<key>                         # Stripe (web only, not yet configured)
STRIPE_WEBHOOK_SECRET=<key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<key>
STRIPE_PRO_MONTHLY_PRICE_ID=<price id>
STRIPE_PRO_YEARLY_PRICE_ID=<price id>
STRIPE_FAMILY_MONTHLY_PRICE_ID=<price id>
STRIPE_FAMILY_YEARLY_PRICE_ID=<price id>
YOUTUBE_API_KEY=<key>                       # YouTube Data API v3 (optional — falls back to oembed)
SCRAPINGBEE_API_KEY=<key>                   # ScrapingBee (optional — fallback for 403 sites)
CHROME_PATH=<path>                          # Chrome executable (optional — auto-detected on Windows/Mac/Linux)
GOOGLE_BOOKS_API_KEY=<key>                  # Google Books API (optional — works without key at lower rate limit)
UNSPLASH_ACCESS_KEY=<key>                   # Unsplash API (optional — falls back to source URL without key)
```

## Critical patterns

1. ALWAYS import supabase from `@chefsbook/db` — never call createClient() directly
2. ALWAYS import AI functions from `@chefsbook/ai` — never call the Claude API directly in app code
3. ALWAYS use `useTheme().colors` in mobile — never hardcode hex values
4. ALWAYS use `cb-*` Tailwind tokens in web (e.g. `bg-cb-primary`) — never hardcode hex
5. ALWAYS follow the Zustand store pattern in `apps/mobile/lib/zustand/authStore.ts`
6. NEVER commit `.env.local` — all keys stay out of git
7. Commit style: `type(scope): message` (e.g. `fix(web):`, `feat:`)

### Path aliases

| Alias | Resolves to | Used in |
|-------|-------------|---------|
| `@chefsbook/db` | `packages/db/src` | Both apps |
| `@chefsbook/ai` | `packages/ai/src` | Both apps |
| `@chefsbook/ui` | `packages/ui/src` | Both apps |
| `@/*` | app root (`./`) | Web only |

### Monorepo wiring

- Mobile: `metro.config.js` watches the entire monorepo root for shared packages
- Web: `next.config.ts` uses `transpilePackages` for `@chefsbook/*`
- Root `package.json` uses npm workspaces (`apps/*`, `packages/*`)

## Architecture

### Database schema (supabase/migrations/)

18+ tables with RLS policies. Migrations in `supabase/migrations/` (11 files: core, functions, storage, features, categories, imports, youtube, techniques, shopping_overhaul, user_photos, cookbook_intelligence). Key tables:
- `user_profiles` (auto-created via trigger on auth.users signup)
- `recipes`, `recipe_ingredients`, `recipe_steps` — core recipe data
- `cookbooks` — recipe collections
- `meal_plans`, `menu_templates` — meal planning
- `shopping_lists`, `shopping_list_items` — grouped by aisle
- `cooking_notes` — journal entries per cook
- `category_groups`, `categories`, `recipe_categories` — hierarchical taxonomy (8 groups, 371 categories)
- `import_jobs`, `import_job_urls` — bookmark batch import tracking
- `techniques` — cooking methods/skills with JSONB process_steps, difficulty, tips, mistakes, tools
- `follows` — follower/followed with pending/accepted status

5 custom Postgres functions: `search_recipes()` (pg_trgm fuzzy), `get_meal_plan_week()`, `generate_shopping_list()`, `clone_recipe()`, `get_public_feed()`.

Storage buckets: `recipe-images` (5MB, public read) and `avatars` (2MB, public read).

### Shared packages

**@chefsbook/db** — Supabase client is a lazy-init Proxy singleton (`packages/db/src/client.ts`). Query modules organized by domain: `recipes.ts`, `cookbooks.ts`, `mealPlans.ts`, `shopping.ts`, `cookingNotes.ts`, `menuTemplates.ts`, `imports.ts`, `categories.ts`, `techniques.ts`. `subscriptions.ts` defines plan limits and gate-check functions. Types define `PlanTier`, `SourceType` (includes `'youtube'`), `Course`, `MealSlot`, `VisibilityLevel`, `Technique`, `Difficulty`.

**@chefsbook/ai** — `callClaude()` hits the Anthropic API (`claude-sonnet-4-20250514`), supports text + optional image input. Key exports: `scanRecipe(imageBase64)`, `importFromUrl(url)`, `importUrlFull(url)`, `classifyPage(html)`, `fetchPage(url)`, `suggestRecipes(ingredients[])`, `generateVariation(recipe, request)`, `mergeShoppingList()`, `matchFolderToCategory()`, `matchFoldersToCategories()`, `importFromYouTube()`, `classifyContent()` (recipe vs technique), `importTechnique()`, `importTechniqueFromYouTube()`, `extractJsonLdRecipe()`. Uses `extractJSON()` to parse structured data from LLM output.

**@chefsbook/ui** — Pure formatters: `formatDuration()`, `formatQuantity()` (Unicode fractions like "1 3/4"), `scaleQuantity()`, `formatServings()`, `getInitials()`, `truncate()`, `groupBy()`.

### Subscription tiers (packages/db/src/subscriptions.ts)

| | Free | Pro ($4.99/mo) | Family ($8.99/mo) |
|---|---|---|---|
| Recipes | 50 | Unlimited | Unlimited |
| Scans | 5/month | Unlimited | Unlimited |
| Shopping lists | 1 | 10 | 10 |
| Sharing | Link only | Publish + followers | + 6 family members |

### Mobile routing & state

Expo Router v6 with 5 bottom tabs: Recipes, Scan, Plan, Shop, Discover. Dynamic routes: `recipe/[id]`, `cookbook/[id]`, `chef/[id]`, `share/[token]`, `recipe/new`, `modal` (settings).

Zustand v5 stores in `apps/mobile/lib/zustand/`: authStore, recipeStore, mealPlanStore, shoppingStore, cookbookStore, cookingNotesStore, importStore, pinStore. Auth store initializes Supabase session and listens for auth state changes.

### Web architecture

Next.js App Router. Dashboard routes nested under `app/dashboard/layout.tsx` (sidebar nav with: Recipes, Scan, Techniques, Plan, Shop, Cookbooks, Discover). Server-side data fetching — no client state library. Stripe integration for subscriptions (not yet configured).

Key dashboard pages: `/dashboard` (recipes with grid/list/table views + sort), `/dashboard/scan` (image OCR + URL import + bookmark batch import), `/dashboard/techniques` (technique library + manual entry at `/new`), `/dashboard/plan` (weekly meal calendar + recipe picker), `/dashboard/shop` (shopping lists), `/dashboard/cookbooks` (physical cookbook shelf), `/dashboard/discover` (public recipe feed).

Shared components in `apps/web/components/`: `Sidebar.tsx` (collapsible nav), `MealPlanWizard.tsx`, `RecipeReviewPanel.tsx`, `SocialShareModal.tsx`. Shared fetch/HTML utilities in `apps/web/app/api/import/_utils.ts`.

### Import pipeline

All import paths (URL, batch, reimport, extension) follow the same extraction priority:
1. **JSON-LD first**: `extractJsonLdRecipe(rawHtml)` → `checkJsonLdCompleteness()` — if title + ingredients with quantities + steps all present, use directly and **skip Claude entirely**
2. **JSON-LD + Claude gap-fill**: If JSON-LD is partial, tell Claude what's available and what's missing, send JSON-LD data + 25k chars of page text
3. **Claude-only fallback**: No JSON-LD found → full Claude extraction with 25k char limit
4. **Content classification**: `classifyContent()` determines recipe vs technique before extraction on all paths

Fetch chain: standard fetch → puppeteer-core (system Chrome) → ScrapingBee API → descriptive error. Shared via `apps/web/app/api/import/_utils.ts`.

API routes (all POST unless noted):

| Route | Purpose |
|-------|---------|
| `/api/import/url` | Fetch URL, extract image, strip HTML for AI |
| `/api/import/batch` | Queue multiple URLs for background import |
| `/api/import/bookmarks` | Parse `bookmarks.html`, extract URLs by folder |
| `/api/import/reimport` | Re-fetch existing recipe URLs, update AI-derived fields |
| `/api/import/youtube` | YouTube video import: metadata + transcript + Claude extraction |
| `/api/import/file` | Universal file import (PDF, Word, CSV, JSON) |
| `/api/extension/import` | CORS-enabled Chrome extension endpoint; classifies recipe vs technique |
| `/api/cookbooks/lookup` | ISBN / title lookup for physical cookbooks |
| `/api/cookbooks/toc` | AI-generated table of contents from cookbook metadata |
| `/api/cookbooks/import-recipe` | Import a specific recipe from a cookbook's TOC |
| `/api/recipes/auto-tag` | AI category tagging for recipes |
| `/api/meal-plan/generate` | AI meal plan wizard |
| `/api/shopping/add-items` | Add recipe ingredients to a shopping list |
| `/api/social/generate` | Generate social sharing text/image |
| `/api/speak` | Voice recipe entry (speech-to-recipe) |
| `/api/speak/image` | Generate image for voice-entered recipe |
| `/api/webhooks/stripe` | Stripe subscription events, updates `plan_tier` |

### Theming

Both apps share the "Trattoria" palette: red accent `#ce2b37`, green `#009246`, cream background `#faf7f0`. Mobile uses React Context (`useTheme().colors`). Web uses Tailwind `cb-*` tokens. Inter font on web.

## QA Notepad (temp testing tool)
Triggered by tapping the ChefsBook logo in the header.
Remove QANotepad.tsx and the logo tap handler when done testing.

### Export QA report via adb (paste into Claude):
```bash
adb shell run-as com.chefsbook.app cat /data/data/com.chefsbook.app/files/qa_notepad.json
```

### Clear all QA items via adb:
```bash
adb shell run-as com.chefsbook.app sh -c 'echo "[]" > /data/data/com.chefsbook.app/files/qa_notepad.json'
```

### Read via Claude Code:
```bash
adb shell run-as com.chefsbook.app cat /data/data/com.chefsbook.app/files/qa_notepad.json | python -m json.tool
```

## Known issues

- No test suite (unit or integration)
- Stripe env vars not yet configured (subscriptions non-functional, 14-day trial blocked)
- Followers UI not built (DB schema exists)
- Family tier features not built (shared lists, shared plans, family cookbook, member invite)
- Extension hardcoded to localhost:3000 + Tailscale IP (not production-ready)
- Multilingual support not started
- Shared with Me system not started (recipe_shares table, accept/decline, notifications)
- Mobile sign-in flow verified on device (landing → sign in → recipes tab works; Google OAuth stub remains TODO)
- Google OAuth stubs in mobile auth screens (TODO: wire up signInWithOAuth)
- Emulator must be launched from CLI (`emulator -avd Medium_Phone_API_36.1 -no-snapshot -gpu host`) — Android Studio Device Manager launches headless/invisible window
- Metro hostname: set `REACT_NATIVE_PACKAGER_HOSTNAME=localhost` before `npx expo start` when on Tailscale (otherwise Metro advertises Tailscale IP, unreachable from emulator)

See `AGENDA.md` for the full prioritized backlog with effort estimates and recommended build order.

## Decisions log

Decisions not already covered in Architecture/Infrastructure sections above:

- All AI calls run server-side (Anthropic API blocks browser CORS)
- Chrome extension sends page HTML from browser to bypass Cloudflare bot protection
- Re-import preserves user edits (title, tags, notes, custom images) — only updates AI-derived fields
- Techniques as separate table (not a content_type on recipes) — fundamentally different fields
- `_unresolved` tag marks recipes where title was auto-generated from URL slug
- Development agenda tracked in `AGENDA.md` at project root
- React pinned to 19.1.0 across monorepo (19.1.4 causes frozen object crash with RN 0.81)
- Metro blockList excludes root node_modules react/react-native to prevent duplicate bundles
- Mobile auth: no anonymous sessions — unauthenticated users see landing screen
- Android emulator needs `adb reverse tcp:8081 tcp:8081` + `adb reverse tcp:8000 tcp:8000` for Metro + Supabase
- Shopping pipeline shared: `addItemsWithPipeline()` in `@chefsbook/db` is the single source of truth — both web API and mobile call it directly
- Mobile calls `suggestPurchaseUnits` from `@chefsbook/ai` directly (no CORS in React Native)
- Native modules that may not be linked (e.g. `@react-native-voice/voice`) use lazy `require()` in try/catch
- Mobile tag management calls `callClaude` + `extractJSON` from `@chefsbook/ai` directly (no CORS in React Native) for auto-tag suggestions
- Shopping list font size preference persisted via `expo-secure-store` (key: `shopping_font_size`, values: `small`/`medium`/`large`)
- Mobile theme has `textPrimary`, `textSecondary`, and `textMuted` (via TRATTORIA_COLORS spread from `@chefsbook/ui`)

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
