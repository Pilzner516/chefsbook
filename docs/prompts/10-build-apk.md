# ChefsBook — Session: Build Release APK
# Source: Post QA sessions 01–09
# Target: apps/mobile

---

## CONTEXT

All QA fixes from the 2026-04-07 report are complete. Build a fresh release APK for device
testing. Local Gradle build only — do not use EAS.

---

## PRE-BUILD CHECKS

Before building, verify:

1. **Metro / TypeScript** — run `npx tsc --noEmit` from `apps/mobile`. Fix any type errors
   before proceeding. Do not build with type errors present.

2. **Expo prebuild** — if any native config changed (app.json, plugins, new packages with
   native modules) since the last build, run:
   ```
   cd apps/mobile
   npx expo prebuild --clean
   ```
   Native config changes in this cycle that require prebuild:
   - `expo-secure-store` wired as Supabase auth storage adapter
   - `react-i18next` / `i18next` installed
   - App icon regenerated (`--clean` was already run in session 01 but run again to be safe)

3. **Environment** — confirm `JAVA_HOME` and `ANDROID_HOME` are set correctly in the current
   terminal session:
   ```powershell
   echo $env:JAVA_HOME
   echo $env:ANDROID_HOME
   ```
   If not set, apply the known working values from CLAUDE.md before continuing.

---

## BUILD

```powershell
cd apps/mobile/android
.\gradlew assembleRelease
```

Expected output location:
```
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

If the build fails:
- Read the full error before attempting any fix
- Fix the root cause — do not patch around it
- Common issues from previous builds: duplicate class conflicts (check
  `android/app/build.gradle` AndroidX settings), Metro bundle errors (check blockList in
  `metro.config.js`)

---

## POST-BUILD

1. Note the APK file size and confirm it is reasonable (previous builds were in the expected
   range — flag if significantly larger due to i18n locale files, though 50–100kb increase
   is expected and acceptable).

2. If an Android device or emulator is connected, install and do a quick smoke test:
   ```powershell
   adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
   ```
   Smoke test checklist:
   - [ ] App launches and shows landing screen with chef's hat icon
   - [ ] Sign in works and session persists on reopen
   - [ ] Recipe list loads
   - [ ] Language selector shows exactly 5 languages
   - [ ] Shopping list "New list" button visible above Android nav bar
   - [ ] Meal plan shows 7 day cards for an empty week

3. Record the APK path and build date in DONE.md.

---

## COMPLETION CHECKLIST

- [ ] TypeScript passes with no errors
- [ ] `expo prebuild --clean` run if needed
- [ ] `assembleRelease` completes successfully
- [ ] APK located at expected output path
- [ ] APK installed and smoke tested on device/emulator
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
