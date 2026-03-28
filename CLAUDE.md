# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Multi-tenant SaaS recipe app. Turborepo monorepo with two apps and three shared packages.

| Workspace | Stack | Purpose |
|-----------|-------|---------|
| `apps/mobile` | Expo SDK 54, React Native 0.81, Expo Router v6, Zustand v5 | iOS/Android app |
| `apps/web` | Next.js 15, React 19, Tailwind CSS 3 | Web app |
| `packages/db` | Supabase client, queries, types | All database access |
| `packages/ai` | Claude Sonnet API wrapper | Recipe scanning, URL import, suggestions |
| `packages/ui` | Pure utility functions | Formatting (duration, fractions, servings), groupBy |

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
```

## Critical patterns

1. ALWAYS import supabase from `@chefsbook/db` — never call createClient() directly
2. ALWAYS import AI functions from `@chefsbook/ai` — never call the Claude API directly in app code
3. ALWAYS use `useTheme().colors` in mobile — never hardcode hex values
4. ALWAYS use `cb-*` Tailwind tokens in web (e.g. `bg-cb-primary`) — never hardcode hex
5. ALWAYS follow the Zustand store pattern in `apps/mobile/lib/zustand/authStore.ts`
6. NEVER commit `.env.local` — all keys stay out of git

## Architecture

### Database schema (supabase/migrations/)

16+ tables with RLS policies. Key tables:
- `user_profiles` (auto-created via trigger on auth.users signup)
- `recipes`, `recipe_ingredients`, `recipe_steps` — core recipe data
- `cookbooks` — recipe collections
- `meal_plans`, `menu_templates` — meal planning
- `shopping_lists`, `shopping_list_items` — grouped by aisle
- `cooking_notes` — journal entries per cook
- `category_groups`, `categories`, `recipe_categories` — hierarchical taxonomy (8 groups, 371 categories)
- `import_jobs`, `import_job_urls` — bookmark batch import tracking
- `follows` — follower/followed with pending/accepted status

5 custom Postgres functions: `search_recipes()` (pg_trgm fuzzy), `get_meal_plan_week()`, `generate_shopping_list()`, `clone_recipe()`, `get_public_feed()`.

Storage buckets: `recipe-images` (5MB, public read) and `avatars` (2MB, public read).

### Shared packages

**@chefsbook/db** — Supabase client is a lazy-init Proxy singleton (`packages/db/src/client.ts`). Query modules organized by domain: `recipes.ts`, `cookbooks.ts`, `mealPlans.ts`, `shopping.ts`, `cookingNotes.ts`, `menuTemplates.ts`, `imports.ts`, `categories.ts`. Types define `PlanTier` (free/pro/family), `SourceType`, `Course`, `MealSlot`, `VisibilityLevel`.

**@chefsbook/ai** — `callClaude()` hits the Anthropic API with claude-sonnet. Key exports: `scanRecipe(imageBase64)`, `importFromUrl(url)`, `suggestRecipes(ingredients[])`, `mergeShoppingList()`, `matchFolderToCategory()`. Uses `extractJSON()` to parse structured data from LLM output.

**@chefsbook/ui** — Pure formatters: `formatDuration()`, `formatQuantity()` (Unicode fractions like "1 3/4"), `scaleQuantity()`, `formatServings()`, `getInitials()`, `truncate()`, `groupBy()`.

### Subscription tiers (packages/db/src/subscriptions.ts)

| | Free | Pro ($4.99/mo) | Family ($8.99/mo) |
|---|---|---|---|
| Recipes | 50 | Unlimited | Unlimited |
| Scans | 5/month | Unlimited | Unlimited |
| Shopping lists | 1 | 10 | 10 |
| Sharing | Link only | Publish + followers | + 6 family members |

### Mobile state management

Zustand v5 stores in `apps/mobile/lib/zustand/`: authStore, recipeStore, mealPlanStore, shoppingStore, cookbookStore, cookingNotesStore, importStore, pinStore. Auth store initializes Supabase session and listens for auth state changes.

### Web architecture

Next.js App Router. Dashboard routes nested under `app/dashboard/layout.tsx` (sidebar nav). API routes at `app/api/import/url` (URL fetching) and `app/api/webhooks/stripe` (subscription events). Server-side data fetching — no client state library.

### Theming

Both apps share the "Trattoria" palette: red accent `#ce2b37`, green `#009246`, cream background `#faf7f0`. Mobile uses React Context (`useTheme().colors`). Web uses Tailwind `cb-*` tokens. Inter font on web.

## Last 3 sessions

- **2026-03-28** — Rewrote CLAUDE.md with full architecture docs; renamed master→main, pushed to GitHub
- **2026-03-27** — Backend functions, categories taxonomy, import pipeline, docs
- **2026-03-27** — Initial scaffold, web postcss fix, createRecipe fix

## Known issues

- [ ] EAS free-tier build quota exhausted — resets 2026-04-01
- [ ] No test suite (unit or integration)
- [ ] No README.md
- [ ] stale dark mode refs in mobile theme context (single light palette only)

## Decisions log

- Self-hosted Supabase on RPi5 — NOT supabase.com cloud
- All Supabase access via Tailscale only (not public internet)
- Single light "Trattoria" theme — no dark mode
- Supabase client as lazy Proxy singleton — no createClient() in app code
- Claude Sonnet for all AI features via @chefsbook/ai wrapper

## Conventions

- Commit style: `type(scope): message` (e.g. `fix(web):`, `feat:`)
- Package imports: `@chefsbook/db`, `@chefsbook/ai`, `@chefsbook/ui` — never bypass
- Mobile styling: `useTheme().colors` — never hardcode hex
- Web styling: `cb-*` Tailwind tokens — never hardcode hex
- Zustand stores follow pattern in `authStore.ts`
