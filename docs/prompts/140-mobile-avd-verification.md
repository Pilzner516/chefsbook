# ChefsBook — Session 140: Create API 34 AVD + Verify Session 131 Mobile Features
# Source: Session 139 — cmdline-tools now installed, API 34 system image present
# Target: apps/mobile (emulator verification only)

---

## CONTEXT

Read CLAUDE.md and DONE.md before starting.

Android cmdline-tools are now installed. The API 34 system image is
already on disk at:
$ANDROID_HOME/system-images/android-34/google_apis_playstore/x86_64

This session creates an API 34 AVD, builds a fresh release APK,
installs it, and verifies the 5 features from session 131.

---

## STEP 1 — Confirm cmdline-tools are available

```bash
# Check avdmanager is accessible
$LOCALAPPDATA/Android/Sdk/cmdline-tools/latest/bin/avdmanager --version
# OR
avdmanager --version

# List available system images
$LOCALAPPDATA/Android/Sdk/cmdline-tools/latest/bin/sdkmanager --list | grep "android-34"
```

If avdmanager is not found, check alternate paths:
```bash
ls "$LOCALAPPDATA/Android/Sdk/cmdline-tools/"
```

---

## STEP 2 — Create API 34 AVD

```bash
$LOCALAPPDATA/Android/Sdk/cmdline-tools/latest/bin/avdmanager create avd \
  -n CB_API_34 \
  -k "system-images;android-34;google_apis_playstore;x86_64" \
  -d pixel_5 \
  --force
```

Verify it was created:
```bash
$LOCALAPPDATA/Android/Sdk/cmdline-tools/latest/bin/avdmanager list avd
```

---

## STEP 3 — Start the emulator

```bash
$LOCALAPPDATA/Android/Sdk/emulator/emulator \
  -avd CB_API_34 \
  -no-snapshot \
  -gpu host \
  -no-audio &

# Wait for emulator to boot
adb wait-for-device
adb shell getprop sys.boot_completed
# Keep running until returns "1"
```

---

## STEP 4 — Build fresh release APK

This also bakes in the SEND intent filter removal from session 139.

```bash
cd apps/mobile

# Stop any running Metro first
taskkill //F //IM node.exe 2>nul; sleep 2

# Set env
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"

# Clean build
rm -rf android/app/build
npx expo run:android --variant release 2>&1 | tail -30
```

Note: if build fails due to missing react in mobile node_modules,
run this workaround first:
```bash
cp -r node_modules/react apps/mobile/node_modules/react
cp -r node_modules/react-dom apps/mobile/node_modules/react-dom
```

---

## STEP 5 — Install and launch APK

```bash
# Uninstall old version first
adb uninstall com.chefsbook.app 2>/dev/null || true

# Install fresh APK
adb install android/app/build/outputs/apk/release/app-release.apk

# Wake emulator and launch app
adb shell input keyevent KEYCODE_WAKEUP
adb shell am start -n com.chefsbook.app/.MainActivity

# Watch for errors
adb logcat -s ReactNativeJS:V ReactNative:V -d | tail -20
```

---

## STEP 6 — Verify all 5 session 131 features

Take an ADB screenshot before each test, describe what you see,
then delete it:

```bash
adb exec-out screencap -p > /tmp/cb_screen.png
# describe
Remove-Item /tmp/cb_screen.png -Force
```

### Feature 1 — Notification bell
- Look for a bell icon in the Recipes tab header (top right)
- Tap it
- Does a notification panel open with tabs (All/Comments/Likes/etc)?
- Is there an unread count badge?
- PASS or FAIL + description

### Feature 2 — Messages inbox
- Look for a Messages link in the navigation
- Tap it
- Does a conversation list screen appear?
- PASS or FAIL + description

### Feature 3 — Free plan like gate
- Sign in as seblux100@gmail.com (Pro plan — verify likes work normally)
- Then check: is there a way to test with a free plan account?
- If yes: tap the heart on a recipe — does a ChefsDialog upgrade
  prompt appear?
- If no free plan test account available: verify the PLAN_LIMITS
  code has canLike = false for free tier (code check)
- PASS or FAIL + description

### Feature 4 — Translated recipe titles
- Go to Settings → change language to French
- Navigate back to the recipe list
- Do any recipe titles appear in French?
- Check: are there French translations in recipe_translations table?
  ```bash
  # SSH to RPi5 and check
  ssh rasp@rpi5-eth
  psql -U postgres -d postgres -c \
    "SELECT recipe_id, language, translated_title FROM recipe_translations WHERE language='fr' LIMIT 5;"
  ```
- PASS or FAIL + description

### Feature 5 — Recipe visibility toggle
- Open any recipe
- Tap Edit (pencil icon)
- In edit mode, look for a visibility selector
  (Private / Shared Link / Public pills or segmented control)
- PASS or FAIL + description

---

## STEP 7 — Test Instagram screenshot import (session 138 validation)

This is pending validation from session 138.

Push a test image to the emulator gallery:
```bash
# Create a simple test image or use an existing one from docs/pics/
adb push docs/pics/hero-c-warm-pasta.jpg /sdcard/Pictures/test-recipe.jpg
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
  -d file:///sdcard/Pictures/test-recipe.jpg
```

Then in the app:
- Go to Scan tab
- Tap "Scan a photo" / "Import from photo"
- Select the test image from gallery
- Verify Claude Vision attempts to extract recipe content
- PASS or FAIL + description

Note: the test image is a pasta dish — Claude Vision should detect
it as a dish photo (not a recipe document) and route to dish
identification flow.

---

## STEP 8 — Document all results

For each of the 6 tests, document clearly:
- PASS ✅ or FAIL ❌
- What was seen (ADB screenshot description)
- If FAIL: what exactly went wrong

Add all results to DONE.md as session 140 entry.

Do NOT fix any failures in this session — document only.
Failures will be addressed in session 141.

---

## COMPLETION CHECKLIST

- [ ] cmdline-tools confirmed available (avdmanager found)
- [ ] CB_API_34 AVD created successfully
- [ ] Emulator booted (sys.boot_completed = 1)
- [ ] Fresh release APK built (includes session 139 intent filter fix)
- [ ] APK installed on CB_API_34 emulator
- [ ] App launches correctly (not "Hello Android!")
- [ ] Feature 1 (notification bell): PASS or FAIL documented
- [ ] Feature 2 (messages inbox): PASS or FAIL documented
- [ ] Feature 3 (free plan like gate): PASS or FAIL documented
- [ ] Feature 4 (translated titles): PASS or FAIL documented
- [ ] Feature 5 (visibility toggle): PASS or FAIL documented
- [ ] Feature 6 (Instagram screenshot import): PASS or FAIL documented
- [ ] All results in DONE.md
- [ ] Run /wrapup
- [ ] At the end, list all 6 results clearly as PASS or FAIL with
      one-line description each. State which need follow-up in session 141.
