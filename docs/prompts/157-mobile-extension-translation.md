# ChefsBook — Session 157: Wire Translation into Mobile + Extension Import
# Source: Session 150 fixed web server-side translation but mobile and extension
#         imports still arrive in the source language
# Target: apps/mobile + apps/extension

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, import-pipeline.md,
and import-quality.md before touching anything.

Session 150 added translation at import time for web URL imports.
The translateRecipeToLanguage() and detectLanguage() functions exist
in packages/ai and are working correctly.

Two import paths still need translation wired in:
1. Mobile app URL import
2. Chrome extension import

---

## PART 1 — Mobile import translation

### 1a — Find the mobile import flow

Read apps/mobile/app/(tabs)/scan.tsx and any related import
handlers. Find where recipes are saved after a URL import on mobile.

The mobile import likely calls one of:
- A direct API route (/api/import/url) — if so, translation is
  already handled server-side and this may already work
- A local function in recipeStore or importStore
- A packages/ai import function directly

### 1b — Determine if already fixed

If mobile calls /api/import/url (the same web API route):
- Translation is ALREADY happening server-side
- Verify by importing a French recipe URL on the emulator
- If it arrives in English → already working, document and done

If mobile calls a different path:
- Wire in the same translation logic as session 150

### 1c — Pass user language from mobile

The server needs to know the user's language preference.
Mobile should pass it in the import request:

```typescript
// In mobile import handler
const { language } = usePreferencesStore()

const response = await fetch(`${API_BASE}/api/import/url`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url,
    userLanguage: language ?? 'en'  // pass user's language
  })
})
```

### 1d — Test on emulator

```bash
# Start CB_API_34 emulator
# Install latest APK
adb install android/app/build/outputs/apk/release/app-release.apk

# Test: import a French recipe URL
# Use: https://www.marmiton.org/recettes/ (any recipe)
# Expected: recipe arrives in English in the app
```

Take ADB screenshot and describe what language the recipe appears in.

---

## PART 2 — Chrome extension translation

### 2a — Find the extension import flow

Read apps/extension/popup.js (or popup.ts) fully.
Find where the extension calls the import API.

### 2b — Pass user language from extension

The extension stores the user's language preference in chrome.storage.
Pass it to the import API:

```javascript
// Get stored language preference
const { userLanguage } = await chrome.storage.local.get('userLanguage')

// Include in import request
const response = await fetch(`${CHEFSBOOK_API}/api/import/url`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: currentTabUrl,
    userLanguage: userLanguage ?? 'en'
  })
})
```

### 2c — Store language when user changes it

When the user changes their language in ChefsBook settings,
the extension should pick it up. Two approaches:

**Option A** (simplest): Extension reads language from the user's
profile when it loads:
```javascript
async function loadUserLanguage() {
  const token = await getStoredToken()
  if (!token) return 'en'

  const response = await fetch(`${CHEFSBOOK_API}/api/user/profile`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const profile = await response.json()
  const lang = profile.preferred_language ?? 'en'

  await chrome.storage.local.set({ userLanguage: lang })
  return lang
}
```

Call loadUserLanguage() when the extension popup opens.

**Option B**: Extension always passes 'en' as the language
(acceptable since the extension is a desktop tool and most
desktop users are likely in their primary language).

Recommend Option A — reads from actual user profile.

### 2d — Test with the extension

1. Open Chrome with extension installed
2. Navigate to a French recipe site (marmiton.org)
3. Click the ChefsBook extension icon
4. Import a recipe
5. Confirm: recipe appears in English in ChefsBook dashboard
6. PASS or FAIL

### 2e — Package new extension version

If extension code was changed:
- Bump version in manifest.json (e.g. 1.1.0 → 1.1.1)
- Package new zip:
  ```bash
  cd apps/extension
  zip -r dist/chefsbook-extension-v1.1.1.zip . \
    --exclude "*.git*" --exclude "dist/*" --exclude "node_modules/*"
  ```
- Update the download route to serve new zip

---

## PART 3 — Verify PDF fallback also translates

When the extension does a PDF/HTML capture fallback for blocked sites,
the extracted content also needs translation.

In the extension's PDF import handler:
```javascript
// After getting recipe from PDF extraction
const recipe = await callPdfImportApi(htmlContent, url)

// The server handles translation via /api/import/file
// Verify /api/import/file also calls translateRecipeToLanguage()
// If not, add it
```

Check apps/web/app/api/import/file/route.ts — does it call
translateRecipeToLanguage()? If not, add the same translation
logic as /api/import/url.

---

## DEPLOYMENT

Web (if /api/import/file was updated):
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Mobile (if mobile code was updated):
```bash
cd apps/mobile
npx expo run:android --variant release
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## COMPLETION CHECKLIST

### Mobile
- [ ] Mobile import path identified (direct API call or local function)
- [ ] If already using /api/import/url: confirmed translation works
- [ ] If separate path: translation wired in
- [ ] userLanguage passed in mobile import request
- [ ] Tested on emulator: French recipe → arrives in English
- [ ] ADB screenshot taken and described

### Extension
- [ ] Extension import handler identified
- [ ] userLanguage passed in extension import request
- [ ] Language loaded from user profile on popup open
- [ ] Tested: marmiton.org recipe → arrives in English in dashboard
- [ ] New extension zip packaged if code changed

### PDF fallback translation
- [ ] /api/import/file checked for translation
- [ ] Translation added to file import if missing
- [ ] PDF-captured recipes also arrive in user's language

### General
- [ ] feature-registry.md updated
- [ ] import-quality.md updated
- [ ] tsc --noEmit passes mobile + web
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end: clearly state which paths now translate correctly,
      test results for mobile and extension, what was left incomplete.
