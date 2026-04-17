# CHEFSBOOK DEVELOPMENT AGENDA

Generated: 2026-03-29
Ordered by: impact to users + unblocks other features + fixes broken promises

---

## TIER 1 — CRITICAL FIXES (broken or misleading right now)

These ship before anything else. Users are already hitting these.

| # | Feature | Why critical | Effort |
|---|---------|-------------|--------|
| 1 | Import summary show failures + retry | Users don't know what failed or why | S |
| 2 | Ingredient editing UX (inline, not raw textarea) | Current edit is unusable | M |
| 3 | Search recipes (wire `search_recipes()` RPC to dashboard) | Core feature, DB ready, just not wired | S |
| 4 | Favourite toggle UI (heart/star button on cards + detail) | Filter pill exists but nothing to trigger it | S |
| 5 | Recipe image remote patterns (`next.config.ts`) | Images broken for non-Supabase domains | S |

## UI CLEANUP FOLLOW-UPS

- Raw `window.alert()` sweep (apps/web): ~40 remaining call sites across dashboard/*, components/*, app/share, app/technique, app/recipe/[id] (PDF + flag paths). Session 199 cleaned the two sites inside the recipe detail Re-import/Delete handlers; ui-guardian.md forbids native alerts. Follow-up session should replace remaining with `useAlertDialog` from `@/components/useConfirmDialog`.

## BUILD / PROMPT HYGIENE

- **Update `docs/prompts/200-rebuild-mobile-apk.md` Step 2** (noted in session 202): change "confirm react/react-dom exist in apps/mobile/node_modules, copy from root if missing" → "only copy if the gradle build's `:app:createBundleReleaseJsAndAssets` step fails with `Unable to resolve module react/jsx-runtime` MODULE_NOT_FOUND". Add a one-line pointer to `metro.config.js` blockList as the reason root hoisting doesn't reach Metro in release builds. Prevents the next rebuilder from defensively creating the duplicate-copy arrangement that CLAUDE.md's Metro blockList is specifically configured to prevent (session 138).

## AI ROBUSTNESS FOLLOW-UPS

- Audit remaining `callClaude()` callers for appropriate `maxTokens` — `cookbookTOC()`, `scanRecipeMultiPage()`, `generateMealPlan()`, `generateDishRecipe()`, `importFromYouTube()`, `importTechnique()` likely need raises too. Session 201 raised only `importFromUrl` (3000→6000). After that session, any of these callers hitting the cap on complex input will throw `ClaudeTruncatedError` instead of returning garbage — correct behavior, but the first complex cookbook TOC / multi-page scan / dish generation request to trip it will fail user-visibly. Per-caller budget review + raise where needed.

## TIER 2 — COMPLETE HALF-BUILT FEATURES

Backend or partial UI exists. Just needs finishing.

| # | Feature | What exists | What's missing | Effort |
|---|---------|------------|---------------|--------|
| 6 | Cooking notes UI | Full backend CRUD | Recipe detail page wiring | S |
| 7 | Steps inline editing | Bulk textarea exists | Same inline treatment as ingredients | M |
| 8 | Add to shopping list from recipe | Shopping list system exists | Button on recipe page to push ingredients | S |
| 9 | Technique manual entry form | Techniques table + import | Manual "Add Technique" form UI | M |
| 10 | Technique Chrome extension support | Extension import works for recipes | Auto-detect technique in extension flow | S |
| 11 | Discover page | `get_public_feed()` DB function exists | No UI | M |
| 12 | Followers UI | `follows` table + DB schema exists | No follow/unfollow UI or social feed | L |

## TIER 3 — COMMITTED ON HOMEPAGE/PRICING (must build before charging)

These are promised to paying users. Legal/trust risk if absent.

| # | Feature | Where promised | Effort |
|---|---------|--------------|--------|
| 13 | Meal planning drag-and-drop | Homepage hero feature card | L |
| 14 | Plan tier feature gating | Implied by entire pricing page | M |
| 15 | 14-day free trial logic | Pricing page footer | M |
| 16 | Shared shopping lists | Family tier | L |
| 17 | Shared meal plans | Family tier | L |
| 18 | Family member invite UI (up to 6) | Family tier | L |
| 19 | Family cookbook | Family tier | XL |
| 20 | Priority support system | Pro tier | M |

## TIER 4 — HIGH VALUE NEW FEATURES

Not promised anywhere but high user impact.

| # | Feature | Why it matters | Effort |
|---|---------|--------------|--------|
| 21 | Recipe collection view modes (Grid/List/Table) | Power users need to navigate large collections | M |
| 22 | Shared with Me system | Social/viral growth mechanic | L |
| 23 | Extension install flow + production URL fix | Onboarding + removes manual setup friction | M |
| 24 | Import failure handling improvements | ScrapingBee, Puppeteer already built, needs UI | S |
| 25 | Substack integration | Users share recipes via Substack newsletters — import from Substack posts, publish recipes as Substack posts | L |

## TIER 5 — POLISH & INFRASTRUCTURE

Important but not user-facing blockers.

| # | Feature | Why it matters | Effort |
|---|---------|--------------|--------|
| 25 | README.md | Onboarding for contributors | S |
| 26 | Fix stale dark mode refs in mobile | Inconsistent theme | S |
| 27 | Test suite | Zero tests is a time bomb | XL |
| 28 | Chrome Web Store publish | Removes manual install friction | M |
| 29 | Firefox extension support | `browser.*` namespace migration | M |

---

## RECOMMENDED BUILD ORDER FOR AGENTS

### SESSION 1 (today's remaining work)

Focus: Tier 1 quick wins — all S effort, immediate user impact

1. Import summary with failure details + retry button
2. Search wired to dashboard
3. Favourite toggle UI (heart button on cards + detail page)
4. Recipe image remote patterns fix
5. Cooking notes UI (backend already done)

### SESSION 2

Focus: Finish the editing experience

6. Ingredient inline editing (Option A — per-field row editing)
7. Steps inline editing (same treatment)
8. Add to shopping list button on recipe page

### SESSION 3

Focus: Complete technique content type

9. Technique manual entry form
10. Technique Chrome extension auto-detect

### SESSION 4

Focus: Pricing page integrity

11. Plan tier feature gating (checks `plan_tier` before premium actions)
12. 14-day free trial logic in Stripe integration

### SESSION 5

Focus: Meal planning (the big homepage promise)

13. Drag-and-drop onto weekly calendar
14. Scope and start Family tier features

### SESSION 6+

- Recipe collection view modes
- Shared with Me system
- Extension install flow
- Discover page / social feed
- Family tier features (Shared lists, shared plans, family cookbook)

---

## TIER 6 — IMPORT QUALITY (extraction accuracy)

| # | Feature | Problem | Effort |
|---|---------|---------|--------|
| 30 | YouTube description link follower | Videos link to recipe page in description; we miss the ingredients | M |
| 31 | Chrome extension full DOM capture | Extension may miss dynamically-rendered recipe plugin content | S |
| 32 | Claude extraction prompt: require quantities | Ingredients imported without quantities when page has them | S |
| 33 | JSON-LD structured data extraction | Primary source when available, more reliable than text scraping | M |
| 34 | Ingredient validation/cross-check | Count ingredients vs JSON-LD, prefer structured data on mismatch | S |
| 35 | Equipment field extraction | Equipment mixed into ingredients list | S |
| 36 | Ingredient group preservation | "For the sauce:" groups getting flattened | S |

## TIER 7 — KNOWN BUGS (reported, not yet fixed)

| # | Feature | Problem | Effort |
|---|---------|---------|--------|
| 37 | Ingredient quantities missing after re-import | JSON-LD extraction parses quantities but they don't appear in the UI after re-import — investigate whether `extractJsonLdRecipe` quantity parsing fails for fraction chars (½, ⅓) or if `replaceIngredients` drops them | S |
| 38 | Shopping list: calendar meal plan import | No way to generate a shopping list from a week's meal plan via the UI — `generateShoppingListFromMealPlans()` DB function exists but is not wired to the planner or shop page | M |
| 39 | Shopping list: overall UX polish | Needs: add items manually, edit quantities, rename lists, merge duplicate ingredients, aisle auto-assignment, share list | L |

---

## EFFORT KEY

S = half day | M = 1-2 days | L = 3-5 days | XL = 1+ week
