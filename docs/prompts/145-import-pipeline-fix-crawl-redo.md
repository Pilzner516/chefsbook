# ChefsBook — Session 145: Proper Import Pipeline Audit + Crawl Redo
# Source: Session 143 produced unreliable results — agents gave up on 403/404
#         instead of doing real import testing
# Target: packages/ai + apps/web + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, import-pipeline.md,
and import-quality.md before touching anything.

Session 143's crawl was flawed:
- Agents tried one hardcoded URL, got 403/404, and rated the site 1 star
- They never ran the actual importFromUrl() pipeline
- They never found working recipe URLs from homepages
- The result (78% rated 1 star) is wrong — most sites work fine via browser

This session does it properly.

---

## PART 1 — Fix the import pipeline first

Before re-crawling, fix the known code issue:
**Ingredients are not being imported even when they exist on the page.**

The user confirmed: Chrome extension imports work (title, description,
steps come through) but ingredients are missing. This is the highest
priority fix.

### 1a — Diagnose ingredient extraction

Read packages/ai/src/importFromUrl.ts fully.

The extraction pipeline is:
1. JSON-LD first (structured data)
2. Claude gap-fill for missing fields
3. Claude-only fallback

For ingredients specifically, check:

**JSON-LD extraction:**
Does extractJsonLdRecipe() correctly parse the ingredient array?
JSON-LD recipe ingredients can appear as:
- `recipeIngredient: ["2 cups flour", "1 tsp salt"]` — simple strings
- `recipeIngredient: [{"@type": "HowToIngredient", "name": "flour", "amount": "2 cups"}]`
- Sometimes nested inside `recipeInstructions`

**Claude gap-fill:**
When JSON-LD is missing ingredients, does the Claude prompt correctly
ask for them? Does it parse the HTML and extract ingredient lists
from `<ul>`, `<li>`, `.ingredients`, `[class*="ingredient"]` etc?

**Claude prompt audit:**
Read the current import prompt. Does it explicitly ask Claude to:
- Find ingredient lists even when not in JSON-LD?
- Handle ingredient amounts and units separately from names?
- Handle ingredients that are embedded in step text?

### 1b — Test against a real known-good site

```bash
ssh rasp@rpi5-eth
# Test import directly via API
TOKEN=$(curl -s -X POST \
  "https://api.chefsbk.app/auth/v1/token?grant_type=password" \
  -H "apikey: $(grep NEXT_PUBLIC_SUPABASE_ANON_KEY /mnt/chefsbook/repo/apps/web/.env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"email":"a@aol.com","password":"TestPass123!"}' \
  | jq -r '.access_token')

# Test allrecipes.com (known to work via extension)
curl -s -X POST https://chefsbk.app/api/import/url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.allrecipes.com/recipe/24074/alysas-macaroni-and-cheese/"}' \
  | jq '{title, description, ingredient_count: (.ingredients | length), step_count: (.steps | length)}'
```

Show exactly what comes back. If ingredients are empty, trace through
the extraction code to find where they're lost.

### 1c — Fix ingredient extraction

Based on diagnosis, fix the extraction. Common fixes needed:

**Fix A — JSON-LD ingredient strings not parsed into structured format:**
```typescript
// Current (may be wrong):
ingredients: jsonLd.recipeIngredient

// Should be:
ingredients: parseIngredients(jsonLd.recipeIngredient)
// Where parseIngredients() splits "2 cups flour" into
// { amount: 2, unit: 'cups', name: 'flour' }
```

**Fix B — Claude prompt doesn't request ingredients strongly enough:**
Add to the Claude import prompt:
"CRITICAL: You MUST extract the complete ingredient list with exact
quantities and units. Ingredients are usually in a bulleted list
near the top of the recipe, often with class names containing
'ingredient'. If you cannot find ingredients, return an empty
array — do NOT omit the field. Never invent ingredients."

**Fix C — HTML fallback missing ingredient selectors:**
Add common ingredient container selectors to the HTML extraction:
```
.ingredients, .ingredient-list, [class*="ingredient"],
[itemprop="recipeIngredient"], .recipe-ingredients,
.wprm-recipe-ingredient, .tasty-recipe-ingredients,
.mv-create-ingredients, .recipe__ingredients,
[data-recipe-ingredient]
```

These CSS selectors cover the most popular recipe WordPress plugins
(WPRM, Tasty Recipes, Create by Mediavine) which power 60%+ of
food blogs.

