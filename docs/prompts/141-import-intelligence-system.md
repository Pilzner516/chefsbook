# ChefsBook — Session 141: Import Intelligence System
# Source: Strategic review — import quality, completeness gates, site compatibility
# Target: packages/ai + packages/db + apps/web + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, import-pipeline.md,
ai-cost.md, and ALL mandatory agents per SESSION START sequence.

This is a large multi-part feature. Build all parts completely.
The import_site_tracker table already exists (session 116) — extend it.
The moderateRecipe() function already exists — extend it.

---

## PART 1 — DATABASE MIGRATIONS

### Migration 036: Extend import_site_tracker

```sql
ALTER TABLE import_site_tracker
  ADD COLUMN IF NOT EXISTS rating INT DEFAULT NULL
    CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_auto_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_test_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS failure_taxonomy JSONB DEFAULT '{}',
  -- failure_taxonomy stores counts like:
  -- {"missing_ingredients": 12, "missing_amounts": 8,
  --  "missing_steps": 3, "missing_title": 1, "partial_ingredients": 15}
  ADD COLUMN IF NOT EXISTS sample_failing_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes TEXT;
```

### Migration 036: import_attempts log table

```sql
CREATE TABLE import_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  failure_reason TEXT,
  -- What was missing:
  missing_title BOOLEAN DEFAULT false,
  missing_description BOOLEAN DEFAULT false,
  missing_ingredients BOOLEAN DEFAULT false,
  missing_amounts BOOLEAN DEFAULT false,
  missing_steps BOOLEAN DEFAULT false,
  ingredient_count INT DEFAULT 0,
  step_count INT DEFAULT 0,
  -- AI completeness check result
  ai_completeness_verdict TEXT
    CHECK (ai_completeness_verdict IN ('complete','incomplete','not_a_recipe','flagged',NULL))
);

CREATE INDEX ON import_attempts(domain, attempted_at DESC);
CREATE INDEX ON import_attempts(user_id, attempted_at DESC);
CREATE INDEX ON import_attempts(success);

ALTER TABLE import_attempts ENABLE ROW LEVEL SECURITY;
-- Users can read their own attempts
CREATE POLICY "users read own" ON import_attempts FOR SELECT
  USING (user_id = auth.uid());
-- Service role only for insert
```

### Migration 036: incomplete_recipes tracking

```sql
-- Add completeness columns to recipes
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS completeness_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS missing_fields TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_recipe_verdict TEXT
    CHECK (ai_recipe_verdict IN ('approved','flagged','not_a_recipe','pending',NULL)),
  ADD COLUMN IF NOT EXISTS ai_verdict_reason TEXT,
  ADD COLUMN IF NOT EXISTS ai_verdict_at TIMESTAMPTZ;

-- All existing recipes with content are provisionally complete
-- (admin can review individually)
UPDATE recipes SET is_complete = true
WHERE title IS NOT NULL
  AND description IS NOT NULL AND description != ''
  AND visibility != 'private';
```

### Migration 036: Scheduled job tracking

```sql
CREATE TABLE scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  schedule TEXT NOT NULL, -- cron expression e.g. '0 3 * * 1' (Monday 3am)
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO scheduled_jobs (job_name, schedule, is_enabled)
VALUES ('site_compatibility_test', '0 3 * * 1', true);
-- Runs Monday 3am weekly
```

---

## PART 2 — RECIPE COMPLETENESS GATE

### 2a — checkRecipeCompleteness() in packages/db

