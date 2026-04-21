# Prompt 205: Camera capture fails silently back to My Recipes

## Scope
MOBILE APP ONLY. Single issue: camera capture on the Scan tab.

Do NOT modify apps/web. Do NOT touch the GuidedScanFlow (FIX 3 from session 203) beyond what's needed to receive the captured image. Do NOT touch the floating tab bar, splash screen, or any other subsystem.

## Context
Session 203 attempted to fix camera capture by wrapping the code in a try/catch. On device verification shows the bug is NOT fixed and is possibly worse: user taps camera, takes photo, approves with OK, the app falls back to My Recipes tab with no import flow triggered and no visible error.

The try/catch is SUSPECT, not a fix. The most likely explanation is that session 203's wrapping silently swallows the real error — a result-shape mismatch, an undefined property access, or similar — and the caller then navigates away without knowing anything failed.

Gallery selection still works. That is the reference path. Anything the camera path does differently from gallery is a candidate root cause.

## SESSION START (mandatory)
Read CLAUDE.md, DONE.md, AGENDA.md, .claude/agents/testing.md, .claude/agents/navigator.md.

Read the session 203 and session 204 entries in DONE.md in full. Specifically look at what FIX 2 changed in apps/mobile/app/(tabs)/scan.tsx.

## Global constraints
- All new UI strings MUST go through i18n (5 locales).
- All dialogs MUST use ChefsDialog, not native Alert.
- Do NOT run `expo prebuild --clean`.
- Do NOT commit apps/mobile/android/ (gitignored).
- Root-cause the bug. Do not add another try/catch on top of the existing one. Do not add a second try/catch elsewhere.
- If the diagnosis turns out to require changes outside scan.tsx (e.g., a shared @chefsbook/ai helper signature), STOP and report before touching those files.

## Phase 1 — Diagnostic (mandatory, pause after)

### Step 1.1 — Inspect session 203's FIX 2 diff
```
git show df43990 -- apps/mobile/app/(tabs)/scan.tsx
```
Report:
- What try/catch wrapping was added
- What's inside the try block (what call is being wrapped)
- What the catch block does (does it log, does it alert, does it silently return)
- What state-setters or navigation calls come AFTER the try/catch

### Step 1.2 — Diff camera path vs gallery path
In scan.tsx, find both:
- The gallery picker handler (likely `launchImageLibraryAsync` + result handling)
- The camera handler (likely `launchCameraAsync` + result handling)

Report side-by-side:
- Result shape access (`result.uri` vs `result.assets[0].uri` vs `result.assets?.[0]?.uri`)
- `canceled` vs `cancelled` property check
- How the resulting URI/base64 is passed downstream
- Any mount/unmount guards (e.g., `if (!mounted.current) return`)

### Step 1.3 — Surface the real error
Session 203's try/catch is hiding information. Temporarily instrument it to surface what's actually happening. Two options:
- (a) Add `console.error('camera capture error:', e, JSON.stringify(e))` inside the catch so logcat shows it
- (b) Temporarily remove the try/catch entirely so React Native's red box appears

Pick (a) for less disruption. Push a dev build OR add a debug APK build + install. If building is too slow, just read the code and reason from the diff — but say so explicitly.

### Step 1.4 — Reproduce with logcat
If a device/emulator is available:
```
adb logcat -c
adb logcat | grep -iE "ReactNative|camera|ImagePicker|scan"
```
Trigger camera capture, take photo, approve. Capture the output.

If no device is available, say so and proceed to Step 1.5 based on code inspection alone.

### Step 1.5 — Report and PAUSE
Post to the user before writing any fix:
- What the camera handler does step-by-step
- What the gallery handler does step-by-step
- The specific line(s) where they diverge
- The most likely root cause (with confidence: high/medium/low)
- Your proposed fix in plain English (not code yet)

**DO NOT WRITE THE FIX YET. WAIT FOR USER APPROVAL.**

This pause is not optional. Session 203 failed because FIX 1's investigation pause was skipped. This prompt will not accept a skipped pause.

## Phase 2 — Implementation (only after approval)

Implement the approved fix. Remove session 203's try/catch as part of the fix if it's masking the bug — do not leave a dead try/catch around a now-working call.

If the root cause was in a shared package (@chefsbook/ai or similar), fix it there and update the call site.

If the root cause was SDK result-shape, normalize at the result boundary (the handler), not deep in the import pipeline.

## Phase 3 — Verification (mandatory)

Agent must provide evidence the fix works, not just "code looks right." Acceptable evidence, in decreasing order of preference:
1. adb logcat capture showing camera → photo taken → import flow triggered (no error)
2. ADB screencap sequence: camera preview → photo approval → Step A of GuidedScanFlow appearing
3. If no device/emulator available: a crisp written explanation of why the fix addresses the specific error surfaced in Phase 1, AND an explicit note that user-device verification is pending

Regression check: gallery selection still works and reaches the same GuidedScanFlow entry point.

Do NOT declare "done" without at least #3. "The code should work" is not evidence.

## Phase 4 — Rebuild + wrap

Rebuild release APK per prompt 200 procedure:
```
cd apps/mobile/android
./gradlew assembleRelease --no-daemon
```
Verify apksigner cert identity matches session 142 fingerprint (29f59dba...).

Report APK path + size.

Run /wrapup. DONE.md entry must include:
- Root cause (one sentence, specific)
- Files changed
- Verification evidence per Phase 3
- TYPE: CODE FIX tag
- Explicit note: session 203's try/catch was/wasn't the masking layer

Commit message: `fix(mobile): session 205 - camera capture root-cause fix (session 203 try/catch was masking <specific error>)`

Push both chefsbook and bob-hq repos.

## Failure modes to avoid
- Adding another try/catch. One try/catch around a broken call is a patch. Two is malpractice.
- Declaring "fixed" based on code review alone. Phase 3 requires evidence.
- Touching the GuidedScanFlow internals. This session is purely about getting the captured photo INTO the flow.
- Skipping the Phase 1 pause. The pause exists because session 203 skipped its pause and produced a regression worse than the original bug.
