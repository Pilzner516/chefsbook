# ChefsBook Audit Report
# Date: 2026-04-14
# Sessions covered: 87-128
# Auditor: Claude Code (session 129)

---

## Executive Summary

1. **CRITICAL: `plan_tier` enum missing `'chef'` value** - The DB enum has only `free/pro/family`, but code and `plan_limits` table reference `'chef'`. No user can ever be assigned the Chef tier via the enum. Stripe subscriptions will fail to set this tier.
2. **Image proxy is an open redirect** - `/api/image` redirects non-Supabase URLs to any external URL (`NextResponse.redirect(url)`), which is exploitable for phishing.
3. **ESLint not configured** - `npm run lint` prompts for interactive setup; no `.eslintrc` exists for the web app. Lint has never actually run.
4. **Mobile TypeScript has 3 errors** - `SafeAreaView` style prop issue on auth screens + expo-file-system type resolution.
5. **15 of 69 recipes (22%) have no description** - Violates the import pipeline mandate that description must never be null.

---

## Critical Issues (fix immediately)

### 1. plan_tier enum missing 'chef'
- **DB enum values:** `free`, `pro`, `family`
- **Code expects:** `free`, `chef`, `family`, `pro` (in `packages/db/src/types.ts`)
- **plan_limits table has:** `free`, `chef`, `family`, `pro` (text column, not enum)
- **Impact:** No user can be set to `plan_tier = 'chef'` via DB enum constraint. The entire Chef tier ($4.99/mo) is unreachable through normal Stripe webhook flow.
- **Fix:** `ALTER TYPE plan_tier ADD VALUE 'chef' BEFORE 'family';`

### 2. Image proxy open redirect
- **File:** `apps/web/app/api/image/route.ts:12-14`
- **Issue:** Non-Supabase URLs are redirected via `NextResponse.redirect(url)` - any attacker can craft `chefsbk.app/api/image?url=https://evil.com` for phishing.
- **Fix:** Return 403 for non-Supabase URLs instead of redirecting.

### 3. ESLint not configured
- **Issue:** `apps/web` has no `.eslintrc.json` - `npm run lint` enters interactive setup wizard and fails.
- **Impact:** No automated lint checks have ever run on the web app.

### 4. supabaseAdmin in server components (not API routes)
- **Files:**
  - `apps/web/app/admin/limits/page.tsx` - imports supabaseAdmin directly
  - `apps/web/app/admin/page.tsx` - imports supabaseAdmin directly
- **Risk:** These are server components (not `'use client'`), so the service role key stays server-side. However, this pattern bypasses the `/api/admin` centralized auth check. If these pages are ever converted to client components, the key would leak.
- **Recommendation:** Route through `/api/admin` like other admin pages.

---

## Known Gaps (important, scheduled)

| Gap | Origin | Status |
|-----|--------|--------|
| Mobile recipe list translated titles | Session 125 | Not started |
| Mobile recipe detail translation + "Hang tight" banner | Session 125 | Not started |
| Mobile like plan gate (ChefsDialog upgrade prompt) | Session 128 | Not started |
| Mobile messages screen (full conversation UI) | Backlog | Not started |
| Bookmark batch import title translation | Session 125 | Not started |
| AI impersonation check on signup | Session 110 | Not started |
| data-onboard attributes on remaining pages | Session 120 | Partial (8 added, more pages exist) |
| Instagram URL routing on web scan page | -- | Missing (no isInstagramUrl check) |
| Stripe env vars not configured | Session 27 | Subscriptions non-functional |
| Family tier features | Backlog | Not started (shared lists/plans/cookbook/invite) |
| Google OAuth | Session 01 | Stub only |
| Shared With Me system | Backlog | Not started |
| No test suite | -- | No unit or integration tests exist |

---

## Passing Checks

- No hardcoded secrets in source code
- No `console.log` artifacts in any app or package code (0 found)
- No `window.confirm` / `window.alert` / `Alert.prompt` usage (all migrated to ChefsDialog)
- No direct Claude API calls in app code (all routed through `@chefsbook/ai`)
- No `SUPABASE_SERVICE_ROLE_KEY` exposed to client-side code
- Web TypeScript: 0 errors (`npx tsc --noEmit` passes clean)
- Admin API route (`/api/admin/route.ts`) verifies admin JWT via `admin_users` table lookup
- All checked feature owner files exist on disk
- PM2 process online (63.1MB memory, healthy)
- 0 console.log statements across all source files

---

## Section 1: Database Health

### 1a. All tables with row counts (56 tables)

