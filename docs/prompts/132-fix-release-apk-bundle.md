# ChefsBook — Session 132: Fix Release APK "Hello Android!" Bundle Issue
# Source: Session 131 — release APK renders default template instead of ChefsBook UI
# Target: apps/mobile

---

## CONTEXT

Read CLAUDE.md and DONE.md before starting.

The release APK builds and signs correctly (verified via apksigner) but
renders "Hello Android!" instead of the ChefsBook UI. This is a stale
Hermes bundle issue — Gradle skipped bundle regeneration on the second
build attempt.

Root cause: the JS bundle file was from a previous build (15:49) but
the second Gradle build ran at 16:07 and used the cached bundle instead
of regenerating it.

---

## STEP 1 — Full clean rebuild

```bash
cd apps/mobile

# Kill any running Metro instances
taskkill //F //IM node.exe 2>nul

# Full clean
rm -rf android/app/build
rm -rf android/.gradle
rm -rf node_modules/.cache

# Rebuild release APK from scratch
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
npx expo run:android --variant release 2>&1 | tail -30
```

---

## STEP 2 — Verify the bundle was regenerated

After the build, confirm the bundle timestamp is current:

```bash
# Bundle should have today's timestamp
ls -la android/app/build/generated/assets/createBundleReleaseJsAndAssets/
# File: index.android.bundle
# Size should be 3-5MB (contains full app)
# Timestamp should match current time
```

---

## STEP 3 — Install and test on emulator

```bash
# Uninstall existing APK first (signature mismatch otherwise)
adb uninstall com.chefsbook.app 2>/dev/null || true

# Install fresh APK
adb install android/app/build/outputs/apk/release/app-release.apk

# Launch app
adb shell am start -n com.chefsbook.app/.MainActivity

# Watch logcat for errors
adb logcat -s ReactNativeJS:V ReactNative:V -d | tail -30
```

---

## STEP 4 — Take ADB screenshots of key screens

Once the app loads correctly, take screenshots and describe each:

```bash
# Wake emulator first
adb shell input keyevent KEYCODE_WAKEUP

# Screenshot
adb exec-out screencap -p > /tmp/cb_screen.png
# Describe what you see
Remove-Item /tmp/cb_screen.png -Force
```

Capture and describe these screens:
1. Landing/auth screen — does it show ChefsBook branding?
2. Sign-in screen — all fields visible?
3. After sign-in — Recipes tab with recipe list
4. Recipe detail — attribution pills, like/save counts, comments section
5. Notification bell — does it open the panel?
6. Settings — Help Tips toggle, language selector, unit toggle

---

## STEP 5 — Verify new features from session 131

For each feature, describe what you see on screen:

1. **Notification bell** — is there a bell icon in the header?
   Tap it — does a panel open with tabs?

2. **Messages** — is there a Messages link in nav?
   Tap it — does a conversation list appear?

3. **Like gate** — sign in as a free plan user, try to like a recipe
   Does a ChefsDialog upgrade prompt appear?

4. **Translated titles** — switch language to French in settings
   Do recipe titles change in the list?

5. **Visibility toggle** — open a recipe in edit mode
   Is there a Private/Shared Link/Public selector?

---

## COMPLETION CHECKLIST

- [ ] Full clean rebuild completed (android/app/build deleted first)
- [ ] Bundle timestamp confirmed current (not stale)
- [ ] APK installs without "INSTALL_FAILED_UPDATE_INCOMPATIBLE"
- [ ] App launches and shows ChefsBook UI (not "Hello Android!")
- [ ] ADB screenshots taken and described for 6 key screens
- [ ] Notification bell opens panel on tap
- [ ] Messages screen shows conversation list
- [ ] Free plan like gate shows upgrade dialog
- [ ] Language switch shows translated titles
- [ ] Visibility toggle visible in edit mode
- [ ] tsc --noEmit passes mobile
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed,
      what was left incomplete, and why.
