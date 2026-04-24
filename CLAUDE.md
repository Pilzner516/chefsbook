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

## AGENT SYSTEM — READ BEFORE EVERY SESSION

Specialist agent files live in `.claude/agents/`. Every session MUST read the relevant
agents before writing any code.

| If your session touches... | Read this agent |
|---------------------------|----------------|
| Any screen, modal, or component | ui-guardian.md (ALWAYS) |
| Any import path (URL, scan, Instagram, speak, file) | import-pipeline.md |
| Any session touching import pipeline / site testing | import-quality.md (ALWAYS) |
| Any image upload, display, or storage | image-system.md |
| Any Zustand store, data fetch, or cache | data-flow.md |
| ANY feature on ANY session | testing.md (ALWAYS) |
| Any change to apps/web | deployment.md (ALWAYS for web sessions) |
| Any feature that calls Claude API or @chefsbook/ai | ai-cost.md (MANDATORY) |
| Before modifying ANY existing feature | feature-registry.md (ALWAYS) |

`testing.md`, `deployment.md`, and `feature-registry.md` are MANDATORY on every session.
Multiple agents may apply to a single session. Read all that apply.

### How to invoke an agent
At the start of your session prompt, the user will specify which agents to read.
If not specified, you must determine which apply based on the checklist above and
read them yourself before starting.

### The agents contain:
- Mandatory rules (violations = bugs)
- Pre-flight checklist (run before writing any code)
- Post-flight checklist (run before /wrapup)
- Known failure patterns specific to this codebase (do not repeat these)

## SESSION START INSTRUCTIONS

Every Claude Code session MUST begin with these steps in order:

1. Read .claude/agents/wrapup.md NOW so you understand what will be required at the end of this session
2. Read CLAUDE.md (this file) fully
3. Read DONE.md to understand what was last built
4. Read .claude/agents/testing.md — MANDATORY EVERY SESSION
5. Read .claude/agents/feature-registry.md — check status of any feature your session will touch before writing a single line of code
6. If session touches web: read .claude/agents/deployment.md — MANDATORY
7. If session touches any AI feature or @chefsbook/ai: read .claude/agents/ai-cost.md
8. Read all other applicable agents based on the lookup table above
9. Run ALL pre-flight checklists from every agent loaded
10. For any table you will query: run `\d tablename` on RPi5 to verify columns
11. Only then begin writing code

Do not skip any step. Agents exist because the same bugs have been introduced
and fixed 3-5 times each. Reading the agents prevents repeating known mistakes.

## Build & dev commands

Workspace package names: `@chefsbook/mobile`, `@chefsbook/web`, `@chefsbook/db`, `@chefsbook/ai`, `@chefsbook/ui`

```bash
# Full monorepo
turbo dev                                    # all apps
npm run mobile                               # mobile only (turbo dev --filter=@chefsbook/mobile)
npm run web                                  # web only (turbo dev --filter=@chefsbook/web)
turbo build                                  # build all

# Individual apps
cd apps/mobile && npx expo start --dev-client
cd apps/web && npm run dev

# Type checking (no test suite yet)
cd apps/mobile && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
# NOTE: npm run lint fails on web — no .eslintrc.json configured (interactive wizard not run)

# EAS builds (local builder on dev PC — cloud quota limited)
cd apps/mobile && eas build --platform android --profile development --local
cd apps/mobile && eas build --platform ios --profile development --local
```

### DB migrations (apply on RPi5)

```bash
# Apply a migration file
ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres -f /mnt/chefsbook/repo/supabase/migrations/<file>.sql"

# After any new table: restart PostgREST schema cache (or queries return "not found in schema cache")
ssh rasp@rpi5-eth "docker restart supabase-rest"

# Inspect a table schema before writing queries
ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres -c '\d tablename'"
```

## Infrastructure