| Table | Rows | Notes |
|-------|------|-------|
| admin_audit_log | 0 | Unused |
| admin_users | 2 | pilzner + seblux |
| barman_credentials | 2 | |
| barman_credits | 0 | |
| barman_sessions | 0 | |
| beer_logs | 0 | |
| beers | 100 | |
| blocked_commenters | 0 | |
| categories | 371 | 8 groups |
| category_groups | 8 | |
| comment_flags | 1 | |
| comment_likes | 0 | |
| cookbook_recipes | 67 | |
| cookbooks | 1 | |
| cooking_notes | 0 | |
| direct_messages | 8 | |
| family_members | 0 | |
| follows | 0 | Old table (replaced by user_follows) |
| guest_sessions | 0 | |
| help_requests | 5 | |
| import_job_urls | 63 | |
| import_jobs | 3 | |
| import_site_tracker | 3 | |
| locations | 5 | |
| meal_plans | 23 | |
| menu_templates | 0 | |
| message_flags | 0 | |
| milestones | 5 | |
| notifications | 7 | |
| plan_limits | 4 | |
| player_milestones | 0 | |
| players | 0 | |
| promo_codes | 1 | |
| receipt_beers | 0 | |
| receipt_players | 0 | |
| receipts | 0 | |
| recipe_categories | 0 | No recipes tagged |
| recipe_comments | 7 | |
| recipe_ingredients | 570 | ~8.3 per recipe |
| recipe_likes | 8 | |
| recipe_saves | 3 | |
| recipe_steps | 453 | ~6.6 per recipe |
| recipe_translations | 270 | |
| recipe_user_photos | 14 | |
| recipes | 69 | |
| reserved_usernames | 22 | 0 approved |
| shopping_list_items | 90 | |
| shopping_list_shares | 0 | |
| shopping_lists | 12 | |
| stores | 5 | |
| tap_list | 24 | |
| techniques | 0 | No techniques imported |
| user_account_tags | 2 | |
| user_flags | 0 | |
| user_follows | 1 | |
| user_profiles | 4 | |

**Notable:** 15 tables with 0 rows appear to be from an unrelated "barman/beer" schema (`barman_credentials`, `barman_credits`, `barman_sessions`, `beer_logs`, `beers`, `receipt_beers`, `receipt_players`, `receipts`, `player_milestones`, `players`, `tap_list`, `locations`, `milestones`). These are not part of ChefsBook and may be leftover from a previous project sharing the same Supabase instance.

### 1b. Recipe health

| Metric | Value |
|--------|-------|
| Total recipes | 69 |
| Missing description | 15 (22%) |
| Missing original_submitter_id | 1 |
| Public | 68 |
| Private | 1 |
| shared_link | 0 |

**Issue:** 15 recipes have no description. The import pipeline mandates descriptions, so these are likely from early sessions before the mandate was enforced.

### 1c. Translation coverage

| Language | Total | Title-only | Full |
|----------|-------|-----------|------|
| de | 67 | 67 | 0 |
| es | 67 | 67 | 0 |
| fr | 69 | 67 | 2 |
| it | 67 | 67 | 0 |

**Note:** 270 total translation rows. French has 2 full translations (likely from manual detail-page views). All others are title-only from the backfill script. 2 recipes are missing non-French translations (69 fr vs 67 others).

### 1d. User summary