### 1d — Test the fix

After fixing, re-test the same URL. Confirm ingredients now import
with amounts and units.

---

## PART 2 — Improve the completeness rating system

The 5-star rating should reflect what actually imported, not HTTP status.

Update the rating logic in testSiteImport():

```typescript
function calculateRating(result: ImportResult): 1 | 2 | 3 | 4 | 5 {
  if (!result || result.error) return 1  // complete failure

  const hasTitle = !!result.title
  const hasDescription = !!result.description
  const ingredientCount = result.ingredients?.length ?? 0
  const ingredientsWithQty = result.ingredients?.filter(
    i => i.amount && i.unit
  ).length ?? 0
  const stepCount = result.steps?.length ?? 0
  const hasTags = (result.tags?.length ?? 0) > 0

  if (!hasTitle) return 1  // useless without title

  if (hasTitle && ingredientCount >= 3 && ingredientsWithQty >= 3
      && stepCount >= 2 && hasDescription) return 5  // complete

  if (hasTitle && ingredientCount >= 2 && stepCount >= 1) return 4  // good

  if (hasTitle && (ingredientCount >= 1 || stepCount >= 1)) return 3  // partial

  if (hasTitle && hasDescription) return 2  // title+desc only

  return 1  // barely anything
}
```

Also track WHAT was found, not just what was missing:
```typescript
taxonomy: {
  title: hasTitle,
  description: hasDescription,
  ingredients_count: ingredientCount,
  ingredients_with_qty: ingredientsWithQty,
  steps_count: stepCount,
  has_tags: hasTags,
  fetch_method: 'json-ld' | 'claude-gap-fill' | 'claude-only' | 'failed'
}
```

---

## PART 3 — Redo the crawl properly

### 3a — Find real recipe URLs from homepages

Before testing each site, find a working recipe URL:

```typescript
async function findRecipeUrl(domain: string): Promise<string | null> {
  // 1. Check SITE_TEST_URLS first (curated)
  if (SITE_TEST_URLS[domain]) return SITE_TEST_URLS[domain]

  // 2. Fetch homepage and find a recipe link
  const homeUrl = `https://www.${domain}`
  const html = await fetchWithRetry(homeUrl)
  if (!html) return null

  // Look for links containing recipe patterns
  const recipePatterns = [
    /href="([^"]*\/recipe[s]?\/[^"]+)"/gi,
    /href="([^"]*\/recette[s]?\/[^"]+)"/gi,    // French
    /href="([^"]*\/rezept[e]?\/[^"]+)"/gi,     // German
    /href="([^"]*\/ricetta\/[^"]+)"/gi,         // Italian
    /href="([^"]*\/receta[s]?\/[^"]+)"/gi,     // Spanish
  ]

  for (const pattern of recipePatterns) {
    const match = pattern.exec(html)
    if (match) {
      const url = match[1].startsWith('http')
        ? match[1]
        : `https://www.${domain}${match[1]}`
      return url
    }
  }

  return null
}
```

### 3b — Retry with different User-Agents

For sites that return 403, retry with different User-Agents:

```typescript
const USER_AGENTS = [
  // Desktop Chrome
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  // Mobile Safari (iPhone)
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  // Googlebot
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
]
```

Try each User-Agent before giving up.

### 3c — Document what was found even for failures

For every site, regardless of success/failure, record:
- HTTP status code received
- Whether JSON-LD was present in the response
- What fields were extractable
- Recommended action for the import pipeline

### 3d — Import real recipes during the crawl

This crawl must do a REAL import for every site — not just fetch and
analyse, but actually save the recipe to the database. This gives us:
1. Real proof of what imports and what doesn't
2. A growing recipe library of international recipes
3. Visible results we can review in the app

For every site that returns a recipe:
- Call the full importFromUrl() pipeline
- Save the recipe to the database under the pilzner account (a@aol.com)
- Add the tag "ChefsBook" to every imported recipe automatically
- Add a second tag with the site domain (e.g. "bbcgoodfood.com")
- Add a third tag with the region/language (e.g. "French", "Italian", "UK")
- Set visibility to 'private' (admin-only until reviewed)
- Set original_submitter_id to pilzner's user_id

Get pilzner's user_id first:
```bash
psql -U postgres -d postgres -c \
  "SELECT id FROM auth.users WHERE email = 'a@aol.com';"
