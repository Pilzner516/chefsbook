# ChefsBook — Session 71: Browser Extension — Production Ready + Install Page
# Source: Extension audit 2026-04-11
# Target: apps/extension + apps/web

---

## CONTEXT

The ChefsBook browser extension works correctly but is hardcoded to localhost
and Tailscale IPs. This session makes it production-ready for chefsbk.app
and adds an install page to the web app.

Read .claude/agents/deployment.md before starting.

---

## PART 1 — Make Extension Production-Ready

### Fix 1 — Update hardcoded URLs in popup.js

Find and replace ALL hardcoded development URLs:

```js
// BEFORE:
const API_BASE = 'http://localhost:3000';
const SUPABASE_URL = 'http://100.110.47.62:8000';

// AFTER:
const API_BASE = 'https://chefsbk.app';
const SUPABASE_URL = 'https://api.chefsbk.app';
```

### Fix 2 — Update manifest.json host_permissions

```json
{
  "host_permissions": [
    "https://chefsbk.app/*",
    "https://api.chefsbk.app/*",
    "<all_urls>"
  ]
}
```

Remove the localhost and Tailscale IP entries.

### Fix 3 — Remove pre-filled login credentials

In popup.html or popup.js, find where the login form is pre-filled with
`a@aol.com` / `123456`. Remove these values entirely. The fields should
be empty on first open.

### Fix 4 — Fix button colour

The "Save to ChefsBook" button is currently green. Change to pomodoro red:
```css
background-color: #ce2b37;
color: #ffffff;
border: none;
border-radius: 24px;
padding: 10px 20px;
font-weight: 600;
cursor: pointer;
```

### Fix 5 — Update extension name and description in manifest.json

```json
{
  "name": "ChefsBook — Save Recipes",
  "description": "Save recipes from any webpage directly to your ChefsBook collection with one click.",
  "version": "1.0.0"
}
```

### Fix 6 — Add ChefsBook icon to extension

The extension needs icons for the Chrome toolbar and Web Store listing.
Use the existing chef's hat asset. Copy and resize:
- `apps/extension/icons/icon16.png` — 16×16px
- `apps/extension/icons/icon48.png` — 48×48px
- `apps/extension/icons/icon128.png` — 128×128px

Update manifest.json:
```json
{
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png"
    },
    "default_popup": "popup.html",
    "default_title": "Save to ChefsBook"
  }
}
```

Use ImageMagick on the Pi or any available tool to resize the chef's hat PNG:
```bash
# If ImageMagick available:
convert apps/mobile/assets/icon.png -resize 128x128 apps/extension/icons/icon128.png
convert apps/mobile/assets/icon.png -resize 48x48 apps/extension/icons/icon48.png
convert apps/mobile/assets/icon.png -resize 16x16 apps/extension/icons/icon16.png
```

Or use Node.js sharp if available.

### Fix 7 — Package as .zip for Chrome Web Store submission

```bash
cd apps/extension
zip -r chefsbook-extension-v1.0.0.zip . \
  --exclude "*.DS_Store" \
  --exclude "__MACOSX/*" \
  --exclude "*.git*"
```

Save the zip to `apps/extension/dist/chefsbook-extension-v1.0.0.zip`.
This is what gets uploaded to the Chrome Web Store.

---

## PART 2 — Extension Install Page (web)

### Route: `chefsbk.app/extension`

Create `apps/web/app/extension/page.tsx` — publicly accessible, no auth required.

### Page layout

