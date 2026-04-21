# ChefsBook — Session 142: Fix Mobile Feature Gaps from Verification
# Source: Session 140 verification results — 1 FAIL, 2 PARTIAL
# Target: apps/mobile

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, ui-guardian.md, and ALL
mandatory agents per SESSION START sequence before touching anything.

Three issues to fix from the session 140 verification:
1. FAIL: Free-plan like gate — silent failure, no upgrade dialog
2. PARTIAL: Translated recipe titles not showing in search/recipe list
3. PARTIAL: Instagram screenshot import — MediaStore indexing issue

---

## FIX 1 — Free-plan like gate: silent failure

### Problem
When a free-plan user taps the heart on a recipe:
- No DB insert happens (correct — free plan can't like)
- BUT no upgrade dialog appears either (wrong — should show ChefsDialog)
- The tap does nothing at all — silent failure

### Diagnose
Find the LikeButton component in apps/mobile.
Check:
1. Does it read the user's plan_tier from preferencesStore or user_profiles?
2. Does it check PLAN_LIMITS.canLike before calling the API?
3. If canLike = false, does it call the ChefsDialog upgrade prompt?

The web version was fixed in session 124 via an API route. Mobile may
still be calling the old toggleLike() directly or may have a broken
plan check.

### Fix
```typescript
const { planTier } = usePreferencesStore()
const canLike = PLAN_LIMITS[planTier]?.canLike ?? false

const handleLike = async () => {
  if (!canLike) {
    // Show upgrade dialog — never native Alert
    showConfirmDialog({
      title: 'Upgrade to like recipes',
      message: 'Liking recipes is available on Chef plan and above.',
      confirmLabel: 'See plans',
      cancelLabel: 'Maybe later',
      onConfirm: () => router.push('/plans')
    })
    return
  }
  // Proceed with like via API route
  const res = await fetch(`${API_BASE}/api/recipe/${recipeId}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` }
  })
  // Handle response...
}
```

Verify fix:
1. Sign in as a free-plan account
2. Tap heart on any recipe
3. Confirm ChefsDialog upgrade prompt appears
4. Confirm tapping "Maybe later" closes without any like being created
5. Confirm no silent failures in logcat

---

## FIX 2 — Translated recipe titles not showing in recipe list

### Problem
Recipe detail page correctly shows translated content when language
is set to French. BUT the recipe list/grid on the Recipes tab still
shows original English titles.

### Diagnose
Session 131 built getBatchTranslatedTitles() and wired it into the
mobile recipe list. Check:

1. Find the recipe list screen (apps/mobile/app/(tabs)/index.tsx)
2. Is getBatchTranslatedTitles() being called after recipes are fetched?
3. Is the language check correct? (should skip for 'en')
4. Are the translated titles being applied to the displayed title?

Common issues:
- Language is 'en' so the translation fetch is correctly skipped,
  but the display still shows original (correct behaviour — verify
  user's language is actually set to French in the test)
- getBatchTranslatedTitles() is called but result is not applied
  to the recipe cards
- Recipe_translations table has French titles but the query is wrong

### Check the DB first
```sql
SELECT recipe_id, language, translated_title
FROM recipe_translations
WHERE language = 'fr'
LIMIT 10;
```

If translations exist in DB but don't show in the list:
- The query is correct but the UI mapping is broken
- Fix: ensure the translated title replaces the display title in the
  recipe card component, not just in the detail screen

If no translations in DB:
- The backfill from session 125 may not have run for all recipes
- Run the backfill script: node scripts/backfill-translations.mjs

### Fix
In the recipe list component, after fetching recipes and translations:

```typescript
const { language } = usePreferencesStore()

useEffect(() => {
  if (language === 'en' || !recipes.length) return

  const ids = recipes.map(r => r.id)
  getBatchTranslatedTitles(ids, language).then(translations => {
    setDisplayRecipes(recipes.map(r => ({
      ...r,
      title: translations[r.id] ?? r.title  // fall back to original
    })))
  })
}, [recipes, language])
```

Verify: switch language to French → recipe list titles change.

---

## FIX 3 — Instagram screenshot import: MediaStore indexing

### Problem
When an image is pushed to the emulator via:
`adb push file.jpg /sdcard/Pictures/`
The file exists on disk but doesn't appear in the Gallery app or
the photo picker because Android's MediaStore hasn't indexed it.

This is an emulator-specific issue — on a real device, photos taken
or downloaded normally are indexed automatically.

### Fix for testing
Add a MediaStore scan trigger after pushing files in the test prompt.
This is a TESTING fix, not a production fix.

For production use, users select photos from their real gallery which
are already indexed. The underlying import flow is correct.

However, verify the import flow works with a properly indexed image:

On the emulator:
```bash
# Push image
adb push docs/pics/hero-c-warm-pasta.jpg /sdcard/Pictures/test-pasta.jpg

# Trigger MediaStore scan
adb shell am broadcast \
  -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
  -d file:///sdcard/Pictures/test-pasta.jpg

# Wait 3 seconds then check if it appears
adb shell content query \
  --uri content://media/external/images/media \
  --projection _display_name \
  | grep test-pasta
```

Then test in the app:
1. Go to Scan tab → "Scan a photo"
2. Select test-pasta.jpg from gallery
3. Confirm Claude Vision processes it
4. Confirm dish identification flow triggers (not recipe scan)
   since it's a food photo, not a recipe document

Mark as PASS if the flow works end-to-end with a properly indexed image.

---

## BUILD AND VERIFY

After fixing issues 1 and 2, build a new release APK:

```bash
cd apps/mobile
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
rm -rf android/app/build
npx expo run:android --variant release 2>&1 | tail -20
```

Install on CB_API_34 emulator (should already be running):
```bash
adb uninstall com.chefsbook.app 2>/dev/null || true
adb install android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.chefsbook.app/.MainActivity
adb shell input keyevent KEYCODE_WAKEUP
```

Re-verify fixes:
1. Free plan like gate: take ADB screenshot, describe result
2. Translated titles: switch to French, take ADB screenshot, describe
3. Instagram screenshot: push + scan image, describe result

---

## COMPLETION CHECKLIST

- [ ] LikeButton plan check diagnosed — root cause found
- [ ] ChefsDialog upgrade prompt shows for free-plan like attempt
- [ ] No silent failures on like tap for free plan
- [ ] Translated titles appear in recipe list (not just detail) when FR
- [ ] DB confirmed: French translations exist for recipes
- [ ] MediaStore scan trigger documented for testing
- [ ] Instagram screenshot import verified with properly indexed image
- [ ] New release APK built incorporating fixes
- [ ] All 3 re-verified on emulator with ADB screenshots
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes mobile
- [ ] Run /wrapup
- [ ] At the end, list all 3 as PASS/FAIL/PARTIAL with one-line
      description each.
