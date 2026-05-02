# Prompt: ChefsBook — Full Functional Test Suite

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/functional-test.md fully and autonomously. This is a read-only audit — do not modify any application code, database, or config files. Run every test case, record pass/fail with evidence, and save the report to docs/functional-test-findings.md. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: AUDIT — READ-ONLY. NO CODE CHANGES.

This session produces a report only. Zero application code is written or modified.
The only file created is `docs/functional-test-findings.md`.

---

## Agent files to read — ALL of these, in order, before starting

- `.claude/agents/wrapup.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/testing.md`

Do NOT read deployment.md or any other agent — this is not a build session.
Do NOT run migrations or builds.

---

## Setup: before running any tests

### Accounts needed

You will need three test accounts at different plan tiers. Check CLAUDE.md for
admin credentials. For the other tiers, check if test accounts already exist:

```bash
ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres \
  -c \"SELECT u.email, p.plan_tier, p.account_status FROM auth.users u JOIN user_profiles p ON p.user_id = u.id ORDER BY u.created_at LIMIT 20;\""
```

You need:
- **Admin account** — from CLAUDE.md (a@aol.com)
- **Chef plan account** — find one or note it's missing
- **Free plan account** — find one or note it's missing

### Get auth tokens

For each account you'll test with, get a JWT:
```bash
curl -s -X POST "https://api.chefsbk.app/auth/v1/token?grant_type=password" \
  -H "apikey: <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"<email>","password":"<password>"}' | jq -r '.access_token'
```

Store as: `ADMIN_TOKEN`, `CHEF_TOKEN`, `FREE_TOKEN`

### Find test data IDs

```bash
# A public recipe ID
ssh rasp@rpi5-eth "psql ... -c \"SELECT id, title FROM recipes WHERE visibility='public' AND is_personal_version=false LIMIT 3;\""

# A saved recipe (recipe_saves row exists for the chef user)
ssh rasp@rpi5-eth "psql ... -c \"SELECT rs.recipe_id, r.title FROM recipe_saves rs JOIN recipes r ON r.id=rs.recipe_id LIMIT 3;\""

# A menu ID
ssh rasp@rpi5-eth "psql ... -c \"SELECT id, name FROM menus LIMIT 3;\""

# A printed_cookbook ID
ssh rasp@rpi5-eth "psql ... -c \"SELECT id, title FROM printed_cookbooks LIMIT 3;\""
```

---

## Severity ratings

- **CRITICAL** — Feature is broken, returns unexpected error, or data is wrong. Blocks users.
- **HIGH** — Feature partially works but has a significant failure in a common case.
- **MEDIUM** — Feature works but behaves incorrectly in an edge case.
- **LOW** — Minor inconsistency or missing error message.
- **PASS** — Behaves correctly.

---

## Section 1: Auth & account

### 1.1 — Sign up (new account)
```bash
curl -s -X POST "https://api.chefsbk.app/auth/v1/signup" \
  -H "apikey: <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test-audit-<timestamp>@example.com","password":"TestPass123!"}' | jq .
```
**Expect**: user created, `user_profiles` row exists, welcome email queued

### 1.2 — Sign in (valid credentials)
```bash
curl -s -X POST "https://api.chefsbk.app/auth/v1/token?grant_type=password" \
  -H "apikey: <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"<admin_email>","password":"<password>"}' | jq '{access_token: .access_token[0:20], user_id: .user.id}'
```
**Expect**: access_token returned, non-null

### 1.3 — Sign in (wrong password)
**Expect**: 400 with error message, NOT 500

### 1.4 — Auth-required route without token
```bash
curl -s "https://chefsbk.app/api/recipes" | jq .
```
**Expect**: 401 Unauthorized, NOT a data leak

### 1.5 — Password reset email
```bash
curl -s -X POST "https://api.chefsbk.app/auth/v1/recover" \
  -H "apikey: <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"<admin_email>"}' | jq .
```
**Expect**: 200, email sent (check Resend logs or inbox)

---

## Section 2: Recipe CRUD

### 2.1 — Create recipe (Chef user)
```bash
curl -s -X POST "https://chefsbk.app/api/recipes" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Audit Test Recipe",
    "description": "Created by functional test",
    "servings": 4,
    "visibility": "private"
  }' | jq '{id: .id, title: .title}'
```
**Expect**: recipe created with returned ID. Save as `TEST_RECIPE_ID`.