| Metric | Value |
|--------|-------|
| Total users | 4 |
| With username | 3 |
| Free tier | 2 |
| Pro tier | 2 |
| Chef tier | 0 (enum doesn't exist) |

### 1e. Admin users

| Role | Email | Username |
|------|-------|----------|
| super_admin | a@aol.com | pilzner |
| super_admin | seblux100@gmail.com | seblux |

### 1f. Notifications

| Type | Count |
|------|-------|
| comment_reply | 2 |
| new_follower | 2 |
| recipe_like | 3 |

No `recipe_comment` notifications exist (should be created when someone comments on your recipe).

### 1g. Direct messages
- Total: 8
- Hidden: 0

### 1h. Shopping
- Lists: 12
- Items: 90

### 1i. Migrations
- Local migration files: 38
- `supabase_migrations` schema: not populated (self-hosted, migrations applied manually via psql)

### 1j. Reserved usernames
- Total: 22
- Approved: 0 (all 22 are blocked/reserved)

### 1k. Import site tracker

| Domain | Status | Attempts | Successful |
|--------|--------|----------|------------|
| preppykitchen.com | working | 1 | 1 |
| dadcooksdinner.com | working | 1 | 1 |
| seriouseats.com | partial | 0 | 0 |

### 1l. Comment likes: 0
### 1m. User flags: 0

---

## Section 2: Feature Registry

### Status summary

| Status | Count |
|--------|-------|
| LIVE | 96 |
| PARTIAL | 1 |
| BROKEN | 0 |

### PARTIAL features
- **Google OAuth (stub)** - UI exists in auth screens but not wired to Supabase OAuth provider.

### Owner file spot-checks (all PASS)

| File | Exists |
|------|--------|
| `apps/web/app/dashboard/messages/page.tsx` | PASS |
| `apps/web/app/admin/reserved-usernames/page.tsx` | PASS |
| `apps/web/app/api/recipe/[id]/like/route.ts` | PASS |
| `apps/web/app/api/recipes/translate/route.ts` | PASS |
| `apps/web/app/api/recipes/translate-title/route.ts` | PASS |
| `apps/web/components/OnboardingBubble.tsx` | PASS |
| `apps/mobile/app/(tabs)/search.tsx` | PASS |

---

## Section 3: Code Quality

### TypeScript

| App | Result |
|-----|--------|
| Web (`apps/web`) | 0 errors - PASS |
| Mobile (`apps/mobile`) | 3 errors - FAIL |

**Mobile errors:**
1. `app/auth/signin.tsx:62` - `style` prop not accepted by `SafeAreaView` (NativeSafeAreaViewProps)
2. `app/auth/signup.tsx:80` - Same `SafeAreaView` style issue
3. `../../node_modules/expo-file-system/src/legacy/FileSystem.ts:2` - Cannot find module `react-native` (type resolution only, runtime works)

### ESLint
- **Web:** Not configured - `npm run lint` enters interactive wizard and exits with error. No `.eslintrc.json` exists.
- **Mobile:** No lint script defined.

### Hardcoded hex colors (violates theme rules)

| File | Issue |
|------|-------|
| `apps/web/app/dashboard/plan/page.tsx` | Hardcoded theme colors |
| `apps/web/app/page.tsx` | Landing page uses raw hex |
| `apps/web/app/recipe/[id]/pdf/RecipePdf.tsx` | PDF renderer uses raw hex (acceptable - @react-pdf doesn't support Tailwind) |
| `apps/mobile/app/_layout.tsx` | Hardcoded hex |

### Native confirm/alert: 0 (all migrated to ChefsDialog) - PASS
### console.log artifacts: 0 across all source - PASS
### Direct Claude API calls in app code: 0 - PASS
### supabaseAdmin in client components: 2 admin pages (see Critical Issues #4)

---

## Section 4: AI Cost Audit

### All functions calling Claude API

| Function | File | Model | Est. cost/call | In cost table? |
|----------|------|-------|----------------|----------------|
| aiChefComplete | aiChefComplete.ts | Sonnet (default) | ~$0.015 | No |
| classifyContent | classifyContent.ts | HAIKU | ~$0.00016 | Yes |
| cookbookLookup (barcode) | cookbookLookup.ts | HAIKU | ~$0.00016 | No |
| cookbookLookup (TOC) | cookbookLookup.ts | Sonnet (default) | ~$0.015 | No |
| analyseScannedImage | dishIdentify.ts | HAIKU | ~$0.00030 | Yes |
| reanalyseDish | dishIdentify.ts | HAIKU | ~$0.00030 | No |
| generateDishRecipe | dishIdentify.ts | Sonnet (default) | ~$0.015 | Yes |
| formatVoiceRecipe | formatVoiceRecipe.ts | Sonnet (default) | ~$0.015 | No |
| generateVariation | generateVariation.ts | Sonnet (default) | ~$0.015 | No |
| importFromUrl | importFromUrl.ts | Sonnet (default) | ~$0.015 | Yes |
| classifyPage | importFromUrl.ts | HAIKU | ~$0.00016 | Yes |
| extractJsonLdRecipe (gap-fill) | importFromUrl.ts | Sonnet (default) | ~$0.015 | No (part of importFromUrl) |
| importFromYouTube | importFromYouTube.ts | Sonnet (default) | ~$0.015 | No |
| importTechnique | importTechnique.ts | Sonnet (default) | ~$0.015 | No |
| importTechniqueFromYouTube | importTechnique.ts | Sonnet (default) | ~$0.015 | No |
| extractRecipeFromInstagram | instagramImport.ts | Sonnet (default) | ~$0.015 | No |
| matchFolderToCategory | matchFolderCategory.ts | HAIKU | ~$0.00016 | Yes |
| generateMealPlan | mealPlanWizard.ts | Sonnet (default) | ~$0.020 | Yes |
| mergeShoppingList | mergeShoppingList.ts | Sonnet (default) | ~$0.015 | No |
| moderateComment | moderateComment.ts | HAIKU | ~$0.00016 | Yes |
| moderateMessage | moderateMessage.ts | HAIKU | ~$0.00016 | No |
| moderateRecipe | moderateRecipe.ts | HAIKU | ~$0.00020 | Yes |
| scanRecipe | scanRecipe.ts | Sonnet (default) | ~$0.015 | Yes |
| scanRecipeMultiPage | scanRecipe.ts | Sonnet (default) | ~$0.015 | No (part of scanRecipe) |
| generateShareText | socialShare.ts | HAIKU | ~$0.00020 | Yes |
| generateHashtags | socialShare.ts | HAIKU | ~$0.00020 | Yes |
| suggestPurchaseUnits | suggestPurchaseUnit.ts | HAIKU | ~$0.00040 | Yes |
| suggestRecipes | suggestRecipes.ts | Sonnet (default) | ~$0.015 | No |
| translateRecipe | translateRecipe.ts | Sonnet (default) | ~$0.011 | Yes |
| translateRecipeTitle | translateRecipe.ts | HAIKU | ~$0.0002 | Yes |

### Cost issues flagged

1. **mergeShoppingList** uses Sonnet - could likely use HAIKU for list merging
2. **suggestRecipes** uses Sonnet - recommendation from ingredients could use HAIKU
3. **cookbookLookup (TOC generation)** uses Sonnet - could potentially use HAIKU
4. **8 functions missing from CLAUDE.md cost reference table:** aiChefComplete, cookbookLookup, formatVoiceRecipe, generateVariation, importFromYouTube, importTechnique, extractRecipeFromInstagram, moderateMessage, suggestRecipes, mergeShoppingList

### Estimated monthly cost at 100 active users

Assuming per user/month: 5 imports, 2 scans, 1 meal plan, 10 comments, 5 likes, 2 translations viewed:
- Sonnet calls: ~700 calls x $0.015 = **~$10.50/mo**
- Haiku calls: ~1,500 calls x $0.0002 = **~$0.30/mo**
- **Total estimate: ~$11/mo at 100 users**

Translation cache (shared) amortizes well - 69 recipes x 4 languages = 276 title translations already cached.

---

## Section 5: Import Pipeline Audit

### Per-path compliance check

| Import Path | Description mandated? | Title translation? | moderateRecipe()? |
|-------------|----------------------|-------------------|-------------------|
| URL import | PARTIAL - JSON schema has `"description": "string \| null"`, but no "must never be null" directive in prompt | PASS - via saveWithModeration | PASS - via saveWithModeration |
| Photo scan | PASS - Explicit mandate: "This field must NEVER be null or empty" | Depends on mobile save path | Depends on mobile save path |
| Speak a recipe | PARTIAL - Schema has `"description": "string \| null (1-2 sentence summary)"` but allows null | Depends on web save path | Depends on web save path |
| Instagram import | PASS - Explicit: "description must never be null" | Depends on mobile save path | Depends on mobile save path |
| File import | Not checked (server-side) | PASS (if uses saveWithModeration) | PASS (if uses saveWithModeration) |
| Bookmark batch | Not checked (server-side) | PASS (if uses saveWithModeration) | PASS (if uses saveWithModeration) |
| YouTube import | PARTIAL - Schema has `"description": "string \| null"` but no explicit mandate | Depends on save path | Depends on save path |

### Key findings

1. **15 recipes have empty descriptions** - confirms the mandate is not enforced at DB or application level
2. **Web scan page has no `isInstagramUrl` check** - Instagram URLs pasted on web go through standard URL import, not the dedicated Instagram handler
3. **Title translation fires only through `saveWithModeration()`** on web - mobile imports do not trigger title translation
4. **Moderation fires only through `saveWithModeration()`** on web - mobile imports call `@chefsbook/ai` directly and may not run moderation

---

## Section 6: Security Audit

### Hardcoded secrets: NONE FOUND
Searched for `re_` (Resend), `sk-ant` (Anthropic), `eyJhbGc` (JWT) patterns across all source files. Clean.

### supabaseAdmin in non-API client code
Two admin page server components import `supabaseAdmin` directly:
- `apps/web/app/admin/limits/page.tsx`
- `apps/web/app/admin/page.tsx`

These are server components, so the key stays server-side. Risk is low but inconsistent with the pattern where other admin pages use `/api/admin`.

### Admin routes protection: PASS
`/api/admin/route.ts` checks `admin_users` table for the authenticated user before processing any request.

### Image proxy restriction: FAIL (open redirect)
`apps/web/app/api/image/route.ts:12-14`:
```typescript
if (!isSupabase) {
  return NextResponse.redirect(url);  // <-- open redirect
}
```
Non-Supabase URLs are redirected to the attacker-controlled URL. Should return 403.

### GOTRUE_MAILER_AUTOCONFIRM: TRUE (known risk)
Auto-confirm is enabled on RPi5. This means:
- No email verification on signup
- Anyone can create accounts with any email
- Documented as known/accepted risk

### Service role key exposure: NONE
No `SUPABASE_SERVICE_ROLE_KEY` references found in client-side code. All service role usage is in API routes or server components.

---

## Section 7: Known Gaps Consolidated

### Documented in CLAUDE.md

| Gap | Origin | Notes |
|-----|--------|-------|
| No test suite | -- | No unit or integration tests |
| Stripe env vars not configured | Session 27 | Subscriptions non-functional |
| Old `follows` table still in DB | Session 31 | Replaced by `user_follows`, but not dropped |
| Family tier features not built | Backlog | Shared lists, plans, cookbook, invite |
| Extension hardcoded to localhost/Tailscale | Session 78 | Not production-ready |
| Google OAuth stubs | Session 01 | UI exists, not wired |
| assetlinks.json placeholder fingerprint | -- | Needs release signing key |
| Shared With Me system | Backlog | Not started |
| Password recovery deep link (mobile) | Session 91 | Sends to web reset page |

### NOT in CLAUDE.md (newly identified)

| Gap | Origin | Severity |
|-----|--------|----------|
| plan_tier enum missing 'chef' | Unknown | CRITICAL - blocks Chef tier |
| Mobile recipe list translated titles | Session 125 | Medium |
| Mobile recipe detail translation banner | Session 125 | Medium |
| Mobile like plan gate | Session 128 | Medium |
| Bookmark batch import title translation | Session 125 | Low |
| AI impersonation check on signup | Session 110 | Low |
| data-onboard attributes incomplete | Session 120 | Low |
| Web scan page missing isInstagramUrl | -- | Medium |
| ESLint not configured | -- | Medium |
| Image proxy open redirect | -- | HIGH |
| recipe_comment notifications not generated | -- | Medium (0 in DB) |
| Barman/beer tables in production DB | -- | Low (cleanup) |
| recipe_categories table empty (0 rows) | -- | Low (auto-tag not used) |
| techniques table empty (0 rows) | -- | Low (no imports done) |

---

## Section 8: Performance

### Web build
- Build directory size: **197MB** (`.next/`)
- PM2 process: **online**, 63.1MB memory, 0% CPU, 1681 restarts
- Note: 1681 restarts is very high - suggests frequent crashes or manual restarts during development

### PM2 status
```
chefsbook-web | online | 63.1mb | 0% cpu | 7m uptime | 1681 restarts
```

### Build was not re-run during this audit
Per the prompt instructions (audit only, do not fix), a fresh build was not triggered. The existing build on RPi5 is from session 128 (2026-04-14) and is serving traffic.

---

## Recommended Fix Priority (ordered)

1. **Add 'chef' to plan_tier enum** - One ALTER TYPE command. Blocks the entire paid tier system.
2. **Fix image proxy open redirect** - Change `NextResponse.redirect(url)` to `NextResponse.json({ error: 'Forbidden' }, { status: 403 })`. Security vulnerability.
3. **Configure ESLint** - Create `.eslintrc.json` with `next/core-web-vitals`. Enables automated quality checks.
4. **Fix mobile TypeScript errors** - SafeAreaView style prop on auth screens.
5. **Add isInstagramUrl check to web scan page** - Instagram URLs on web bypass dedicated handler.
6. **Backfill empty descriptions** - 15 recipes need AI-generated descriptions.
7. **Add NOT NULL constraint on recipe description** - Enforce at DB level after backfill.
8. **Route admin pages through /api/admin** - Remove direct supabaseAdmin imports from admin page server components.
9. **Remove hardcoded hex colors** - 3 files using raw hex instead of theme tokens (excluding PDF which is acceptable).
10. **Clean up barman/beer tables** - 15 unrelated tables from another project.
11. **Mobile import pipeline: wire title translation + moderation** - Currently only web imports trigger these.
12. **Configure Stripe** - Unblock the subscription system entirely.

---

## Appendix: Data Collection Commands

All data in this report was collected via:
- SSH to RPi5 (`ssh rasp@rpi5-eth`)
- PostgreSQL queries via `docker compose exec -T db psql`
- Local TypeScript checks (`npx tsc --noEmit`)
- Local grep/search across source files
- PM2 status check on RPi5

No changes were made to any file, database, or configuration during this audit.
