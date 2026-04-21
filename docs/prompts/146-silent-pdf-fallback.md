# ChefsBook — Session 146: Silent PDF Fallback for Blocked Sites
# Source: Bot-protected sites (Allrecipes, Epicurious, NYT) block server imports
# Target: apps/extension + apps/web + apps/mobile
# Dependency: Run AFTER session 145 (ingredient extraction fix must be done first)

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, import-pipeline.md,
and import-quality.md before touching anything.

Sites like Allrecipes, Epicurious, and NYT Cooking block server-side
fetches. The Chrome extension already runs in the user's browser where
the page is fully rendered and authenticated. This session adds a
silent PDF fallback that extracts recipes from bot-protected sites
without the user knowing anything different happened.

The user experience must be IDENTICAL to a normal import:
- Click import
- See spinner: "Importing recipe..."
- Recipe appears
The PDF mechanism is invisible.

---

## PART A — Chrome Extension Enhancement

### A1 — Add printToPdf capability

The Chrome extension needs the `tabs` permission (already has it)
and access to `chrome.tabs.printToPdf()`.

Read apps/extension/popup.js and manifest.json fully before changing
anything.

Add to manifest.json permissions if not present:
```json
"permissions": ["tabs", "activeTab", "storage", "scripting"]
```

### A2 — Detect import failure from server

In the extension's import flow, after calling the ChefsBook import API:

```javascript
async function importCurrentTab(tabId, url) {
  showStatus('Importing recipe...')

  // Step 1: Try normal server-side import
  const result = await callImportApi(url)

  // Step 2: Check if server needs browser-side extraction
  if (result.needsBrowserExtraction || result.error === 'blocked'
      || result.error === 'incomplete_ingredients') {

    showStatus('Getting full recipe...')  // still just a spinner to user

    // Step 3: Silent PDF generation
    const pdfData = await generateSilentPdf(tabId)
    if (!pdfData) {
      showError('Could not extract recipe from this page.')
      return
    }

    // Step 4: Send PDF to import endpoint
    const pdfResult = await callPdfImportApi(pdfData, url)
    return pdfResult
  }

  return result
}
```

### A3 — Silent PDF generation

```javascript
async function generateSilentPdf(tabId) {
  return new Promise((resolve) => {
    // chrome.tabs.printToPdf() generates PDF silently
    // No print dialog shown to user
    chrome.tabs.printToPdf(tabId, {
      landscape: false,
      printBackground: true,
      scale: 1,
      paperWidth: 8.5,
      paperHeight: 11,
      marginTop: 0.5,
      marginBottom: 0.5,
      marginLeft: 0.5,
      marginRight: 0.5,
      pageRanges: '1-3',  // first 3 pages covers most recipes
      headerFooterEnabled: false
    }, (pdfData) => {
      if (chrome.runtime.lastError || !pdfData) {
        resolve(null)
        return
      }
      resolve(pdfData)  // base64-encoded PDF
    })
  })
}
```

### A4 — Send PDF to ChefsBook

```javascript
async function callPdfImportApi(pdfBase64, sourceUrl) {
  const token = await getStoredToken()

  const response = await fetch(`${CHEFSBOOK_API}/api/import/file`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileData: pdfBase64,
      fileType: 'application/pdf',
      fileName: 'recipe-page.pdf',
      sourceUrl,          // so we can attribute the source
      extractionMethod: 'pdf-fallback'  // for analytics
    })
  })

  return response.json()
}
```

### A5 — Update extension status messages