### 2.2 — Create recipe (Free user)
```bash
curl -s -X POST "https://chefsbk.app/api/recipes" \
  -H "Authorization: Bearer $FREE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Should fail","description":"test","servings":2,"visibility":"private"}' | jq .
```
**Expect**: 403 PLAN_REQUIRED — Free users cannot create recipes

### 2.3 — Edit recipe (owner)
```bash
curl -s -X PATCH "https://chefsbk.app/api/recipes/$TEST_RECIPE_ID" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Audit Test Recipe (Edited)"}' | jq '{id: .id, title: .title}'
```
**Expect**: title updated

### 2.4 — Edit recipe (non-owner)
```bash
curl -s -X PATCH "https://chefsbk.app/api/recipes/$TEST_RECIPE_ID" \
  -H "Authorization: Bearer $FREE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Stolen edit"}' | jq .
```
**Expect**: 403 or 404 — non-owner cannot edit

### 2.5 — Visibility change (private → public)
```bash
curl -s -X PATCH "https://chefsbk.app/api/recipes/$TEST_RECIPE_ID" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"visibility":"public"}' | jq '{visibility: .visibility}'
```
**Expect**: visibility = "public"

### 2.6 — Public recipe visible without auth
```bash
curl -s "https://chefsbk.app/api/recipes/$TEST_RECIPE_ID" | jq '{title: .title, visibility: .visibility}'
```
**Expect**: recipe returned, no auth needed

### 2.7 — Delete recipe (owner)
Save this for last — delete the test recipe created in 2.1:
```bash
curl -s -X DELETE "https://chefsbk.app/api/recipes/$TEST_RECIPE_ID" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq .
```
**Expect**: 200 or 204. Confirm via psql: recipe row is gone.

---

## Section 3: Import pipeline

### 3.1 — URL import (happy path — known-good site)
```bash
curl -s -X POST "https://chefsbk.app/api/import/url" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.seriouseats.com/the-best-slow-cooked-bolognese-sauce-recipe"}' | jq '{title: .recipe.title, ingredientCount: (.recipe.ingredients | length)}'
```
**Expect**: recipe returned with title and at least 5 ingredients

### 3.2 — URL import (duplicate — same URL twice)
Run the same URL as 3.1 again:
**Expect**: response includes `duplicate: true` and `existingRecipe` — NOT a second copy created

### 3.3 — URL import (blocked/JS-heavy site)
```bash
curl -s -X POST "https://chefsbk.app/api/import/url" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.seriouseats.com"}' | jq '{status: .status, needsBrowserExtraction: .needsBrowserExtraction}'
```
**Expect**: Either 206 with `needsBrowserExtraction: true`, or a recipe if page has structured data

### 3.4 — URL import (non-recipe page)
```bash
curl -s -X POST "https://chefsbk.app/api/import/url" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.bbc.com/news"}' | jq .
```
**Expect**: error or `not_a_recipe` verdict — NOT a blank recipe created

### 3.5 — URL import (Free user)
```bash
curl -s -X POST "https://chefsbk.app/api/import/url" \
  -H "Authorization: Bearer $FREE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.seriouseats.com/the-best-slow-cooked-bolognese-sauce-recipe"}' | jq .
```
**Expect**: 403 PLAN_REQUIRED

### 3.6 — Instagram URL rejected from standard import
```bash
curl -s -X POST "https://chefsbk.app/api/import/url" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.instagram.com/p/test123/"}' | jq .
```
**Expect**: redirect or rejection — Instagram URLs must NOT go through standard import

### 3.7 — Finalize endpoint (completeness check)
```bash
# Use a recipe ID that was just imported
curl -s -X POST "https://chefsbk.app/api/recipes/$IMPORTED_RECIPE_ID/finalize" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq '{isComplete: .isComplete, missingFields: .missingFields}'
```
**Expect**: isComplete boolean, missingFields array (empty if complete)

---

## Section 4: Personal versions (Ask Sous Chef)

### 4.1 — Ask Sous Chef (Free user — should be gated)
```bash
curl -s -X POST "https://chefsbk.app/api/recipes/$PUBLIC_RECIPE_ID/ask-sous-chef" \
  -H "Authorization: Bearer $FREE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"feedback":"Add more garlic","baseVersion":"original"}' | jq .
```
**Expect**: 403 PLAN_REQUIRED