```typescript
interface CompletenessResult {
  isComplete: boolean
  missingFields: string[]
  ingredientCount: number
  hasQuantities: boolean
  stepCount: number
}

export function checkRecipeCompleteness(recipe: Recipe): CompletenessResult {
  const missing: string[] = []

  if (!recipe.title || recipe.title.trim() === '') missing.push('title')
  if (!recipe.description || recipe.description.trim() === '')
    missing.push('description')

  const ingredients = recipe.ingredients ?? []
  const ingredientsWithQty = ingredients.filter(i =>
    i.amount && i.amount > 0 && i.unit && i.name
  )

  if (ingredients.length < 2) missing.push('ingredients (minimum 2)')
  if (ingredientsWithQty.length < Math.min(2, ingredients.length))
    missing.push('ingredient quantities')

  const steps = recipe.steps ?? []
  if (steps.length < 1) missing.push('steps')

  const tags = recipe.tags ?? []
  if (tags.length < 1) missing.push('tags')

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
    ingredientCount: ingredients.length,
    hasQuantities: ingredientsWithQty.length >= 2,
    stepCount: steps.length
  }
}
```

### 2b — isActuallyARecipe() in packages/ai (HAIKU)

New AI check — fast, cheap, runs after completeness check passes:

```typescript
// Uses HAIKU — ~$0.0002 per call
export async function isActuallyARecipe(recipe: {
  title: string
  description?: string
  ingredients: string[]
  steps: string[]
}): Promise<{
  verdict: 'approved' | 'flagged' | 'not_a_recipe'
  reason: string
}>
```

Prompt:
"Review this recipe entry. Determine if it is: (1) a genuine food
recipe suitable for a family cooking app, (2) flagged content
(inappropriate, offensive, or suspicious), or (3) not actually a recipe
(test entry, gibberish, placeholder, or non-food content).

Title: {title}
Description: {description}
First 3 ingredients: {ingredients.slice(0,3).join(', ')}
First step: {steps[0]}

