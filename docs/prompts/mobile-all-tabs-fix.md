# Prompt: Mobile App — All Pages Crash Fix (All-Night Session)

## PASTE THIS INTO CLAUDE CODE

```
/model opus
```

Then paste:

```
ralph

CRITICAL: The mobile app is unusable. Login works and the recipe page loads, but every other page on the floating tab menu causes an immediate crash. This needs to be fully fixed tonight — do not stop until all 5 tabs work without crashing and are verified with ADB screenshots.

## Current state
- ✅ Login works (Supabase URL fixed to https://api.chefsbk.app in apps/mobile/.env.local)
- ✅ Recipe page / My Recipes tab loads
- ❌ Every other floating tab bar page crashes immediately on tap

## Floating tab bar pages to fix (all 5 must work)
1. Recipes (My Recipes) — ✅ WORKS — baseline
2. Search — ❌ CRASHES
3. Scan — ❌ CRASHES
4. Plan (Meal Planner) — ❌ CRASHES
5. Cart (Shopping List) — ❌ CRASHES

## Critical history — read before touching anything

### Tab bar architectural history (important)
- Session 203: Moved FloatingTabBar to root _layout.tsx with pathname-based visibility — caused bar to disappear everywhere (regression)
- Session 204: Reverted session 203's FIX 1, restored FloatingTabBar to (tabs)/_layout.tsx — bar visible on 5 tabs again
- Session SPEAK-FLOATINGBAR-FIX: Added /speak and /cook-menu to exclusion list in _layout.tsx
- Current state: FloatingTabBar is in (tabs)/_layout.tsx via tabBar prop

### Known pre-existing issues (do not fix these tonight, just note them)
- FloatingTabBar missing on recipe detail + other root-Stack screens (pre-existing, not tonight's issue)
- Camera capture drops back to My Recipes tab silently
- Native-splash → JS-splash flash on cold launch

### Known gotchas (check each before building)
- Delete stale JS bundle before ANY rebuild: rm -f android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle
- After expo prebuild --clean: re-add android.enableJetifier=true to gradle.properties AND re-apply signing config to build.gradle
- React pinned to 19.1.0 — do NOT upgrade (19.1.4 causes frozen object crash with RN 0.81)
- Mobile Supabase URL = https://api.chefsbk.app (set in apps/mobile/.env.local)
- Expo file-system v19: use expo-file-system/legacy import for documentDirectory/readAsStringAsync/writeAsStringAsync
- Native modules use lazy require() in try/catch
- cook-mode/[id].tsx was recently added — confirm it is in the FloatingTabBar exclusion list

### Recent changes that may have introduced crashes
- cook-mode-ui.md session added new routes: /cook/[recipeId] on web and apps/mobile/app/cook/[id].tsx on mobile
- community-knowledge.md session added GapRequestCard, points system, gap contribution wiring
- knowledge-graph-promotion.md session updated inferStepTimings.ts
- Check if any of these introduced import errors, missing dependencies, or route conflicts

## Step 1 — Diagnose BEFORE touching any code

Run ADB logcat while tapping each crashing tab. Capture the exact error for each:

```powershell
adb logcat -c
# tap the Search tab
adb logcat -d | Select-String -Pattern "(FATAL|Exception|Error|ReactNativeJS)" | Select-Object -Last 30
```

Repeat for each crashing tab. Document the exact error message and stack trace for each one. Do not write any code until you have the crash reason for all 4 failing tabs.

## Step 2 — Fix each crash

Fix crashes in order of complexity (simplest first). For each fix:
1. State what the crash was
2. State what the fix is
3. Apply the fix
4. Do NOT rebuild after each individual fix — batch all fixes then do one build

Common crash causes to check for each tab:
- Missing or incorrect imports (especially new packages added in recent sessions)
- Route conflicts with new cook/[id] route
- New components (GapRequestCard, PointsDisplay) imported but dependencies missing on mobile
- AsyncStorage vs SecureStore usage
- expo-file-system legacy import missing
- TypeScript errors that were ignored on web but crash on mobile

## Step 3 — Single rebuild after all fixes

After all crashes are diagnosed and fixed:
1. Delete stale bundle: rm -f android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle
2. Run TypeScript check: npx tsc --noEmit (fix any errors before building)
3. Build: ./gradlew assembleRelease --no-daemon
4. Install: adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk

## Step 4 — Verify ALL 5 tabs with screenshots

For each of the 5 tabs, capture an ADB screenshot and confirm no crash:

```powershell
adb shell input tap [x] [y]  # tap the tab
Start-Sleep -Seconds 3
adb exec-out screencap -p > $env:TEMP\tab-[name].png
adb logcat -d | Select-String -Pattern "(FATAL|Exception)" | Select-Object -Last 10
```

Required screenshots:
1. tab-recipes.png — My Recipes tab (baseline)
2. tab-search.png — Search tab working
3. tab-scan.png — Scan tab working
4. tab-plan.png — Plan tab working
5. tab-cart.png — Cart/Shopping tab working

## Definition of done — ALL must be true before stopping
1. All 5 tabs load without crash
2. 0 FATAL errors in logcat for each tab
3. 0 JavascriptException errors in logcat for each tab
4. ADB screenshot showing content (not blank/crash screen) for each tab
5. TypeScript check passes before build
6. Signed APK built with correct keystore (SHA-256 matches previous sessions)

## If a tab still crashes after the first fix attempt
Do not give up. Run logcat again, get the new error, fix it, rebuild. ralph mode means you loop until all 5 pass. Do not mark complete until all 5 definition-of-done criteria are met.

## When all 5 tabs are verified working
Run /wrapup
```