### 4.2 — Ask Sous Chef (unauthenticated)
```bash
curl -s -X POST "https://chefsbk.app/api/recipes/$PUBLIC_RECIPE_ID/ask-sous-chef" \
  -H "Content-Type: application/json" \
  -d '{"feedback":"Add more garlic","baseVersion":"original"}' | jq .
```
**Expect**: 401

### 4.3 — Ask Sous Chef on own recipe (should be blocked — feature is for saved recipes only)
```bash
# Use a recipe owned by the chef user
curl -s -X POST "https://chefsbk.app/api/recipes/$CHEF_OWNED_RECIPE_ID/ask-sous-chef" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"feedback":"Add more garlic","baseVersion":"original"}' | jq .
```
**Expect**: 403 — cannot ask Sous Chef on your own recipe

### 4.4 — Ask Sous Chef (Chef user on saved recipe — happy path)
```bash
# Recipe must be in recipe_saves for this user
curl -s -X POST "https://chefsbk.app/api/recipes/$SAVED_RECIPE_ID/ask-sous-chef" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"feedback":"The sauce needs more acidity — add lemon juice","baseVersion":"original"}' | jq '{title: .title, ingredientCount: (.ingredients | length)}'
```
**Expect**: regenerated recipe returned (title, ingredients, steps). NOT yet saved.

### 4.5 — Save personal version (V1)
```bash
curl -s -X POST "https://chefsbk.app/api/recipes/$SAVED_RECIPE_ID/personal-versions" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Version 1","description":"With extra lemon","ingredients":[{"ingredient":"lemon juice","quantity":"2","unit":"tbsp","sort_order":1}],"steps":[{"step_number":1,"instruction":"Add lemon juice at the end"}]}' | jq '{id: .id, slot: .personal_version_slot}'
```
**Expect**: version created, `personal_version_slot: 1`

### 4.6 — Personal version does NOT appear in public search
```bash
curl -s "https://chefsbk.app/api/recipes?search=My+Version+1" | jq '[.[] | select(.is_personal_version==true)] | length'
```
**Expect**: 0 — personal versions never surface publicly

### 4.7 — Modifier pill created on original recipe
```bash
ssh rasp@rpi5-eth "psql ... -c \"SELECT COUNT(*) FROM recipe_modifiers WHERE recipe_id='$SAVED_RECIPE_ID';\""
```
**Expect**: 1 row (the chef user who created V1)

---

## Section 5: Menus

### 5.1 — Create menu
```bash
curl -s -X POST "https://chefsbk.app/api/menus" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Audit Test Menu","occasion":"dinner_party"}' | jq '{id: .id, name: .name}'
```
**Expect**: menu created. Save as `TEST_MENU_ID`.

### 5.2 — Add recipe to menu
```bash
curl -s -X POST "https://chefsbk.app/api/menus/$TEST_MENU_ID/recipes" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"'$PUBLIC_RECIPE_ID'","course":"main"}' | jq .
```
**Expect**: recipe added to menu under "main" course

### 5.3 — Fetch menu (private — owner)
```bash
curl -s "https://chefsbk.app/api/menus/$TEST_MENU_ID" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq '{name: .name, recipeCount: (.items | length)}'
```
**Expect**: menu returned with 1 item

### 5.4 — Fetch menu (private — unauthenticated)
```bash
curl -s "https://chefsbk.app/api/menus/$TEST_MENU_ID" | jq .
```
**Expect**: 403 or 404 — private menu not accessible without auth

### 5.5 — Make menu public
```bash
curl -s -X PATCH "https://chefsbk.app/api/menus/$TEST_MENU_ID" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_public":true}' | jq '{is_public: .is_public}'
```

### 5.6 — Fetch public menu (unauthenticated)
```bash
curl -s "https://chefsbk.app/menu/$TEST_MENU_ID" | head -c 200
```
**Expect**: HTML page renders (200 OK), not a redirect to login

---

## Section 6: Meal plan

### 6.1 — Add recipe to meal plan day
```bash
curl -s -X POST "https://chefsbk.app/api/meal-plan" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"'$PUBLIC_RECIPE_ID'","date":"2026-05-05","mealType":"dinner","servings":4}' | jq .
```
**Expect**: 200 with plan entry