The user should only ever see calm, confident messages:
- "Importing recipe..." (normal import attempt)
- "Getting full recipe..." (PDF fallback triggered — user doesn't know)
- "Recipe imported! ✓" (success)
- "Could not read this recipe. Try scanning a screenshot instead." (failure)

Never show: "PDF", "print", "fallback", "blocked", "403" to the user.

### A6 — Detect which sites need PDF fallback

Add a list of known bot-protected sites to the extension:

```javascript
// Confirmed Cloudflare-protected — verified by session 145 crawl
// These return 403/460 even with UA rotation
const PDF_FALLBACK_SITES = [
  // US majors — all Cloudflare-protected (confirmed session 145)
  'allrecipes.com', 'seriouseats.com', 'foodnetwork.com',
  'food52.com', 'epicurious.com', 'nytcooking.com',
  'cooking.nytimes.com', 'cooksillustrated.com',
  'americastestkitchen.com', 'eatingwell.com',
  'marthastewart.com', 'tasteofhome.com',
  // UK
  'bbcgoodfood.com', 'jamieoliver.com',
  'deliciousmagazine.co.uk', 'olivemagazine.com',
  // International
  'marmiton.org', 'chefkoch.de',
  'giallozafferano.it', 'taste.com.au',
  // Check import_site_tracker for any domain where
  // last rating = 1 AND failure was 403/460 — add dynamically
]

function needsPdfFallback(url) {
  return PDF_FALLBACK_SITES.some(site => url.includes(site))
}
```

For known-blocked sites: skip the server import attempt entirely
and go straight to PDF. This saves time and avoids unnecessary
server load.

---

## PART B — Web URL Import Fallback

### B1 — Server signals when browser extraction needed

In apps/web/app/api/import/url/route.ts, when import fails or
ingredients are missing, return a specific signal:

```typescript
// When server-side import fails or is incomplete
if (importFailed || missingIngredients) {
  return NextResponse.json({
    success: false,
    needsBrowserExtraction: true,
    partialRecipe: partialResult ?? null,  // whatever we got
    message: 'This site works better with the ChefsBook browser extension',
    extensionInstallUrl: 'https://chefsbk.app/extension'
  }, { status: 206 })  // 206 Partial Content
}
```

### B2 — Web app detects and handles the signal

In the web import UI, when the server returns `needsBrowserExtraction`:

```typescript
if (result.needsBrowserExtraction) {
  // Check if extension is installed
  // (extension injects a marker into the page when active)
  const extensionInstalled = !!document.querySelector(
    '[data-chefsbook-extension]'
  )

  if (extensionInstalled) {
    // Silently trigger extension to do PDF import
    window.postMessage({
      type: 'CHEFSBOOK_PDF_IMPORT',
      url: importUrl
    }, '*')
    // Extension listens for this message and handles it
    showStatus('Getting full recipe from your browser...')

  } else {
    // Extension not installed — show helpful message
    showMessage({
      type: 'info',
      title: 'Better import available',
      message: `This site imports better with the ChefsBook browser extension.`,
      action: {
        label: 'Install extension (free)',
        url: '/extension'
      },
      secondaryAction: {
        label: 'Use what we got',
        // Use the partial recipe if available
      }
    })
  }
}
```

### B3 — Extension listens for web app messages

In the extension's content script, listen for messages from the
ChefsBook web app:

```javascript
window.addEventListener('message', async (event) => {
  if (event.data?.type === 'CHEFSBOOK_PDF_IMPORT') {
    const url = event.data.url
    const tabId = (await chrome.tabs.getCurrent()).id
    const pdfData = await generateSilentPdf(tabId)
    if (pdfData) {
      const result = await callPdfImportApi(pdfData, url)
      // Send result back to web app
      window.postMessage({
        type: 'CHEFSBOOK_PDF_IMPORT_RESULT',
        recipe: result
      }, '*')
    }
  }
})
```

### B4 — Extension presence marker

When the extension is active on a ChefsBook page, inject a marker
so the web app knows it's available:

```javascript
// In extension content script
if (window.location.hostname === 'chefsbk.app') {
  const marker = document.createElement('meta')
  marker.setAttribute('data-chefsbook-extension', 'true')
  document.head.appendChild(marker)
}
```

---

## PART C — Mobile Handling

Mobile can't use the Chrome extension. When a URL import fails
or returns `needsBrowserExtraction`:

Show a ChefsDialog:
```
This recipe imports better from a desktop browser.

Options:
[📸 Scan a screenshot]  — screenshot the recipe on your phone
                          and import as a photo
[🔗 Copy link]          — open on desktop and use the
                          ChefsBook extension
[✓ Use what we got]     — save the partial recipe for now
                          (you can fill gaps manually)
```

---

## PART E — Refresh incomplete recipes

Once the PDF fallback is working, users with incomplete recipes
(missing ingredients, missing steps) should be able to re-process
them automatically to fill the gaps.

### E1 — "Refresh recipe" button on incomplete recipes

On web recipe detail, when is_complete = false OR missing_fields
is not empty, show a banner:

```
⚠️ This recipe is incomplete — missing: ingredients, steps

[🔄 Refresh from source]  [✏️ Fill in manually]  [🤖 Generate with AI]
```

"Refresh from source" only shown when source_url exists.

### E2 — Refresh flow

When user clicks "Refresh from source":

1. Check if Chrome extension is installed (via presence marker)
   - If YES + blocked site → trigger silent PDF import via postMessage
   - If YES + normal site → re-run importFromUrl() with source_url
   - If NO extension → show:
     "Open [source_url] in Chrome with the ChefsBook extension
     to refresh this recipe automatically"

2. Merge strategy — never overwrite existing complete fields:
```typescript
async function mergeRecipeUpdate(existing, fresh) {
  return {
    ...existing,
    // Only fill fields that are currently missing/empty
    description: existing.description || fresh.description,
    ingredients: existing.ingredients?.length
      ? existing.ingredients
      : fresh.ingredients ?? [],
    steps: existing.steps?.length
      ? existing.steps
      : fresh.steps ?? [],
    tags: [...new Set([
      ...(existing.tags ?? []),
      ...(fresh.tags ?? [])
    ])],
  }
}
```

3. After merge: re-run checkRecipeCompleteness() + isActuallyARecipe()
4. Update DB with merged data and new completeness status
5. Show success: "Recipe updated! X new ingredients added."

### E3 — Mobile: same refresh banner + flow

On mobile recipe detail, same banner when is_complete = false.
Tapping "Refresh from source" shows ChefsDialog:
- "Open on desktop with the extension" option
- "Generate missing fields with AI" option
- "Fill in manually" option

### E4 — Admin bulk refresh

On /admin/incomplete-recipes, add "Refresh All" button:
- Queues all incomplete recipes with a source_url
- Background processing: 1 per 5 seconds
- Progress shown: "Refreshing 12/47..."
- Summary when done: "Updated 31/47 recipes"

### E5 — Auto-refresh prompt on extension install

When user visits ChefsBook with the extension active for the
first time, show a one-time prompt:

```
🎉 ChefsBook extension detected!
You have N recipes with missing ingredients.
Refresh them automatically?
[Yes, refresh now]  [Maybe later]
```

If "Yes": triggers background bulk refresh for that user's
incomplete recipes.

---

## PART D — Analytics tracking

Add `extraction_method` to import_attempts:
```sql
ALTER TABLE import_attempts
  ADD COLUMN IF NOT EXISTS extraction_method TEXT
    CHECK (extraction_method IN (
      'json-ld', 'claude-html', 'claude-only',
      'pdf-fallback', 'vision-screenshot', 'manual', NULL
    ));
```

Track which method succeeded for each import.
Admin import-sites page shows extraction_method breakdown per domain.

---

## DEPLOYMENT

Extension changes require a new extension zip:
```bash
cd apps/extension
# Update version in manifest.json (bump patch version)
zip -r dist/chefsbook-extension-v{version}.zip . \
  --exclude "*.git*" --exclude "dist/*" --exclude "node_modules/*"
```

Update the download route to serve the new zip.

Web changes:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

### Extension
- [ ] chrome.tabs.printToPdf() implemented silently
- [ ] Known bot-protected sites skip server import, go straight to PDF
- [ ] PDF sent to /api/import/file with sourceUrl
- [ ] Status messages never mention PDF/print/fallback to user
- [ ] Extension presence marker injected on chefsbk.app pages
- [ ] Extension listens for CHEFSBOOK_PDF_IMPORT messages from web app
- [ ] New extension zip packaged and download route updated

### Web
- [ ] Server returns needsBrowserExtraction: true on blocked/incomplete
- [ ] Web app checks for extension presence marker
- [ ] If extension present: silently triggers PDF import via postMessage
- [ ] If extension absent: shows install prompt with helpful message
- [ ] Partial recipe offered as fallback if available

### Mobile
- [ ] ChefsDialog shown with 3 options on needsBrowserExtraction
- [ ] Screenshot scan option navigates to scan tab
- [ ] "Use what we got" saves partial recipe

### Analytics
- [ ] extraction_method column added to import_attempts
- [ ] Admin import-sites shows extraction method breakdown per domain

### Recipe Refresh (Part E)
- [ ] "Refresh from source" banner on incomplete recipe detail (web + mobile)
- [ ] Merge strategy: never overwrites existing complete fields
- [ ] Re-runs completeness check after merge
- [ ] Shows "X new ingredients added" on success
- [ ] Admin bulk refresh button on /admin/incomplete-recipes
- [ ] Auto-refresh prompt shown on first extension detection
- [ ] Background processing with progress indicator

### General
- [ ] feature-registry.md updated
- [ ] import-quality.md updated with PDF fallback notes
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end recap: which sites now work via PDF fallback that
      failed before, what the user experience looks like end-to-end,
      and what was left incomplete.

---

## ADDITIONAL CONTEXT FROM SESSION 145

Session 145 results inform how to run 146:

1. **32 crawl recipes already saved** under pilzner — these should
   be the first batch tested by the E3 bulk refresh once PDF fallback
   works. They are tagged "ChefsBook" and set to private.

2. **90 Cloudflare-protected sites confirmed** — PDF_FALLBACK_SITES
   list in Part A6 has been updated with all confirmed blocked domains.
   The extension should also dynamically check import_site_tracker
   for domains with rating=1 and add them to the fallback list.

3. **15% real compatibility** (32/218) before PDF fallback. After
   PDF fallback ships, the target is 60%+ (covering the ~90 Cloudflare
   sites which represent the most-used recipe destinations).

4. **Dynamic blocked site detection** — after PDF fallback is built,
   add a check to import_site_tracker: if domain has rating ≤ 1 AND
   last failure was 403/460, automatically route new imports from
   that domain to PDF fallback without needing the hardcoded list.