Reply with JSON only: {\"verdict\": \"approved\"|\"flagged\"|\"not_a_recipe\", \"reason\": \"one sentence\"}"

### 2c — Wire completeness gate into ALL import paths

After every recipe creation via import (URL, scan, speak, file):

```typescript
// 1. Check completeness
const completeness = checkRecipeCompleteness(recipe)

// 2. If incomplete: keep private, flag, notify user
if (!completeness.isComplete) {
  await supabaseAdmin.from('recipes').update({
    visibility: 'private',
    is_complete: false,
    missing_fields: completeness.missingFields,
    completeness_checked_at: new Date().toISOString()
  }).eq('id', recipe.id)

  // Return incomplete status to UI
  return {
    recipe,
    isComplete: false,
    missingFields: completeness.missingFields,
    needsReview: true
  }
}

// 3. If complete: run AI recipe check
const aiCheck = await isActuallyARecipe(recipe)
await supabaseAdmin.from('recipes').update({
  ai_recipe_verdict: aiCheck.verdict,
  ai_verdict_reason: aiCheck.reason,
  ai_verdict_at: new Date().toISOString(),
  is_complete: aiCheck.verdict === 'approved',
  visibility: aiCheck.verdict === 'approved' ? recipe.visibility : 'private'
}).eq('id', recipe.id)

// 4. Log the import attempt
await logImportAttempt(url, domain, recipe, completeness, aiCheck)
```

### 2d — User notification after incomplete import

On web (import result shown after scan/import):
```
⚠️  Recipe imported but needs your review

We couldn't extract the following from this page:
• Ingredient quantities
• Recipe steps

[Fill gaps with AI] [Enter manually] [Review later]

This recipe is saved as private until it's complete.
```

On mobile: ChefsDialog with same options.

"Fill gaps with AI" → calls generateAiChefSuggestion() for missing sections
"Enter manually" → opens recipe edit mode focused on missing fields
"Review later" → closes, recipe stays private and flagged

### 2e — Completeness lock on visibility

When a user tries to change visibility from private → public/shared_link:
- Check is_complete first
- If false: show message listing missing fields
  "This recipe isn't ready to share yet. Complete these fields first:
   [list of missing_fields]"
- Block the toggle until all fields are complete AND ai_recipe_verdict = 'approved'

---

## PART 3 — IMPORT ATTEMPT LOGGING

### 3a — logImportAttempt() in packages/db

```typescript
export async function logImportAttempt({
  userId,
  url,
  domain,
  success,
  recipeId,
  failureReason,
  completeness,
  aiVerdict
}: ImportAttemptLog) {
  await supabaseAdmin.from('import_attempts').insert({
    user_id: userId,
    url,
    domain,
    success,
    recipe_id: recipeId ?? null,
    failure_reason: failureReason ?? null,
    missing_title: completeness?.missingFields.includes('title') ?? false,
    missing_description: completeness?.missingFields.includes('description') ?? false,
    missing_ingredients: completeness?.missingFields.some(f =>
      f.includes('ingredient')) ?? false,
    missing_amounts: completeness?.missingFields.includes('ingredient quantities') ?? false,
    missing_steps: completeness?.missingFields.includes('steps') ?? false,
    ingredient_count: completeness?.ingredientCount ?? 0,
    step_count: completeness?.stepCount ?? 0,
    ai_completeness_verdict: aiVerdict ?? null
  })

  // Update import_site_tracker aggregates
  await updateSiteTrackerFromAttempt(domain, success, completeness)
}
```

### 3b — updateSiteTrackerFromAttempt()

Upsert the site tracker after every import:
- Increment total_attempts
- Increment successful_attempts if success
- Update failure_taxonomy JSON counters
- Recalculate status: >80% success = working, 40-80% = partial, <40% = broken
- Add URL to sample_failing_urls if failed (keep last 5)

---

## PART 4 — SITE COMPATIBILITY TESTING AGENT

### 4a — Site list compilation

Create a curated list of 60+ major recipe sites in packages/ai/src/siteList.ts:

Include:
- Major US sites: allrecipes.com, foodnetwork.com, epicurious.com,
  bonappetit.com, food52.com, seriouseats.com, nytcooking.com,
  tasty.co, delish.com, simplyrecipes.com, thekitchn.com,
  smittenkitchen.com, halfbakedharvest.com, minimalistbaker.com,
  cookingclassy.com, sallysbakingaddiction.com, budgetbytes.com,
  ohsheglows.com, pinchofyum.com, skinnytaste.com
- International: bbcgoodfood.com, jamieoliver.com, taste.com.au,
  marmiton.org, chefkoch.de, giallozafferano.it, recetasgratis.net
- Video/social: youtube.com, instagram.com (blocked — note)
- Cookbook publishers: williamssonoma.com, marthastewart.com
- Health-focused: eatingwell.com, cookinglight.com, wholefoodsmarket.com
- Plus: any domain appearing in import_attempts with >3 failures

Export as:
```typescript
export const KNOWN_RECIPE_SITES: string[] = [...]
```

### 4b — testSiteImport() in packages/ai

```typescript
export async function testSiteImport(domain: string): Promise<{
  domain: string
  testUrl: string
  success: boolean
  completeness: CompletenessResult | null
  failureReason: string | null
  durationMs: number
  rating: 1 | 2 | 3 | 4 | 5
}>
```

For each site:
1. Construct a test URL (use a known-good recipe URL or search for one)
2. Call importFromUrl() with the test URL
3. Run checkRecipeCompleteness() on result
4. Calculate rating:
   - 5 = complete import, all fields present
   - 4 = mostly complete, minor gaps
   - 3 = partial (missing some ingredients or amounts)
   - 2 = significant gaps (missing steps or most ingredients)
   - 1 = failed entirely or not a recipe

### 4c — API route for scheduled testing

Create apps/web/app/api/admin/test-sites/route.ts:

```typescript
// POST: run site compatibility tests
// Triggered by: admin manual button OR cron job
// Body: { domains?: string[] } // if empty, test all KNOWN_RECIPE_SITES

export async function POST(req: NextRequest) {
  // Verify admin JWT
  // Run testSiteImport() for each domain (rate limited: 1 per 3 seconds)
  // Update import_site_tracker for each result
  // Return summary: { tested: N, passed: N, failed: N, results: [...] }
}
```

### 4d — Scheduled weekly test (cron)

Add to apps/web/app/api/cron/route.ts (create if not exists):

```typescript
// Called by Vercel cron or a simple setInterval on the server
// Checks scheduled_jobs table for due jobs
// If site_compatibility_test is enabled and due: calls /api/admin/test-sites
// Updates scheduled_jobs.last_run_at + last_run_result
```

For the Pi (no Vercel cron), implement as a PM2 cron job:
```bash
# In ecosystem.config.js or as a separate PM2 process
# Runs weekly: node scripts/run-site-tests.mjs
```

---

## PART 5 — BLOCKED SITE HANDLING

### 5a — Check before import

In the URL import handler, before calling importFromUrl():

```typescript
const { data: siteData } = await supabaseAdmin
  .from('import_site_tracker')
  .select('is_blocked, block_reason, rating')
  .eq('domain', extractDomain(url))
  .single()

if (siteData?.is_blocked) {
  return {
    error: 'site_blocked',
    message: `We're unable to import from ${domain} at this time. ${siteData.block_reason ?? 'This site has been temporarily disabled for import.'}`,
    userMessage: true
  }
}