### 6.2 — Fetch meal plan for week
```bash
curl -s "https://chefsbk.app/api/meal-plan?start=2026-05-04&end=2026-05-10" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq 'length'
```
**Expect**: array of plan entries, count ≥ 1

### 6.3 — Meal plan unauthenticated
```bash
curl -s "https://chefsbk.app/api/meal-plan?start=2026-05-04&end=2026-05-10" | jq .
```
**Expect**: 401

---

## Section 7: Shopping list

### 7.1 — Create shopping list
```bash
curl -s -X POST "https://chefsbk.app/api/shopping-lists" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Audit Test List"}' | jq '{id: .id, name: .name}'
```
**Expect**: list created. Save as `TEST_LIST_ID`.

### 7.2 — Add item to list
```bash
curl -s -X POST "https://chefsbk.app/api/shopping-lists/$TEST_LIST_ID/items" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ingredient":"Lemons","quantity":"4","unit":null}' | jq .
```
**Expect**: item added

### 7.3 — Fetch list items
```bash
curl -s "https://chefsbk.app/api/shopping-lists/$TEST_LIST_ID" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq '{itemCount: (.items | length)}'
```
**Expect**: 1 item

### 7.4 — Another user cannot read this list
```bash
curl -s "https://chefsbk.app/api/shopping-lists/$TEST_LIST_ID" \
  -H "Authorization: Bearer $FREE_TOKEN" | jq .
```
**Expect**: 403 or 404

---

## Section 8: Social features

### 8.1 — Like a recipe (Chef user)
```bash
curl -s -X POST "https://chefsbk.app/api/recipes/$PUBLIC_RECIPE_ID/like" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq .
```
**Expect**: 200, liked

### 8.2 — Like a recipe (Free user — should be plan-gated)
```bash
curl -s -X POST "https://chefsbk.app/api/recipes/$PUBLIC_RECIPE_ID/like" \
  -H "Authorization: Bearer $FREE_TOKEN" | jq .
```
**Expect**: 403 PLAN_REQUIRED

### 8.3 — Save a public recipe (recipe_saves)
```bash
curl -s -X POST "https://chefsbk.app/api/recipes/$PUBLIC_RECIPE_ID/save" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq .
```
**Expect**: save row created

### 8.4 — Comment on a recipe (Chef user)
```bash
curl -s -X POST "https://chefsbk.app/api/recipes/$PUBLIC_RECIPE_ID/comments" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Great recipe, loved the technique!"}' | jq '{id: .id, body: .body}'
```
**Expect**: comment created with AI moderation result

### 8.5 — Comment (Free user — should be plan-gated)
```bash
curl -s -X POST "https://chefsbk.app/api/recipes/$PUBLIC_RECIPE_ID/comments" \
  -H "Authorization: Bearer $FREE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"test comment"}' | jq .
```
**Expect**: 403 PLAN_REQUIRED

### 8.6 — Follow a chef (Chef user)
```bash
# Get a chef user ID that isn't the current user
ssh rasp@rpi5-eth "psql ... -c \"SELECT user_id FROM user_profiles WHERE plan_tier='chef' AND user_id != '<chef_user_id>' LIMIT 1;\""

curl -s -X POST "https://chefsbk.app/api/follow/$OTHER_USER_ID" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq .
```
**Expect**: follow created

### 8.7 — Follow (Free user — should be plan-gated)
```bash
curl -s -X POST "https://chefsbk.app/api/follow/$OTHER_USER_ID" \
  -H "Authorization: Bearer $FREE_TOKEN" | jq .
```
**Expect**: 403 PLAN_REQUIRED

---

## Section 9: AI features

### 9.1 — Generate missing ingredients
```bash
# Use a recipe with title + steps but no ingredients
curl -s -X POST "https://chefsbk.app/api/recipes/$INCOMPLETE_RECIPE_ID/generate-ingredients" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq '{ingredientCount: (. | length)}'
```
**Expect**: array of generated ingredients returned for preview (not auto-saved)

### 9.2 — Generate recipe image
```bash
curl -s -X POST "https://chefsbk.app/api/recipes/$CHEF_RECIPE_ID/generate-image" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq '{status: .status}'
```
**Expect**: generation queued (async), poll `/api/recipes/$id/image-status`

### 9.3 — Image status polling
```bash
curl -s "https://chefsbk.app/api/recipes/$CHEF_RECIPE_ID/image-status" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq '{status: .status, url: .url}'
```
**Expect**: status = "pending" | "complete" | "failed"

