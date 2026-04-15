# ChefsBook — Session 138: Instagram Import — Test Share Target or Remove + Enhance Photo Import
# Source: Instagram URL import is broken — test share target first, then decide
# Target: apps/mobile + apps/web + packages/ai

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and import-pipeline.md
before touching anything.

Instagram import via URL scraping is unreliable. This session takes a
decisive approach:

1. First: test if the mobile share target handler actually works
2. If YES: fix it and keep it
3. If NO: remove Instagram import entirely and enhance the photo/image
   import flow as the replacement

---

## STEP 1 — Test the mobile share target handler

The share target was built in session 22. When a user taps "Share" on
an Instagram post and selects ChefsBook, the app should receive the
Instagram URL and route it to the Instagram import handler.

### Test procedure:
1. Start the mobile app on the emulator or device
2. Open any public Instagram post in the Instagram app or browser
3. Tap Share → find ChefsBook in the share sheet
4. Does ChefsBook appear as a share target?
5. If yes: does it receive the URL correctly?
6. Check logcat for what URL is received:
   ```bash
   adb logcat -s ReactNativeJS:V -d | grep -i "instagram\|share\|intent" | tail -20
   ```

### Check the intent filter in app.json:
Read apps/mobile/app.json — does it have the correct intent filter
for receiving shared URLs from other apps?

Should look like:
```json
{
  "intentFilters": [
    {
      "action": "VIEW",
      "data": [{ "scheme": "https", "host": "www.instagram.com" }],
      "category": ["BROWSABLE", "DEFAULT"]
    },
    {
      "action": "SEND",
      "data": [{ "mimeType": "text/plain" }],
      "category": ["DEFAULT"]
    }
  ]
}
```

### Check the URL handler in _layout.tsx:
Does it correctly detect Instagram URLs and route them?

---

## DECISION POINT

### If share target works (ChefsBook appears in share sheet AND receives URL):
- Fix whatever is broken in the import handler
- Keep Instagram import
- Mark LIVE in feature registry

### If share target does NOT work OR is too unreliable:
Execute STEP 2 — remove Instagram and enhance photo import.

---

## STEP 2 (if share target fails) — Remove Instagram import cleanly

### 2a — Remove from mobile
In apps/mobile/app/scan.tsx:
- Remove the Instagram grid cell/button entirely
- Remove the Instagram paste input and clipboard handler
- Remove the dedicated Instagram import flow/screen
- Remove isInstagramUrl() calls (keep the function in case needed later)

### 2b — Remove from web
In apps/web/app/dashboard/scan/page.tsx:
- Remove any Instagram-specific UI or routing
- The isInstagramUrl() check added in session 127 can stay as a
  guard that shows: "Instagram import not supported — screenshot
  the post and use Photo Import instead"

### 2c — Remove from packages/ai
- Comment out (do not delete) fetchInstagramPost() and
  extractRecipeFromInstagram() — keep the code but mark as disabled
- Add a comment: // Instagram scraping disabled — unreliable without auth

### 2d — Update feature-registry.md
Mark Instagram import as REMOVED with note:
"Removed session 138 — scraping unreliable. Use photo import instead."

---

## STEP 3 — Enhance photo/image import as the replacement

The photo import (scan a photo) already works. Make it the clear,
prominent replacement for Instagram import.

### 3a — Update the import UI copy

On mobile scan tab, where Instagram used to be OR on the existing
photo import option, add clear guidance:

```
Import from Instagram?
Screenshot the post, then tap "Scan a photo" to import it.
ChefsBook reads recipe photos, screenshots, and handwritten notes.
```

This sets expectation correctly — screenshot → scan is the flow.

### 3b — Improve the photo import for screenshot handling

Screenshots of Instagram posts have a specific layout:
- Recipe photo at top
- Caption text below (may contain recipe)
- Username and post metadata

Update the Claude Vision prompt in scanRecipe() to handle this case:

Add to the prompt:
"If this appears to be a screenshot of a social media post (Instagram,
TikTok, Facebook), extract any recipe content from both the image AND
any visible caption/text. The caption may contain ingredients and steps
in an informal format — extract and structure them properly."

### 3c — Mobile: make photo import more prominent

In the scan tab grid, ensure "Scan a photo" / "Import from photo" is
the most visually prominent import option (largest card or top position)
since it's now the primary import path for social media content.

### 3d — Add a tip card on the scan tab

Add a subtle tip below the import grid on mobile:

```
💡 Tip: See a recipe on Instagram or TikTok?
Screenshot it and import with "Scan a photo" — we'll read it for you.
```

Style as a small cream card with the tip text. Dismissible.

---

## STEP 4 — Test photo import with an Instagram screenshot

Take a real Instagram screenshot of a recipe post and test the import:

1. Save a screenshot to the emulator gallery
2. Use "Import from photo" / "Scan a photo"
3. Confirm Claude Vision extracts title, ingredients, steps
4. Confirm the recipe image is captured from the screenshot

If extraction quality is poor (informal caption format), iterate on
the Claude Vision prompt until it handles social media screenshots well.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Only restart PM2 if build exits with code 0.
Do not build while other sessions are deploying.

---

## COMPLETION CHECKLIST

### Share target test
- [ ] Tested share target on device/emulator
- [ ] Documented result: WORKS or FAILS

### If keeping Instagram:
- [ ] Share handler correctly receives and routes Instagram URL
- [ ] Recipe extracted with image
- [ ] Feature registry: Instagram import → LIVE

### If removing Instagram:
- [ ] Instagram grid cell removed from mobile scan tab
- [ ] Instagram paste/clipboard handler removed from mobile
- [ ] Instagram import flow/screen removed from mobile
- [ ] Web: Instagram URLs show helpful redirect message
- [ ] packages/ai: Instagram functions commented out (not deleted)
- [ ] Feature registry: Instagram import → REMOVED

### Photo import enhancement (always do this):
- [ ] Claude Vision prompt updated for social media screenshots
- [ ] "Scan a photo" is most prominent import option on mobile
- [ ] Tip card added: "Screenshot Instagram → Scan a photo"
- [ ] Tested with real Instagram screenshot → recipe extracted
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end, clearly state: KEPT or REMOVED Instagram import,
      and why. Recap what was completed and what was left incomplete.
