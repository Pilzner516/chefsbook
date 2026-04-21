# ChefsBook — Session 154: End-to-End Import Waterfall Verification
# Source: Full import waterfall has never been tested end-to-end with a real user
# Target: apps/web + apps/extension (verify + fix what's broken)
# Dependency: Run AFTER session 153 (incomplete result PDF fallback)

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, import-pipeline.md,
and import-quality.md before starting.

Sessions 146 and 153 built a multi-step import waterfall but it has
NEVER been tested end-to-end. This session verifies every step works
and fixes anything broken.

---

## THE FULL WATERFALL

```
User pastes URL
  ↓
Step 1: Server tries JSON-LD extraction (instant)
  → Complete: save recipe ✓
  → Incomplete or fails: continue ↓

Step 2: Server tries Claude HTML extraction (1-2 sec)
  → Complete: save recipe ✓
  → Incomplete or 403/429: continue ↓

Step 3: Server returns 206 + needsBrowserExtraction: true
  ↓
Step 4: Web app checks for extension presence marker
  → No extension: show install prompt + partial recipe option
  → Extension present: continue ↓

Step 5: Web app sends postMessage to extension
  ↓
Step 6: Extension shows "Getting full recipe..."
  ↓
Step 7: Extension captures full rendered HTML via executeScript
  ↓
Step 8: Extension sends to /api/import/file
  ↓
Step 9: Server extracts + merges with partialRecipe
  ↓
Step 10: Recipe saved ✓ User sees complete recipe
```

---

## 5 VERIFICATION TESTS

### Test A — Happy path (server-side works)
Site: recipetineats.com or budgetbytes.com (known working)

Steps:
1. Open chefsbk.app in Chrome WITH extension installed
2. Paste a recipe URL
3. Confirm: recipe appears with title + ingredients + steps
4. Confirm: user sees only "Importing..." → "Recipe saved!"
5. Check DB: source_url saved, steps_rewritten = true
6. PASS or FAIL

### Test B — Blocked site WITH extension
Site: allrecipes.com or bbcgoodfood.com

Steps:
1. Open chefsbk.app in Chrome WITH extension installed
2. Paste an allrecipes.com recipe URL
3. Watch status: "Importing..." → "Getting full recipe..." → "Recipe saved!"
4. Confirm: complete recipe with ingredients + steps
5. Confirm: no error shown, seamless experience
6. Check network tab: /api/import/file was called (extension PDF)
7. PASS or FAIL

### Test C — Incomplete result triggers fallback (session 153)
Site: saveur.com

Steps:
1. Open chefsbk.app WITH extension
2. Paste a saveur.com recipe URL
3. Confirm: if server returns incomplete, extension triggers automatically
4. Confirm: final recipe has ingredients + steps
5. PASS or FAIL

### Test D — Blocked site WITHOUT extension
Site: allrecipes.com

Steps:
1. Open chefsbk.app WITHOUT extension (or in incognito)
2. Paste an allrecipes.com URL
3. Confirm: friendly message shown with install link
4. Confirm: partial recipe offered if server got anything
5. PASS or FAIL

### Test E — Mobile import (no extension)
Site: any blocked site

Steps:
1. Open chefsbk.app on mobile
2. Paste a blocked site URL
3. Confirm: ChefsDialog shows 3 options:
   [Scan a screenshot] [Open on desktop] [Use what we got]
4. PASS or FAIL

---

## STATUS MESSAGE REQUIREMENTS

All scenarios must show clear, friendly messages. NEVER show:
"PDF", "403", "blocked", "fallback", or a stuck blank spinner.

Normal import:
```
"Importing recipe..." → "Recipe saved! ✓"
```

Extension fallback:
```
"Importing recipe..." → "Getting full recipe from your browser..." → "Recipe saved! ✓"
```

No extension:
```
"Importing recipe..." → "Install the ChefsBook extension for better
results from this site" [install link] [+ Use partial recipe button]
```

Mobile blocked:
```
"Importing recipe..." → ChefsDialog with 3 options
```

---

## COMMON ISSUES TO CHECK AND FIX

### Extension presence marker
Verify extension injects marker on chefsbk.app:
```javascript
// Content script — must exist
if (window.location.hostname.includes('chefsbk.app')) {
  const marker = document.createElement('meta')
  marker.setAttribute('data-chefsbook-extension', 'true')
  document.head.appendChild(marker)
}
```

### postMessage flow
Verify web app sends and extension receives:
```javascript
// Web app sends:
window.postMessage({ type: 'CHEFSBOOK_PDF_IMPORT', url }, '*')

// Extension content script listens:
window.addEventListener('message', async (event) => {
  if (event.data?.type === 'CHEFSBOOK_PDF_IMPORT') { ... }
})
```