### 9.4 — Recipe translation
```bash
curl -s -X POST "https://chefsbk.app/api/recipes/$PUBLIC_RECIPE_ID/translate" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"fr"}' | jq '{title: .title}' 
```
**Expect**: translated title in French returned

---

## Section 10: Print cookbook

### 10.1 — List cookbooks
```bash
curl -s "https://chefsbk.app/api/print-cookbook" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq 'length'
```
**Expect**: array of cookbooks (may be empty)

### 10.2 — Create cookbook
```bash
curl -s -X POST "https://chefsbk.app/api/print-cookbook" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Audit Test Cookbook"}' | jq '{id: .id, title: .title}'
```
**Expect**: cookbook created. Save as `TEST_COOKBOOK_ID`.

### 10.3 — Generate PDF
```bash
curl -s -X POST "https://chefsbk.app/api/print-cookbooks/$TEST_COOKBOOK_ID/generate" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq .
```
**Expect**: PDF generation triggered. Check Supabase Storage for resulting file URL.

### 10.4 — Print cookbook (Free user — Pro only)
```bash
curl -s "https://chefsbk.app/api/print-cookbook" \
  -H "Authorization: Bearer $FREE_TOKEN" | jq .
```
**Expect**: 403 PLAN_REQUIRED

---

## Section 11: Data isolation & security

### 11.1 — Personal versions excluded from public recipe list
```bash
curl -s "https://chefsbk.app/api/recipes?visibility=public" | jq '[.[] | select(.is_personal_version==true)] | length'
```
**Expect**: 0

### 11.2 — Personal versions excluded from search RPC
```bash
ssh rasp@rpi5-eth "psql ... -c \"SELECT COUNT(*) FROM search_recipes('test', NULL, NULL, NULL, NULL, NULL, 20, 0) WHERE is_personal_version=TRUE;\""
```
**Expect**: 0

### 11.3 — is_personal_version filter in listPublicRecipes
Grep the codebase (read-only):
```bash
grep -n "is_personal_version" packages/db/src/queries/recipes.ts
```
**Expect**: filter present in listPublicRecipes, listRecipes, and any other public-facing query functions

### 11.4 — Expelled user content hidden
```bash
# Find an expelled user if any exist
ssh rasp@rpi5-eth "psql ... -c \"SELECT user_id FROM user_profiles WHERE account_status='expelled' LIMIT 1;\""
# Then check their recipes don't appear in public feed
```
**Expect**: expelled user recipes filtered from public feed

### 11.5 — RLS: user cannot read another user's private recipe
```bash
# Get a private recipe ID owned by the admin user
ssh rasp@rpi5-eth "psql ... -c \"SELECT id FROM recipes WHERE visibility='private' LIMIT 1;\""
curl -s "https://chefsbk.app/api/recipes/$PRIVATE_RECIPE_ID" \
  -H "Authorization: Bearer $FREE_TOKEN" | jq .
```
**Expect**: 403 or 404 — not the recipe content

### 11.6 — Tag block enforcement
```bash
# Check a known blocked tag is in the blocked_tags table
ssh rasp@rpi5-eth "psql ... -c \"SELECT tag, reason FROM blocked_tags LIMIT 5;\""
# Then try to add a blocked tag to a recipe you own
```
**Expect**: tag rejected with "That tag isn't allowed on Chefsbook"

---

## Section 12: Admin routes (auth guard only — not content audit)

These tests confirm admin routes are protected. Do not evaluate admin feature content.

### 12.1 — Admin route without auth
```bash
curl -s "https://chefsbk.app/api/admin?page=users" | jq .
```
**Expect**: 401 or redirect to login

### 12.2 — Admin route with non-admin user
```bash
curl -s "https://chefsbk.app/api/admin?page=users" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq .
```
**Expect**: 403 Forbidden

### 12.3 — Admin route with admin user
```bash
curl -s "https://chefsbk.app/api/admin?page=users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq 'length'
```
**Expect**: user list returned

---

## Section 13: Webhooks & background jobs

### 13.1 — Cron endpoint (requires secret)
```bash
curl -s -X POST "https://chefsbk.app/api/cron" \
  -H "x-cron-secret: wrong-secret" | jq .
```
**Expect**: 401 or 403 — secret required

