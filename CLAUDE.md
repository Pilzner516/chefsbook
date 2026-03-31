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

18+ tables with RLS policies. Migrations in `supabase/migrations/` (8 files: core, functions, storage, features, categories, imports, youtube, techniques). Key tables:
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

### Import pipeline

All import paths (URL, batch, reimport, extension) follow the same extraction priority:
1. **JSON-LD first**: `extractJsonLdRecipe(rawHtml)` → `checkJsonLdCompleteness()` — if title + ingredients with quantities + steps all present, use directly and **skip Claude entirely**
2. **JSON-LD + Claude gap-fill**: If JSON-LD is partial, tell Claude what's available and what's missing, send JSON-LD data + 25k chars of page text
3. **Claude-only fallback**: No JSON-LD found → full Claude extraction with 25k char limit
4. **Content classification**: `classifyContent()` determines recipe vs technique before extraction on all paths

Fetch chain: standard fetch → puppeteer-core (system Chrome) → ScrapingBee API → descriptive error. Shared via `apps/web/app/api/import/_utils.ts`.

API routes:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/import/url` | POST | Fetch URL, extract image, strip HTML for AI |
| `/api/import/batch` | POST | Queue multiple URLs for background import processing |
| `/api/import/bookmarks` | POST | Parse `bookmarks.html`, extract URLs by folder, create import job |
| `/api/import/reimport` | POST | Re-fetch existing recipe URLs, update AI-derived fields |
| `/api/import/youtube` | POST | YouTube video import: metadata, transcript, Claude extraction with timestamps |
| `/api/extension/import` | POST | CORS-enabled Chrome extension endpoint; classifies recipe vs technique |
| `/api/webhooks/stripe` | POST | Stripe subscription events, updates `plan_tier` |
| `/api/extension/download` | GET | (planned) Zip extension with patched production URLs |

### Theming

Both apps share the "Trattoria" palette: red accent `#ce2b37`, green `#009246`, cream background `#faf7f0`. Mobile uses React Context (`useTheme().colors`). Web uses Tailwind `cb-*` tokens. Inter font on web.

## Last 3 sessions

- **2026-03-30** — Massive session: shopping list overhaul (13 departments, AI purchase units, realtime, duplicate aggregation, column layout), meal planner redesign (two-row calendar, smart picker, notes, AI wizard), sidebar refactor (shared component, collapsible, fixed height, recipe pages), search page (ILIKE RPC, category drill-down, auto-tag), voice recipe entry (/speak), cookbook intelligence (ISBN lookup, AI TOC, import review panel), social sharing, user photos, privacy toggle, universal file import (PDF/Word/CSV/JSON), print, settings page, plan switching
- **2026-03-29** — bookmark tree UI, YouTube import, technique content type, inline recipe editing, view modes, favourites, cooking notes, discover page, JSON-LD-first pipeline, import failure fixes
- **2026-03-28** — Auth page, Chrome extension, server-side import pipeline, recipe CRUD, DB fixes

## Known issues

- [x] ~~No README.md~~ — added 2026-03-29
- [x] ~~Stale dark mode refs in mobile theme context~~ — fixed 2026-03-29
- [x] ~~No duplicate detection on recipe import~~ — added 2026-03-29 (bookmark + single URL)
- [x] ~~Cloudflare 403 sites~~ — Puppeteer + ScrapingBee fallback chain added 2026-03-29
- [ ] No test suite (unit or integration)
- [ ] Stripe env vars not yet configured (subscriptions non-functional, 14-day trial blocked)
- [ ] Followers UI not built (DB schema exists)
- [ ] Family tier features not built (shared lists, shared plans, family cookbook, member invite)
- [ ] Extension hardcoded to localhost:3000 + Tailscale IP (not production-ready)
- [x] ~~Ingredient quantities after re-import~~ — fixed handleRefresh to call replaceIngredients/replaceSteps
- [x] ~~Shopping list from meal plan~~ — "Add week to list" + per-day cart button
- [x] ~~Shopping list UX~~ — 3 views, pin, manual add, AI purchase units, departments, duplicate aggregation, realtime
- [ ] Multilingual support (user language preference, import translation, original content preservation)
- [ ] Shared with Me system (recipe_shares table, accept/decline, notifications)
- [ ] Extension install flow + production URL fix

## Decisions log

- Self-hosted Supabase on RPi5 — NOT supabase.com cloud
- All Supabase access via Tailscale only (not public internet)
- Single light "Trattoria" theme — no dark mode
- Supabase client as lazy Proxy singleton — no createClient() in app code
- Claude Sonnet for all AI features via @chefsbook/ai wrapper
- Local EAS builds on dev PC (cloud quota limited)
- All AI calls run server-side (Anthropic API blocks browser CORS) — API routes at /api/import/url, /api/import/batch, /api/extension/import
- Chrome extension sends page HTML from browser to bypass Cloudflare bot protection
- Re-import preserves user edits (title, tags, notes, custom images) — only updates AI-derived fields
- "bread" added to Course enum (DB constraint + TypeScript type + AI prompts)
- YouTube import as separate pipeline — Data API + transcript + Claude extraction with timestamp-linked steps
- Techniques as separate table (not a content_type on recipes) — fundamentally different fields
- Content classification (recipe vs technique) runs before extraction on all import paths
- Plan tier gating via `checkRecipeLimit()` / `checkShoppingListLimit()` in `@chefsbook/db/subscriptions`
- Fetch fallback chain: standard fetch → puppeteer-core (system Chrome) → ScrapingBee → error
- JSON-LD structured data used as primary extraction source when available, Claude fills gaps
- `_unresolved` tag marks recipes where title was auto-generated from URL slug
- Development agenda tracked in AGENDA.md at project root
