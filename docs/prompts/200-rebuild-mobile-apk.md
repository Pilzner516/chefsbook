# Prompt 200: Rebuild mobile release APK for demo

## Goal
Build a fresh signed release APK from current main so Bob can sideload it to his Android device and demo. The last verified build was session 142 (2026-04-15). Since then, session 193 added paste-text import to the mobile Scan tab — that's the main user-visible change to capture.

No new features. No code changes. Build + verify only.

## SESSION START (mandatory)
Follow the 9-step SESSION START sequence per CLAUDE.md. Read testing.md and deployment.md agents.

## Constraints
- Do NOT fix any TS or lint errors found along the way. Document and move on. The pre-existing expo-file-system upstream error is known and harmless.
- Do NOT run `expo prebuild --clean` unless the signing config is already gone. Prebuild wipes `android/app/build.gradle`'s signing block and you'll spend the rest of the session re-applying it.
- Do NOT start Metro. This is a Gradle-only build.
- Do NOT attempt emulator verification. CB_API_34 is on a 100%-full C: drive (session 140 disk blocker is still open). Physical device will be used by Bob post-session.
- Do NOT commit anything unless explicitly needed. `apps/mobile/android/` is gitignored by design.

## Steps

### 1. Pre-flight verification
Before touching anything:
- `git status` — working tree should be clean, on main
- `git pull origin main` — confirm at latest commit
- Verify signing config is intact:
  - `apps/mobile/android/chefsbook-release.keystore` exists
  - `apps/mobile/android/keystore.properties` exists
  - `apps/mobile/android/app/build.gradle` contains `signingConfigs.release` block reading `keystore.properties`
  - The release buildType uses `signingConfig signingConfigs.release` (NOT `signingConfigs.debug`)

If ANY of those four are missing, STOP and report. Do not attempt to regenerate the keystore — it's a 27-year cert that must persist.

### 2. Dependency sanity check (session 138 regression guard)
- Confirm `apps/mobile/node_modules/react` and `apps/mobile/node_modules/react-dom` both exist
- If missing, copy from root: `cp -r node_modules/react apps/mobile/node_modules/` and same for react-dom
- Confirm `react-native-worklets` is installed in `apps/mobile/node_modules` (session 137 peer dep)

### 3. Typecheck (non-blocking, for the record)
```bash
cd apps/mobile && npx tsc --noEmit
```
Expected: only the pre-existing expo-file-system error. Log it, continue.

### 4. Build the release APK
From `apps/mobile/android`:
```bash
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
./gradlew assembleRelease --no-daemon
```

Pipe output to a timestamped log file. Expected duration: 1–10 min.

### 5. Verify the output
- APK exists at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Report file size (session 142 reference: ~111 MB)
- Run apksigner to verify signing identity:
  ```bash
  $ANDROID_HOME/build-tools/<version>/apksigner.bat verify --print-certs \
    apps/mobile/android/app/build/outputs/apk/release/app-release.apk
  ```
  Expected: `CN=ChefsBook App, O=ChefsBook, L=Greenwich, ST=CT, C=US` (matches session 142 keystore fingerprint)

If signing identity does NOT match, STOP and report. Do not attempt to re-sign — the keystore identity is the Play Store identity.

### 6. Report back
Post the following in the session summary:
- Commit SHA the APK was built from
- APK file path + size
- Signing cert subject line
- Typecheck result
- Any warnings/errors encountered and whether they're pre-existing
- Sideload command for Bob to run when he gets back:
  ```
  adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
  ```
  (With the note that if `INSTALL_FAILED_UPDATE_INCOMPATIBLE` appears, `adb uninstall com.chefsbook.app` first.)

## Wrapup
Run /wrapup. Session type: BUILD. No DATA FIX or CODE FIX tags — this is a distribution build, not a bug fix.

Update DONE.md with:
- Session number
- Commit SHA
- APK path + size + signing cert
- Note that this captures session 193's paste-text import on mobile Scan tab (main user-visible delta since session 142)
- Known gaps vs web still not addressed on mobile (carry forward from session 142 notes): duplicate detection interstitial, refresh-from-source banner on recipe detail, image-regen pills/creativity controls, incomplete recipes banner