if (siteData?.rating <= 2) {
  // Show warning but allow import
  warningMessage = "This site has known import issues but don't worry — we'll help you fill any gaps automatically after import."
}
```

### 5b — User-facing blocked message

When a site is blocked, show clearly:
"⛔ Import unavailable from [site name]
This site isn't currently available for import in ChefsBook.
Try: Copy the recipe text and paste it, or take a photo of the recipe."

---

## PART 6 — ADMIN DASHBOARD EXTENSIONS

### 6a — /admin/import-sites (extend existing page)

Add to the existing import sites table:
- **Rating column**: 1-5 stars (⭐ to ⭐⭐⭐⭐⭐), editable by admin
- **Blocked toggle**: on/off switch per site row
- **Block reason**: text input shown when blocked toggle is on
- **Failure taxonomy**: expandable row showing
  {missing_ingredients: N, missing_amounts: N, etc.}
- **Last tested**: timestamp + "Test now" button
- **Auto-test toggle**: enable/disable per site
- **Export button**: downloads full site list as CSV

### 6b — Import KPI section at top of /admin/import-sites

Show summary cards:
- Total import attempts (last 30 days)
- Success rate % (last 30 days)
- Sites with rating ≤ 2 (warning count)
- Blocked sites count
- Incomplete recipes flagged (last 30 days)

### 6c — /admin/incomplete-recipes (new page)

New admin page showing all recipes where is_complete = false
OR ai_recipe_verdict IN ('flagged', 'not_a_recipe'):

Table columns:
- Recipe title (link to recipe detail)
- Owner (@username, clickable → profile)
- Missing fields (pills: "ingredients", "steps", etc.)
- AI verdict (Approved / Flagged / Not a recipe)
- AI verdict reason
- Import source (domain)
- Date imported
- Actions: View recipe | Message user | Force approve | Remove

Add "Incomplete Recipes" to admin sidebar nav.

### 6d — Global scheduled test controls

At top of /admin/import-sites:
```
Site Compatibility Testing
[● Weekly auto-test: ON/OFF toggle]  [Run all tests now]
Last run: Monday Apr 14 at 3:00am — 47 sites tested, 38 passed, 9 flagged
```

---

## PART 7 — USER-FACING METRICS

### 7a — User profile stats (settings page)

Add to the settings page, below plan info:

```
Your Import Activity
📥 47 recipes imported
⚠️  3 had import issues  [View →]
🚩 1 recipe was flagged  [View →]
```

"View →" opens a modal listing:
- For import issues: URL, domain, what was missing, date
- For flagged: recipe title, flag reason, current status

### 7b — Incomplete recipes banner in My Recipes

If user has incomplete recipes (is_complete = false):
Show a dismissible amber banner at top of recipe list:

"⚠️ You have 2 recipes that need attention.
They're saved as private until you complete them. [Review now →]"

"Review now" filters recipe list to show only incomplete recipes.

---

## PART 8 — SPECIALIZED IMPORT AGENT

Create .claude/agents/import-quality.md:

```markdown
# Import Quality Agent
# Read this for any session touching import pipeline, site testing,
# or recipe completeness.