- **Supabase**: Self-hosted on rpi5-eth (Raspberry Pi 5) at http://100.110.47.62:8000
- **Supabase Studio**: http://100.110.47.62:8000 (login: supabase)
- **Postgres**: port 5432 on 100.110.47.62 (internal only)
- **Network**: Tailscale mesh — accessible from any device on the tailnet
- **Storage**: 54GB USB drive mounted at /mnt/chefsbook on rpi5-eth
- **Email**: SMTP via Resend (smtp.resend.com, noreply@chefsbk.app). GOTRUE_MAILER_AUTOCONFIRM=true (signup auto-confirm stays on). Password recovery emails working. Welcome emails sent via Resend API on admin account creation (requires RESEND_API_KEY).
- **Admin accounts**: pilzner (a@aol.com) + seblux (seblux100@gmail.com) — both super_admin in admin_users table
- **NOT using**: supabase.com cloud — everything is self-hosted
- **Migrations**: SQL files in `supabase/migrations/` — apply manually via `psql` on rpi5-eth (no Supabase CLI migration runner; self-hosted)

## Public URLs

- Web app: https://chefsbk.app (Cloudflare Tunnel → RPi5 port 3000)
- API: https://api.chefsbk.app (Cloudflare Tunnel → RPi5 port 8000)
- Tunnel name: chefsbook (ID: 45f6f96f-6507-488a-80fa-e552ab0ce085)
- PM2 process: chefsbook-web
- Web repo on Pi: /mnt/chefsbook/repo
- Restart web: `pm2 restart chefsbook-web`
- Restart tunnel: `sudo systemctl restart cloudflared`
- Tunnel logs: `journalctl -u cloudflared -n 50`
- Web logs: `pm2 logs chefsbook-web`

## Quick Reference: Top Gotchas

These mistakes recur across sessions — check before writing any code:

1. **Web Supabase URL = `https://api.chefsbk.app`** (NOT `http://100.110.47.62:8000`) — mixed content blocks WebSocket on HTTPS pages. Mobile still uses the direct IP.
2. **Server-to-server fetches = `http://localhost:3000`** (NOT the `req.url` origin) — tunnel URL returns HTML error pages instead of JSON on timeout.
3. **Delete stale APK JS bundle before rebuilding**: `rm -f android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle`
4. **After `expo prebuild --clean`**: re-add `android.enableJetifier=true` to `gradle.properties` + re-apply signing config to `build.gradle` (both get wiped).
5. **New table migration**: always `docker restart supabase-rest` on RPi5 after applying, or PostgREST returns "table not found in schema cache".
6. **Recipe images**: primary images live in `recipe_user_photos` table, NOT `recipes.image_url`. Any component rendering recipe cards MUST use `getPrimaryPhotos()` + `getRecipeImageUrl(primaryPhoto, fallbackUrl)`. Never render `recipe.image_url` directly — most recipes will show placeholder. This applies to every new page, component, or search result that displays recipe cards.

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
REPLICATE_API_TOKEN=<key>                   # Replicate Flux Dev (AI image generation — ~$0.025/image)
PEXELS_API_KEY=<key>                        # Pexels API (recipe image search picker; EXPO_PUBLIC_ prefix for mobile)
UNSPLASH_ACCESS_KEY=<key>                   # Unsplash API (optional — falls back to source URL without key)
RESEND_API_KEY=<key>                        # Resend email API (welcome emails; optional — gracefully skips if not set)
```

## Moderation Permission Model
- Users: report only (flag) — no content changes, no visibility changes, no suspensions
- AI: flag + auto-act on serious ONLY when AI Auto-Moderation toggle is ON (system_settings table)
- AI mild: always flag-only, never auto-act regardless of toggle
- Proctors: hide, warn, resolve flags
- Admins: all actions including permanent removal, toggle AI moderation
- Super Admins: all actions + system settings

NEVER auto-change content visibility on user flag.
ONLY admins/proctors/AI(serious+toggle ON) can change content state.

## Non-Negotiable UI Rules

ANDROID SAFE AREA — MANDATORY ON EVERY SCREEN
Every bottom-positioned UI element (buttons, inputs, FABs, modal footers, wizard
navigation, bottom sheets, pin pickers, action sheets) MUST use useSafeAreaInsets()
from react-native-safe-area-context. Never use hardcoded bottom margins or padding.
Apply: paddingBottom: insets.bottom + 16 to all scroll containers and modal footers.
This rule applies to every new screen and every screen touched during a session.

## Critical patterns

1. ALWAYS import `supabase` (anon) or `supabaseAdmin` (service role) from `@chefsbook/db` — never call createClient() directly. Use `supabaseAdmin` for server-side admin queries that bypass RLS.
2. ALWAYS import AI functions from `@chefsbook/ai` — never call the Claude API directly in app code
3. ALWAYS use `useTheme().colors` in mobile — never hardcode hex values
4. ALWAYS use `cb-*` Tailwind tokens in web (e.g. `bg-cb-primary`) — never hardcode hex
5. ALWAYS follow the Zustand store pattern in `apps/mobile/lib/zustand/authStore.ts`
6. NEVER commit `.env.local` — all keys stay out of git
7. Commit style: `type(scope): message` (e.g. `fix(web):`, `feat:`)
8. Admin pages (`/admin/*`) use `supabaseAdmin` (service role client) from `@chefsbook/db` — bypasses RLS for admin queries

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

30+ tables with RLS policies. Migrations in `supabase/migrations/` (30 files). Key tables:
- `user_profiles` (auto-created via trigger on auth.users signup)
- `recipes`, `recipe_ingredients`, `recipe_steps` — core recipe data
- `cookbooks` — recipe collections
- `meal_plans`, `menu_templates` — meal planning
- `shopping_lists`, `shopping_list_items` — grouped by aisle
- `cooking_notes` — journal entries per cook
- `category_groups`, `categories`, `recipe_categories` — hierarchical taxonomy (8 groups, 371 categories)
- `import_jobs`, `import_job_urls` — bookmark batch import tracking
- `techniques` — cooking methods/skills with JSONB process_steps, difficulty, tips, mistakes, tools
- `user_follows` — follower/following (replaced old `follows` table)

5 custom Postgres functions: `search_recipes()` (pg_trgm fuzzy), `get_meal_plan_week()`, `generate_shopping_list()`, `clone_recipe()`, `get_public_feed()`.

Storage buckets: `recipe-images` (5MB, public read) and `avatars` (2MB, public read).

### Shared packages

**@chefsbook/db** — Supabase client is a lazy-init Proxy singleton (`packages/db/src/client.ts`). Query modules organized by domain: `recipes.ts`, `cookbooks.ts`, `mealPlans.ts`, `shopping.ts`, `cookingNotes.ts`, `menuTemplates.ts`, `imports.ts`, `categories.ts`, `techniques.ts`. `subscriptions.ts` defines plan limits and gate-check functions. Types define `PlanTier`, `SourceType` (includes `'youtube'`), `Course`, `MealSlot`, `VisibilityLevel`, `Technique`, `Difficulty`.

**@chefsbook/ai** — `callClaude()` hits the Anthropic API (`claude-sonnet-4-20250514`), supports text + optional image input. Key exports: `scanRecipe(imageBase64)`, `importFromUrl(url)`, `importUrlFull(url)`, `classifyPage(html)`, `fetchPage(url)`, `suggestRecipes(ingredients[])`, `generateVariation(recipe, request)`, `mergeShoppingList()`, `matchFolderToCategory()`, `matchFoldersToCategories()`, `importFromYouTube()`, `classifyContent()` (recipe vs technique), `importTechnique()`, `importTechniqueFromYouTube()`, `extractJsonLdRecipe()`, `analyseScannedImage()`, `reanalyseDish()`, `generateDishRecipe()`, `fetchInstagramPost()`, `extractRecipeFromInstagram()`. Uses `extractJSON()` to parse structured data from LLM output.

**@chefsbook/ui** — Pure formatters: `formatDuration()`, `formatQuantity()` (Unicode fractions like "1 3/4"), `scaleQuantity()`, `formatServings()`, `getInitials()`, `truncate()`, `groupBy()`.

### Subscription tiers (packages/db/src/subscriptions.ts)

| | Free | Chef ($4.99/mo) | Family ($9.99/mo) | Pro ($14.99/mo) |
|---|---|---|---|---|
| Own recipes | 0 | 75 | 200 | Unlimited |
| Import/Scan/AI | No | Yes | Yes | Yes |
| Shopping lists | 1 | 5 | 5 | Unlimited |
| Cookbooks | 0 | 10 | 25 | Unlimited |
| Images/recipe | 0 | 1 | 1 | 5 |
| Follow/Comment | No | Yes | Yes | Yes |
| PDF export | No | No | No | Yes |
| Family members | 0 | 0 | 3 | 0 |

### Mobile routing & state

Expo Router v6 with 5 bottom tabs: My Recipes, Search, Scan, Plan, Cart. Dynamic routes: `recipe/[id]`, `cookbook/[id]`, `chef/[id]`, `share/[token]`, `recipe/new`, `modal` (settings).

Zustand v5 stores in `apps/mobile/lib/zustand/`: authStore, recipeStore, mealPlanStore, shoppingStore, cookbookStore, cookingNotesStore, importStore, pinStore. Auth store initializes Supabase session and listens for auth state changes.

### Web architecture

Next.js App Router. Dashboard layout is `'use client'` with sidebar nav: Search, My Recipes, My Techniques, My Cookbooks, Shopping, Meal Plan, Import & Scan, Speak a Recipe. Stripe integration for subscriptions (not yet configured).

Key dashboard pages: `/dashboard` (recipes with grid/list/table views + sort), `/dashboard/search` (All/My Recipes toggle + filters), `/dashboard/scan` (image OCR + URL import + bookmark batch import), `/dashboard/techniques` (technique library + manual entry at `/new`), `/dashboard/plan` (weekly meal calendar + recipe picker), `/dashboard/shop` (shopping lists), `/dashboard/cookbooks` (physical cookbook shelf). Admin dashboard at `/admin` (client component layout, requires admin_users row).

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

## KEY TABLE SCHEMAS — verify before querying

These columns have caused repeated bugs from wrong assumptions:

recipe_user_photos:
  url TEXT (NOT photo_url)
  storage_path TEXT
  is_primary BOOLEAN
  sort_order INTEGER

user_follows:
  follower_id UUID (NOT follower)
  following_id UUID (NOT followed_id)

shopping_list_items:
  list_id UUID
  user_id UUID (RLS checks user_id = uid(); web API routes must pass service role client to bypass)

stores:
  user_id UUID
  name TEXT
  domain TEXT
  logo_url TEXT
  initials TEXT

Always run `\d [tablename]` on RPi5 before writing any new query.

Session history lives in DONE.md; upcoming work lives in AGENDA.md. Do not duplicate here.

## Known issues

- **GitHub push protection blocking commits** — 5 local commits (437e439, 828257a, 08f12a1, 186cd5c, 2eecfee) cannot be pushed due to API keys in historical commit a3b6835. GitHub provides bypass URLs valid for limited time: visit security/secret-scanning/unblock-secret links, allow secrets, then retry push. After successful push: pull to RPi5, rebuild web, deploy YouTube dialog + extension v1.1.1.
- **callClaude maxTokens follow-up:** other callers (cookbookTOC, scanRecipeMultiPage, generateMealPlan, etc.) may need maxTokens raises beyond their defaults — see AGENDA.md "AI ROBUSTNESS FOLLOW-UPS".
- **Import completeness gate not wired on 2 paths (session 141):** web bookmark batch loop at apps/web/app/dashboard/scan/page.tsx:444 uses createRecipe() directly; cookbook recipe import at apps/web/app/dashboard/cookbooks/[id]/page.tsx:79 uses createRecipe() directly. Both should route through createRecipeWithModeration (web) or call /api/recipes/finalize to get the gate.
- **Import visibility lock is backend-only (session 141):** applyCompletenessGate sets visibility=private for incomplete recipes, but the UI visibility toggle on recipe detail can still be flipped to public. A UI-side check against is_complete + ai_recipe_verdict='approved' is not yet implemented; the next save/finalize call would re-flag it private on the backend though.
- **Mobile: floating tab bar missing on recipe detail + other root-Stack screens** — Original pre-session-203 bug. FloatingTabBar is mounted inside `apps/mobile/app/(tabs)/_layout.tsx` via `tabBar={() => <FloatingTabBar />}`, so any stack push past the tabs group (recipe/[id], recipe/new, cookbook/[id], chef/[id], share/[token], speak, plans) covers the entire Tabs layout including the bar. Needs a dedicated session that honors the prompt-203 mandatory investigation-pause — reattempt must avoid the `(tabs)` root-resolves-to-`/` pitfall that sank session 203's fix.
- **Mobile: camera capture silently drops back to My Recipes tab** — Session 203 FIX 2 added try/catch with visible Alert to `startScan`/`addScanPage`/`lib/image.ts` but the bug persists on the session-204 APK. The try/catch is likely swallowing the real error without surfacing it. Dedicated debug session needed: capture adb logcat during repro, remove silent catches, add explicit error reporting before re-wrapping.
- **Mobile: guided scan-to-recipe flow untestable** — Session 203 FIX 3 (GuidedScanFlow component, scan_guided_followups + scan_guided_generation logging) ships in the session-204 APK but cannot be exercised while FIX 2 (camera) is broken — camera never hands off to the flow.
- **Mobile: native-splash → JS-splash flash on cold launch** — Session 203 FIX 4 splash is functional but a native-splash frame occasionally flashes before the JS SplashOverlay renders. Not a blocker; logged for a dedicated session.
- **Mobile: Android signing config is gitignored** — apps/mobile/android/ is in .gitignore (Expo pattern). The build.gradle release signing config is a local-only edit. After `expo prebuild --clean`, re-apply: signingConfigs.release block reading keystore.properties + swap `signingConfig signingConfigs.debug` → `signingConfig signingConfigs.release` in release buildType. Keystore file + keystore.properties must persist locally (both gitignored).
- **Mobile: like button bypasses plan gate** — Calls toggleLike() directly instead of server API route; free users can like on mobile
- **Mobile: no notification UI** — Web has 5-tab NotificationBell panel; mobile has nothing
- **Mobile: no message inbox** — Can compose from profiles but no conversation list or thread view
- **Mobile: YouTube import dead button** — Listed in SOURCE_OPTIONS but handler not wired
- ESLint not configured for web app (no `.eslintrc.json`; `npm run lint` fails with interactive wizard)
- No test suite (unit or integration)
- Stripe env vars not yet configured (subscriptions non-functional, 14-day trial blocked)
- Follow system built (session 31): `user_follows` table replaces old `follows` table; old table still exists in DB but unused by code
- Family tier features not built (shared lists, shared plans, family cookbook, member invite)
- Extension hardcoded to localhost:3000 + Tailscale IP (not production-ready)
- Multilingual support: fully implemented with react-i18next; 5 locales (en/fr/es/it/de); all UI strings use t() calls; language change triggers immediate UI translation via activateLanguage()
- Shared with Me system not started (recipe_shares table, accept/decline, notifications)
- **AI image generation working** — REPLICATE_API_TOKEN set on RPi5. 75 recipes have AI images (0 without). Replicate rate limit: 6 req/min on <$5 accounts, script uses 12s delay. CRITICAL: stored image URLs must use Tailscale IP (100.110.47.62:8000), NOT localhost:8000 — session 157 fixed 75 broken URLs caused by this.
- **Step rewrite backfill blocked on API credits** — scripts/rewrite-imported-steps.mjs works correctly (schema, queries, logic all verified) but the Anthropic API key has insufficient credit balance. 82 recipes need rewriting. Script now has early-exit on credit/auth errors. Top up credits at console.anthropic.com then re-run.
- **4 recipes without images (Replicate credits exhausted)** — Best Chocolate Chip Cookies, Slow-Roasted Lamb Shoulder, Sous Vide Pulled Pork, Thai Chicken Satay. Top up Replicate credits at replicate.com/account/billing then run `node scripts/generate-recipe-images.mjs --limit 4`.
- **External image URLs blocked at code level** — addRecipePhoto() throws on external URLs, createRecipe() filters out non-internal image_url. 52 legacy external URLs already nulled from DB.
- **LSB steganographic watermark REMOVED** — session 170 discovered it corrupted JPEG headers on 73/74 images (sharp couldn't re-read them). The visible "ChefsBook" badge is the sole watermark now. Do NOT re-add LSB watermarking without thorough testing.
- **Watermark badge: ALWAYS use `scripts/chefs-hat.png`** (source: `docs/pics/cb_plus_hat.png`) — the real ChefsBook wordmark + hat asset. `scripts/create-watermark-badge.mjs` composites that PNG on a white rounded-rect pill and writes `apps/web/public/images/watermark-chefsbook.png` (read by both `apply-watermarks.mjs` and `apps/web/lib/imageGeneration.ts`). NEVER redraw the chef's hat or wordmark as SVG geometry — every attempt (sessions 158, 164, 170, 171) produced the wrong result. If `scripts/chefs-hat.png` is missing, copy from `docs/pics/cb_plus_hat.png` before regenerating. Badge is placed bottom-LEFT on images (avoids CSS `object-fit:cover` cropping on the right).
- **5 recipes without AI images** — Replicate credit exhaustion during session 170 regeneration. Top up credits and re-run `node scripts/generate-recipe-images.mjs --limit 5`.
- **Mobile copyright flag not yet wired** — Web recipe detail has Report button with flag types; mobile recipe/[id].tsx does not yet have a flag/report button.
- Mobile sign-in flow verified on device (landing → sign in → recipes tab works; Google OAuth stub remains TODO)
- Google OAuth stubs in mobile auth screens (TODO: wire up signInWithOAuth)
- assetlinks.json has placeholder fingerprint — needs release APK signing key SHA256 (`keytool -list -v -keystore [keystore.jks]`)
- Emulator must be launched from CLI (`emulator -avd Medium_Phone_API_36.1 -no-snapshot -gpu host`) — Android Studio Device Manager launches headless/invisible window
- Metro hostname: set `REACT_NATIVE_PACKAGER_HOSTNAME=localhost` before `npx expo start` when on Tailscale (otherwise Metro advertises Tailscale IP, unreachable from emulator)
- **Mobile storage uploads**: if uploads break after a full volume reset on RPi5, re-run `ALTER ROLE supabase_storage_admin SUPERUSER;` on PostgreSQL (the fix from session ~140; persists in pg_authid but resets on full DB reinit).
- **Supabase storage image display requires `apikey` header** — Self-hosted Kong gateway returns 401 on public bucket URLs without the `apikey` header. All `<Image>` sources loading from Supabase storage must include `headers: { apikey: SUPABASE_ANON_KEY }`. Applied in EditImageGallery and RecipeImage components.
- APK rebuild note: always delete cached JS bundle before rebuilding (`rm -f android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle`) or Gradle uses stale code
- Jetifier: `android.enableJetifier=true` must be added to `android/gradle.properties` after every `expo prebuild --clean` (it gets wiped)

See `AGENDA.md` for the full prioritized backlog with effort estimates and recommended build order.

## Decisions log

<!-- Keep this section to non-obvious WHY decisions only. Implementation details belong in the code. -->

### Architectural choices (non-obvious WHY decisions only)
- All AI calls server-side (Anthropic API blocks browser CORS); mobile calls `@chefsbook/ai` directly (no CORS in React Native)
- Techniques as separate table (not content_type on recipes) — fundamentally different fields
- Re-import preserves user edits (title, tags, notes, custom images) — only updates AI-derived fields
- `_unresolved` tag marks recipes where title was auto-generated from URL slug
- Recipe saves vs favorites: `is_favourite` = personal bookmark; `recipe_saves` = social save of public recipes
- Follow system: `user_follows` table (old `follows` table still in DB but unused); `canFollow` plan gate (chef+)
- Free tier: 0 own recipes, no import/scan/AI; Chef is minimum for recipe creation
- Recipe attribution: `original_submitter` chains from source (never changes); `shared_by` is immediate sharer (from `?ref=`), user-removable
- Comments: Chef+ plan with `is_searchable = true`; AI moderation (3 verdicts); threaded via `parent_id`
- Visibility: `shared_link` must be treated as public in ALL recipe queries — NOT just `'public'`
- Web image proxy: `/api/image?url=` proxies Supabase storage URLs with apikey (Kong returns 401 without it)
- PDF export: `/recipe/[id]/pdf` from raw data via `@react-pdf/renderer`; Pro plan gated; hero image fetched server-side with apikey
- Unified dialogs: `ChefsDialog` (web + mobile) replaces native confirm/alert; `useConfirmDialog` hooks
- Offline shopping: mobile caches to FileSystem; checked items local-only; pending edits sync on reconnect
- Extension: production URLs (chefsbk.app); zip at `apps/extension/dist/`; must copy to Pi after packaging
- Password recovery: SMTP via Resend; mobile sends user to web reset page (no deep link handler yet)

### Gotchas (non-obvious, will cause bugs if ignored)
- RPi5 web build: ALWAYS `rm -rf apps/web/node_modules/react apps/web/node_modules/react-dom .next` before build; use `NODE_OPTIONS=--max-old-space-size=1024 npx next build --no-lint` (lint phase OOMs at 1024MB); duplicate React causes 404 SSG crash; corrupted `.next` causes dark overlay. The SWC lockfile warning (`⨯ Failed to patch lockfile [TypeError: Cannot read properties of undefined (reading 'os')]`) is NON-FATAL on arm64 — build still compiles via SWC in ~27s, ignore it. DO NOT run `npm install` in apps/web or repo root on the Pi — blocked by EOVERRIDE conflict (root package.json has both `overrides.react` and `dependencies.react`). Deploy via `/mnt/chefsbook/deploy-staging.sh` which handles the clean correctly.
- PostgREST schema cache: after any new table migration, run `docker restart supabase-rest` on RPi5 or queries return "table not found in schema cache"
- Supabase joins with multiple FKs: when a table has 2+ FKs to the same target (e.g. `recipe_comments.user_id` + `reviewed_by` both → `user_profiles`), MUST use explicit FK name: `user_profiles!recipe_comments_user_id_fkey` — `!inner` alone causes PGRST201
- Web Supabase URL: MUST be `https://api.chefsbk.app` (NOT `http://100.110.47.62:8000`) — mixed content blocks ws:// on HTTPS pages; Cloudflare Tunnel handles WebSocket upgrades automatically; mobile still uses direct IP
- Server-to-server internal fetches: MUST use `http://localhost:3000` (NOT `req.url` origin which resolves to `https://chefsbk.app` behind Cloudflare Tunnel). Looping through the tunnel causes HTML error pages instead of JSON on timeout/failure. Fixed in /api/admin/refresh-incomplete (session 148).
- React pinned to 19.1.0 across monorepo (19.1.4 causes frozen object crash with RN 0.81)
- Metro blockList excludes root node_modules react/react-native to prevent duplicate bundles
- Expo file-system v19: use `expo-file-system/legacy` import for `documentDirectory` / `readAsStringAsync` / `writeAsStringAsync`
- Native modules that may not be linked (e.g. `@react-native-voice/voice`) use lazy `require()` in try/catch
- Unit conversion lives ONLY in `packages/ui/src/unitConversion.ts` — never duplicate in app code
- Supabase auth persistence: `configureStorage()` in `@chefsbook/db` accepts a storage adapter; mobile wires `expo-secure-store` in `_layout.tsx` at module scope (before any Supabase access)
- Release APK cleartext: `network_security_config.xml` allows HTTP only to 100.110.47.62 + localhost + 10.0.2.2
- American spelling used throughout mobile app (Favorite not Favourite)
- Scan description: Claude Vision prompt mandates a description — field must never be null
- Web AI calls (moderateComment, moderateRecipe) fail due to CORS — wrap in try/catch, allow action to proceed without moderation
- Web API routes using `addItemsWithPipeline` must pass the service role client (db singleton has no JWT context → RLS fails)
- Instagram URLs must never enter standard URL import path — `handleImport()` checks `isInstagramUrl()` first and redirects
- GoTrue NULL token crash: users created with GOTRUE_MAILER_AUTOCONFIRM=true get NULL token columns → Go scanner crashes. Fix: `UPDATE auth.users SET confirmation_token=COALESCE(confirmation_token,''), recovery_token=COALESCE(recovery_token,''), ...` for affected users
- Server component auth: `supabase.auth.getSession()` returns null in Next.js server components (no cookie context). Use `'use client'` for auth-gated layouts, or use `@supabase/ssr` with `cookies()`. The `supabaseAdmin` service role client works for data queries that don't need user context.
- RLS self-referencing policies: NEVER write `EXISTS(SELECT FROM same_table WHERE ...)` in an RLS policy — it triggers infinite recursion (PostgreSQL 42P17). Use direct column checks like `user_id = auth.uid()` instead.

### Conventions
- Development agenda tracked in `AGENDA.md` at project root
- Store logos: logo.dev API (publishable token, safe for client)
- i18n: `react-i18next` on both mobile and web; locale files in `apps/mobile/locales/*.json` (mobile) and `apps/web/locales/*.json` (web); `activateLanguage()` lazy-loads non-English locales; web `I18nProvider` is non-blocking (renders immediately with English, loads user preference async)
- Translation cached in `recipe_translations` table per recipe+language; shared across all users (not per-user); RLS: public read, auth write; English always shows original; cache invalidated on replaceIngredients/replaceSteps

### AI cost reference

`callClaude()` accepts `model` param — defaults to Sonnet, pass `HAIKU` for classification/short tasks. Full per-function cost table is in `.claude/agents/ai-cost.md` (mandatory reading whenever touching `@chefsbook/ai`).

## Builds

### Release Signing (Android)
- **Keystore**: `apps/mobile/android/chefsbook-release.keystore` (GITIGNORED — never commit)
- **Properties**: `apps/mobile/android/keystore.properties` (GITIGNORED — contains passwords)
- **Alias**: chefsbook
- **Validity**: 10,000 days (~27 years, expires 2053-08-30)
- **SHA-256 fingerprint**: Run `keytool -list -v -keystore apps/mobile/android/chefsbook-release.keystore -storepass <pw>` to view
- **BACKUP CRITICAL**: Losing this keystore means you can never update the Play Store app. Back up to:
  1. Encrypted 1Password / Bitwarden vault (keystore file + passwords)
  2. External drive (encrypted)
  3. Separate cloud storage (encrypted ZIP)
- **If lost**: Play Store allows re-registration via Play App Signing (Google holds signing key), but only if you enrolled
- **When prebuild runs** (`expo prebuild --clean`): the signing config gets wiped. Re-add via `android/app/build.gradle` signingConfigs.release block that reads `keystore.properties`

### Staging APK
Package: com.chefsbook.app.staging (installs alongside dev client)
Config: apps/mobile/app.staging.json + apps/mobile/.env.staging
Build command (requires Metro stopped first):
```bash
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
cd apps/mobile
EXPO_PUBLIC_APP_VARIANT=staging npx expo run:android --variant release
```
Install: `adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

### Web Staging (RPi5)
URL: http://100.110.47.62:3001
Prerequisites: Node.js + npm must be installed on rpi5-eth
Deploy: `ssh rasp@rpi5-eth && /mnt/chefsbook/deploy-staging.sh`

### To update staging after code changes:
1. Stop Metro dev server
2. `cd apps/mobile && npx expo run:android --variant release`
3. `adb install -r [apk path]`
4. `ssh rasp@rpi5-eth && /mnt/chefsbook/deploy-staging.sh`

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