```

In the crawl script:
```typescript
// After successful import
if (recipe && recipe.id) {
  // Add mandatory tags
  const tags = [
    'ChefsBook',           // always
    domain,                // site source
    regionTag,             // e.g. 'French', 'Italian', 'Nordic'
    ...(recipe.tags ?? []) // preserve any auto-extracted tags
  ]

  await supabaseAdmin.from('recipes').update({
    tags,
    visibility: 'private',
    user_id: PILZNER_USER_ID,
    original_submitter_id: PILZNER_USER_ID,
    original_submitter_username: 'pilzner'
  }).eq('id', recipe.id)
}
```

### 3e — Run the improved crawl

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
SUPABASE_SERVICE_ROLE_KEY=<key> \
ANTHROPIC_API_KEY=<key> \
PILZNER_USER_ID=<pilzner-uuid> \
node scripts/test-site-compatibility.mjs 2>&1 | tee /tmp/crawl-log.txt
```

Rate limit: 1 per 8 seconds (more careful than before).
For sites that fail: retry once with a different User-Agent before
giving up.

Log for each site:
- ✓ allrecipes.com → "Macaroni and Cheese" (5★ — title+desc+12 ingredients+8 steps)
- ⚠ seriouseats.com → "Chicken Soup" (3★ — title+desc+steps, NO ingredients)
- ✗ epicurious.com → FAILED (403 after 3 attempts)

At the end of the crawl, log:
- Total recipes saved to DB: N
- Total sites tested: N
- Breakdown by rating

---

## PART 4 — Recommendations report

After the crawl, the report must include a proper recommendations
section that actually tells us what to do:

```markdown
## Recommendations for Higher Capture Rates

### Immediate code fixes (will improve ALL sites)
1. [specific fix with expected impact]
2. [specific fix with expected impact]

### Site-specific fixes
- [domain]: [exactly what to change in the import code]

### Structural improvements
- Consider ScrapingBee integration for bot-protected sites (est. cost: $X/month)
- Consider Puppeteer fallback for JavaScript-rendered sites
- Consider browser extension as primary import path for desktop users

### Sites to prioritize
Top 10 sites by traffic × failure impact = highest ROI fixes
```

---

## PART 5 — Admin page improvements

Update /admin/import-sites:

1. **All domain names are clickable links** that open the site in a new tab
2. **"Test now" button** per row that triggers a single-site test immediately
3. **Result detail modal** — clicking a row shows full taxonomy:
   - What was found (title ✓, description ✓, ingredients ✗, steps ✓)
   - HTTP status received
   - Fetch method used
   - Sample URL tested (clickable)
   - Last test timestamp
4. **Export to CSV** includes all fields including taxonomy and sample URLs

---

## COMPLETION CHECKLIST

### Import pipeline fix
- [ ] Ingredient extraction diagnosed — root cause identified
- [ ] WordPress recipe plugin selectors added to HTML fallback
- [ ] Claude prompt updated to strongly request ingredients
- [ ] JSON-LD ingredient parsing handles string format correctly
- [ ] Test confirmed: allrecipes.com (or similar) now imports ingredients
- [ ] Deployed to RPi5

### Crawl improvements
- [ ] Homepage URL discovery implemented (finds real recipe links)
- [ ] User-Agent rotation implemented (3 attempts before giving up)
- [ ] Rating logic updated (reflects actual content found)
- [ ] Taxonomy records what WAS found, not just what was missing

### Crawl results
- [ ] All 218 sites re-tested with improved approach
- [ ] Real recipes saved to DB under pilzner (a@aol.com) for every successful import
- [ ] All imported recipes tagged: "ChefsBook" + domain + region
- [ ] All imported recipes set to visibility: private
- [ ] import_site_tracker updated with accurate ratings
- [ ] Results more distributed (not 78% rating 1)
- [ ] Crawl log saved to /tmp/crawl-log.txt and committed to docs/
- [ ] Report includes specific recommendations
- [ ] Total recipes imported from crawl documented in DONE.md

### Admin improvements
- [ ] Domain names are clickable links to the site
- [ ] "Test now" per-row button works
- [ ] Row click opens detailed result modal
- [ ] Export CSV includes full taxonomy

### Run /wrapup
- [ ] At the end: what is the real % compatibility now?
      What are the top 3 most impactful code fixes identified?
      Which sites went from 1★ to 3★+ after the fix?
