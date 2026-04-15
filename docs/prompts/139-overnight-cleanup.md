# ChefsBook — Session 139: Overnight Cleanup Bundle
# Source: Accumulated small items from sessions 126-138
# Target: apps/mobile + apps/web + packages/ai

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ai-cost.md before
starting. This session handles 4 independent cleanup items. Complete
all of them.

---

## ITEM 1 — Remove stale Instagram locale keys (mobile + web)

### Mobile — remove from all 5 locale files
Search for and remove these keys from every locale file in
apps/mobile/locales/ (en.json, fr.json, es.json, it.json, de.json):
- pasteInstagramUrl
- scan.instagram* (any key starting with scan.instagram)
- postImport.fromInstagram

```bash
grep -r "instagram\|Instagram" apps/mobile/locales/ --include="*.json" -l
```

Show the results, then remove only the orphaned keys (keys with no
code references). Verify no code references them first:

```bash
grep -r "pasteInstagramUrl\|fromInstagram\|scan\.instagram" \
  apps/mobile/app apps/mobile/components \
  --include="*.tsx" --include="*.ts"
```

If grep returns nothing: safe to remove from all locale files.

### Web — same check
```bash
grep -r "instagram" apps/web/locales/ --include="*.json" -l
grep -r "scan\.instagram\|fromInstagram" \
  apps/web/app apps/web/components \
  --include="*.tsx" --include="*.ts"
```

Remove any orphaned Instagram locale keys from web locale files too.

---

## ITEM 2 — Remove SEND intent filter from app.json

In apps/mobile/app.json, find and remove the SEND intent filter that
causes ChefsBook to appear in Instagram's share sheet as a dead option:

The filter to remove looks like:
```json
{
  "action": "SEND",
  "data": [{ "mimeType": "text/plain" }],
  "category": ["DEFAULT"]
}
```

Keep the VIEW intent filter for deep links (chefsbk.app/recipe/*)
Keep any other valid intent filters.

After removing, verify app.json is valid JSON:
```bash
node -e "JSON.parse(require('fs').readFileSync('apps/mobile/app.json','utf8')); console.log('valid')"
```

Note: this change only takes effect after a new APK build (expo prebuild).
Document in CLAUDE.md that a new APK build is needed for this to apply.

---

## ITEM 3 — AI cost audit: fix 8 missing functions + wrong models

Read packages/ai/src/ fully and list every function that calls
callClaude() or the Anthropic API.

Cross-reference with the AI cost reference table in CLAUDE.md.

### 3a — Add missing functions to CLAUDE.md cost table
For each function NOT in the table, add a row:
| Function | Model | Est. cost/call | Cached? |

### 3b — Fix mergeShoppingList and suggestRecipes model
The audit found these use Sonnet but should use Haiku
(classification/simple tasks):

Find mergeShoppingList() and suggestRecipes() in packages/ai.
If they use Sonnet for simple tasks:
- Switch to HAIKU model
- Verify output quality is not degraded (Haiku handles simple
  classification and list operations well)

Pattern:
```typescript
// Before
const result = await callClaude({ prompt, model: SONNET })

// After
const result = await callClaude({ prompt, model: HAIKU })
```

### 3c — Update CLAUDE.md AI cost table
Ensure every AI function is documented with:
- Function name
- Model (HAIKU or SONNET)
- Estimated cost per call
- Whether it's cached

---

## ITEM 4 — Mobile APK: verify session 131 features on emulator

Start the Android emulator (API 33 or 34 preferred, not 36).
Build and install the latest release APK:

```bash
cd apps/mobile
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"

# Clean build
rm -rf android/app/build
npx expo run:android --variant release 2>&1 | tail -20

# Install
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.chefsbook.app/.MainActivity
adb shell input keyevent KEYCODE_WAKEUP
```

Take ADB screenshots and describe what you see for each:

```bash
adb exec-out screencap -p > /tmp/cb_screen.png
# describe, then delete
Remove-Item /tmp/cb_screen.png -Force
```

Verify these 5 features from session 131:

1. **Notification bell** — is there a bell icon in the Recipes tab
   header? Tap it — does a panel open with notification tabs?

2. **Messages** — is there a Messages link in nav?
   Tap it — does a conversation list appear?

3. **Like gate** — sign in as a free plan account, tap heart on a
   recipe. Does a ChefsDialog upgrade prompt appear?

4. **Translated titles** — switch language to French in settings.
   Do recipe titles change to French in the recipe list?

5. **Visibility toggle** — open a recipe in edit mode.
   Is there a Private/Shared Link/Public selector?

For each: PASS or FAIL with description of what you saw.

If any FAIL: document the failure clearly in DONE.md for next session.
Do not fix in this session — just document.

---

## DEPLOYMENT (web only — items 1 and 3 may affect web)

Only deploy if web files were changed:

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

### Item 1 — Locale cleanup
- [ ] Stale Instagram keys found and listed
- [ ] Confirmed no code references them
- [ ] Removed from all 5 mobile locale files
- [ ] Removed from web locale files if present
- [ ] tsc --noEmit passes mobile + web

### Item 2 — Intent filter
- [ ] SEND intent filter removed from app.json
- [ ] app.json validates as valid JSON
- [ ] CLAUDE.md updated: new APK build needed for this to apply
- [ ] VIEW intent filter and other valid filters preserved

### Item 3 — AI cost audit
- [ ] All callClaude() functions found and listed
- [ ] 8+ missing functions added to CLAUDE.md cost table
- [ ] mergeShoppingList() switched to HAIKU if using Sonnet
- [ ] suggestRecipes() switched to HAIKU if using Sonnet
- [ ] CLAUDE.md cost table complete and accurate
- [ ] tsc --noEmit passes packages/ai

### Item 4 — Mobile APK verification
- [ ] Emulator started (API 33 or 34)
- [ ] Release APK built and installed
- [ ] 5 features tested with ADB screenshots
- [ ] PASS/FAIL documented for each feature
- [ ] Any failures documented in DONE.md for next session

### General
- [ ] feature-registry.md updated
- [ ] Deployed to RPi5 if web changes made
- [ ] Run /wrapup
- [ ] At the end, recap: what passed, what failed, what was cleaned
      up, and what still needs follow-up.