### 13.2 — Lulu webhook (requires secret)
```bash
curl -s -X POST "https://chefsbk.app/api/webhooks/lulu" \
  -H "Content-Type: application/json" \
  -d '{"event":"order_status_changed","status":"SHIPPED"}' | jq .
```
**Expect**: 401 or 400 — webhook secret required, or signature validation failure

---

## Section 14: Edge cases & regression checks

### 14.1 — Import URL with skipDuplicateCheck flag
```bash
curl -s -X POST "https://chefsbk.app/api/import/url" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.seriouseats.com/the-best-slow-cooked-bolognese-sauce-recipe","skipDuplicateCheck":true}' | jq '{title: .recipe.title}'
```
**Expect**: fresh import returned even if already imported (no duplicate block)

### 14.2 — Re-import uses skipDuplicateCheck
Navigate to a recipe detail page on the web app (use browser tool), click Re-import.
**Expect**: import succeeds. Check that the previous bug (TypeError on `.recipe.description`) does not recur.

### 14.3 — Recipe visibility: shared_link treated as public
```bash
# Create a recipe with visibility=shared_link and confirm it appears in public queries
curl -s -X POST "https://chefsbk.app/api/recipes" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Shared Link Test","description":"test","servings":2,"visibility":"shared_link"}' | jq '{id: .id}'
# Then confirm it's accessible without auth via its ID
```
**Expect**: shared_link recipe IS accessible via direct URL without auth (it's semi-public)

### 14.4 — Load More pagination returns correct page
```bash
curl -s "https://chefsbk.app/api/recipes?limit=50&offset=0" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq 'length'
curl -s "https://chefsbk.app/api/recipes?limit=50&offset=50" \
  -H "Authorization: Bearer $CHEF_TOKEN" | jq 'length'
```
**Expect**: first page returns ≤50, second page returns next batch (or 0 if < 50 total)

### 14.5 — Recipe ↔ Technique conversion (if applicable)
```bash
curl -s -X POST "https://chefsbk.app/api/convert/recipe-to-technique" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"'$CHEF_RECIPE_ID'"}' | jq '{techniqueId: .id}'
```
**Expect**: technique created, original recipe deleted

### 14.6 — Supabase multi-FK join (PGRST201 regression)
```bash
# Bulk visibility change — this was the bug in P-217
curl -s -X POST "https://chefsbk.app/api/recipes/bulk-visibility" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipeIds":["'$CHEF_RECIPE_ID'"],"visibility":"private"}' | jq .
```
**Expect**: 200 success, NOT "None of the selected recipes belong to you" PGRST201 error

---

## Output format

Save findings to `docs/functional-test-findings.md` using this structure:

```markdown
# ChefsBook Functional Test Report
Date: [today]
Environment: https://chefsbk.app (RPi5 production)
Tester: Claude Code (automated audit)

## Summary
Total tests: N
Pass: N | Fail (CRITICAL): N | Fail (HIGH): N | Fail (MEDIUM): N | Skipped: N

## Critical Failures
[List — fix before launch]

## High Priority Failures
[List]

## Medium Priority Failures
[List]

## Test Results

### Section 1: Auth & account
| Test | Result | Evidence |
|------|--------|----------|
| 1.1 Sign up | PASS/FAIL | [response snippet] |
...

### Section 2: Recipe CRUD
...

[Continue for all 14 sections]

## Skipped Tests
[List any tests that couldn't run and why — missing test data, connectivity, etc.]

## Recommended Fix Order
[Numbered — highest severity and user impact first]
```

---

## Constraints

- **Read-only**: Do not modify any application code, database rows, or config.
  Exception: you may create temporary test data (recipes, menus, etc.) via API calls
  as part of the tests, but clean them up at the end of the session via DELETE calls.
- **No assumptions**: If a test returns an unexpected response, log it as a finding.
  Do not rationalize unexpected behavior.
- **Evidence required**: Every FAIL entry must include the actual response received
  and what was expected.
- **No wrapup session**: Do not update DONE.md or feature-registry.md.
- **Cleanup**: At session end, DELETE any test data created:
  - `TEST_RECIPE_ID` (if not already deleted in 2.7)
  - `TEST_MENU_ID`
  - `TEST_LIST_ID`
  - `TEST_COOKBOOK_ID`
  - Any personal versions created during testing