## Responsibility
Monitor and improve recipe import quality across all import paths.

## Pre-flight checklist
- [ ] Check import_site_tracker for the target domain before testing
- [ ] Verify checkRecipeCompleteness() is called after every import
- [ ] Verify logImportAttempt() is called after every import
- [ ] Check isActuallyARecipe() runs on complete recipes

## Known problematic sites (update this list)
- seriouseats.com: ingredients sometimes missing (non-standard JSON-LD)
- nytcooking.com: paywalled, may return partial content
- instagram.com: BLOCKED — use photo import instead
- youtube.com: transcript-based, steps quality varies

## Import success criteria
A successful import must have ALL of:
1. title (non-empty)
2. description (non-empty)
3. ≥2 ingredients WITH quantities
4. ≥1 step
5. ≥1 tag
6. ai_recipe_verdict = 'approved'

## Failure taxonomy
Track failures with these categories:
- missing_title
- missing_description  
- missing_ingredients (< 2 ingredients total)
- missing_amounts (ingredients present but no quantities)
- missing_steps
- not_a_recipe (AI verdict)
- site_blocked
- site_error (HTTP error from source)
- timeout

## Agent responsibilities
- Update known problematic sites list when new issues discovered
- Review import_attempts weekly for new failure patterns
- Propose SCAN_PROMPT improvements when pattern identified
- Maintain KNOWN_RECIPE_SITES list in packages/ai/src/siteList.ts
```

Add import-quality.md to CLAUDE.md agent lookup table:
"Any session touching import pipeline | import-quality.md (ALWAYS)"

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth

# Apply migrations
psql -U postgres -d postgres \
  -f /mnt/chefsbook/repo/supabase/migrations/036_import_intelligence.sql
docker restart supabase-rest

cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

### Database
- [ ] Migration 036 applied: import_site_tracker extended
- [ ] import_attempts table created
- [ ] recipes completeness columns added
- [ ] scheduled_jobs table created
- [ ] PostgREST restarted

### Completeness gate
- [ ] checkRecipeCompleteness() in packages/db
- [ ] isActuallyARecipe() in packages/ai (HAIKU)
- [ ] Gate wired into ALL import paths (URL, scan, speak, file)
- [ ] User notification shown with Fill/Manual/Later options
- [ ] Visibility lock enforced until complete + AI approved

### Import logging
- [ ] logImportAttempt() in packages/db
- [ ] updateSiteTrackerFromAttempt() updates aggregates
- [ ] All import paths call logImportAttempt()

### Site testing
- [ ] KNOWN_RECIPE_SITES list (60+ sites) in packages/ai
- [ ] testSiteImport() function
- [ ] /api/admin/test-sites API route
- [ ] Weekly scheduled job (cron or PM2)
- [ ] Manual trigger from admin dashboard

### Blocked site handling
- [ ] Pre-import domain check against import_site_tracker
- [ ] Blocked sites show friendly message with alternatives
- [ ] Warning shown for rating ≤ 2 sites (not blocked)
- [ ] Warning text: "known import issues but don't worry..."

### Admin pages
- [ ] /admin/import-sites: rating, blocked toggle, block reason, taxonomy
- [ ] /admin/import-sites: KPI cards at top
- [ ] /admin/import-sites: export CSV button
- [ ] /admin/import-sites: scheduled test controls + toggle
- [ ] /admin/incomplete-recipes: new page with all incomplete/flagged recipes
- [ ] Admin sidebar: "Incomplete Recipes" link added

### User metrics
- [ ] Settings page: import activity stats (imported, issues, flagged)
- [ ] My Recipes: amber banner if incomplete recipes exist
- [ ] "View" modals for import issues and flagged recipes

### Import quality agent
- [ ] .claude/agents/import-quality.md created
- [ ] CLAUDE.md agent table updated

### General
- [ ] ai-cost.md updated with isActuallyARecipe() entry
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end, recap what was completed, what was left incomplete,
      and why. List any import paths that still need the gate wired.