### Merge logic
PDF result is primary, partial fills gaps only:
```javascript
const merged = {
  ...partialRecipe,   // server got
  ...pdfResult,       // PDF overrides
  title: pdfResult.title || partialRecipe?.title,
  ingredients: pdfResult.ingredients?.length
    ? pdfResult.ingredients : partialRecipe?.ingredients ?? [],
  steps: pdfResult.steps?.length
    ? pdfResult.steps : partialRecipe?.steps ?? [],
}
```

---


---

## PART 2 — Wire the Admin "Run Tests" Button for Comprehensive Testing

The admin "Run all tests now" button (with the rating filter modal from
session 152) should run the SAME comprehensive import waterfall tests
that are verified manually above. This turns it into a real QA tool
that can be triggered any time.

### What "Run Tests" should actually test per site:

Currently the test-sites route just tries to fetch a recipe URL and
checks if JSON-LD is present. This is too shallow.

Update /api/admin/test-sites to run a REAL end-to-end import for
each site:

```typescript
async function testSiteComprehensive(domain: string): Promise<SiteTestResult> {
  const testUrl = await findBestTestUrl(domain)
  if (!testUrl) return { domain, rating: null, reason: 'no_test_url' }

  // Run the FULL import pipeline (same as a real user import)
  const result = await importFromUrl(testUrl, {
    userId: SYSTEM_USER_ID,  // system test user
    userLanguage: 'en',
    isTestRun: true  // flag to skip saving to DB
  })

  // Check what actually came back
  const completeness = checkRecipeCompleteness(result)

  // If incomplete, note that extension would help
  const needsExtension = isIncompleteEnoughForPdfFallback(result)
    || result.error === 'blocked'

  return {
    domain,
    testUrl,
    rating: calculateRating(result),
    completeness,
    needsExtension,
    fetchMethod: result.fetchMethod,  // 'json-ld' | 'claude-html' | 'failed'
    ingredientCount: result.ingredients?.length ?? 0,
    stepCount: result.steps?.length ?? 0,
    hasQuantities: result.ingredients?.some(i => i.amount) ?? false,
    testedAt: new Date().toISOString()
  }
}
```

Add `isTestRun: true` flag to importFromUrl so it skips:
- Saving to DB
- Rewriting steps
- Generating images
- Logging to import_attempts (use a separate test_runs log)

### Show rich results in admin

After the test run completes, show a results summary modal:

```
Test Run Complete — 47 sites tested

⭐⭐⭐⭐⭐ Full import:     12 sites
⭐⭐⭐⭐   Good import:     8 sites
⭐⭐⭐     Partial import:  6 sites
⭐⭐       Title only:      3 sites
🔌 Needs extension:         15 sites
✗ Failed:                    3 sites

[Download CSV report]  [Close]
```

Clicking any row category filters the main table to show those sites.

### Add test_runs log table

```sql
CREATE TABLE IF NOT EXISTS site_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  test_url TEXT,
  rating INT,
  needs_extension BOOLEAN DEFAULT false,
  fetch_method TEXT,
  ingredient_count INT DEFAULT 0,
  step_count INT DEFAULT 0,
  has_quantities BOOLEAN DEFAULT false,
  error_reason TEXT,
  tested_at TIMESTAMPTZ DEFAULT now(),
  triggered_by UUID REFERENCES user_profiles(id)
);

CREATE INDEX ON site_test_runs(domain, tested_at DESC);
CREATE INDEX ON site_test_runs(tested_at DESC);
```

This gives a full history of every test run — admin can see how
a site's rating has changed over time.

---

## DEPLOYMENT

Only deploy if fixes were needed:

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

If extension was changed: bump version in manifest.json and
package new zip at apps/extension/dist/.

---

## COMPLETION CHECKLIST

- [ ] Test A (happy path): PASS/FAIL documented
- [ ] Test B (blocked + extension): PASS/FAIL documented
- [ ] Test C (incomplete → fallback): PASS/FAIL documented
- [ ] Test D (blocked, no extension): PASS/FAIL documented
- [ ] Test E (mobile): PASS/FAIL documented
- [ ] Extension presence marker confirmed on chefsbk.app
- [ ] postMessage flow confirmed working
- [ ] Status messages correct for all scenarios
- [ ] No broken/stuck states
- [ ] All fixes deployed to RPi5
- [ ] Extension zip updated if changed
- [ ] feature-registry.md updated
- [ ] Run Tests button runs full import pipeline (not just JSON-LD check)
- [ ] isTestRun flag skips DB save, step rewrite, image generation
- [ ] site_test_runs table created and populated after each run
- [ ] Results summary modal shows after test run completes
- [ ] CSV export available from results modal
- [ ] Run /wrapup
- [ ] At the end: PASS/FAIL for all 5 tests + describe exactly
      what the user sees in each scenario.