```
┌─────────────────────────────────────────────────┐
│  [ChefsBook logo]                               │
│─────────────────────────────────────────────────│
│                                                 │
│  [Extension icon — 96px]                        │
│                                                 │
│  ChefsBook Browser Extension                    │  ← 28px bold
│  Save recipes from anywhere with one click      │  ← 16px grey
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  Add to Chrome — It's Free         →    │   │  ← red button
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Currently in beta — manual install required    │  ← 13px grey note
│                                                 │
│─────────────────────────────────────────────────│
│                                                 │
│  How it works                                   │  ← section header
│                                                 │
│  1. Install the extension                       │
│     Add it to Chrome from the button above      │
│                                                 │
│  2. Sign in to ChefsBook                        │
│     Click the extension icon and sign in with   │
│     your ChefsBook account                      │
│                                                 │
│  3. Save any recipe                             │
│     Visit any recipe website and click          │
│     "Save to ChefsBook" — that's it             │
│                                                 │
│─────────────────────────────────────────────────│
│                                                 │
│  Works on any recipe website                    │  ← section header
│  NYT Cooking · Serious Eats · Bon Appétit ·    │
│  Food Network · AllRecipes · and thousands more │
│                                                 │
│─────────────────────────────────────────────────│
│                                                 │
│  Manual installation (beta)                     │  ← collapsible section
│                                                 │
│  While we await Chrome Web Store approval,      │
│  install manually in 3 steps:                   │
│                                                 │
│  1. Download the extension files                │
│     [Download extension.zip]                   │  ← link to zip file
│                                                 │
│  2. Open Chrome Extensions                      │
│     Go to chrome://extensions and enable        │
│     "Developer mode" (top right toggle)         │
│                                                 │
│  3. Load the extension                          │
│     Click "Load unpacked" and select the        │
│     unzipped extension folder                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### "Add to Chrome" button
For now, this links to the manual install instructions (scroll down to
the manual installation section). When the Chrome Web Store listing is live,
update this URL to the store listing URL.

### Download link
Serve the zip file from `chefsbk.app/extension/download`:
- Create `apps/web/app/extension/download/route.ts`
- Serves `apps/extension/dist/chefsbook-extension-v1.0.0.zip` as a download
- Content-Type: `application/zip`
- Content-Disposition: `attachment; filename="chefsbook-extension.zip"`

---

## PART 3 — Add to web sidebar navigation

In the web sidebar, add "Browser Extension" below Settings:

```tsx
<SidebarNavItem
  href="/extension"
  icon={<PuzzlePieceIcon />}  // or any browser/extension icon
  label="Browser Extension"
/>
```

Use a puzzle piece icon (🧩) or browser window icon — whichever is available
in the icon set already used in the sidebar.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Verify:
- `chefsbk.app/extension` loads correctly
- "Browser Extension" appears in sidebar below Settings
- Download link returns the zip file
- Extension folder has production URLs (grep to confirm no localhost remaining)

---

## CHROME WEB STORE — NEXT STEPS (document in DONE.md)

Record these steps for future submission:
1. Register at https://chrome.google.com/webstore/devconsole ($5 one-time fee)
2. Upload `chefsbook-extension-v1.0.0.zip`
3. Fill in store listing:
   - Name: ChefsBook — Save Recipes
   - Description: (use the page copy above)
   - Screenshots: at least 1 (1280×800px showing extension saving a recipe)
   - Category: Productivity
   - Privacy policy URL: https://chefsbk.app/privacy
4. Submit for review (1-3 business days)
5. Once approved: update the "Add to Chrome" button URL to the store listing

---

## COMPLETION CHECKLIST

- [ ] popup.js uses https://chefsbk.app and https://api.chefsbk.app
- [ ] manifest.json host_permissions updated to production domains
- [ ] Pre-filled login credentials removed from popup
- [ ] "Save to ChefsBook" button is pomodoro red
- [ ] Extension name/description/version updated in manifest.json
- [ ] Icons created at 16/48/128px and added to manifest
- [ ] Extension packaged as .zip in apps/extension/dist/
- [ ] /extension page created and accessible on chefsbk.app
- [ ] Manual install instructions clear and accurate
- [ ] Download route serves the zip file correctly
- [ ] "Browser Extension" nav item in sidebar below Settings
- [ ] No localhost or Tailscale IPs remaining in extension files
- [ ] Deployed to RPi5 and verified live
- [ ] Chrome Web Store next steps documented in DONE.md
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
