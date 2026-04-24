# Prompt: Mobile Floating Bar + Camera Capture Fixes
# Launch: Read docs/prompts/prompt-mobile-fixes.md and execute it fully.

## OBJECTIVE
Fix two open mobile bugs from sessions 204/205 on the Android app.
This is a mobile-only session — no web changes.

## PRE-FLIGHT
1. Read `apps/mobile/agents/CLAUDE.md` fully
2. Read `.claude/agents/ui-guardian.md` — MANDATORY
3. Read `.claude/agents/testing.md` — MANDATORY
4. Read `.claude/agents/navigator.md` — read before any screen navigation
5. Launch emulator: `emulator -avd Medium_Phone_API_36.1 -no-snapshot -gpu host`
6. Confirm app builds and loads: `cd apps/mobile && REACT_NATIVE_PACKAGER_HOSTNAME=localhost npx expo start`
7. ADB screenshot of current state before touching anything

## BUG 1 — Floating Edit Bar

### Symptom (as reported from session 204/205)
The floating action bar on the recipe detail screen in mobile has issues.
Check DONE.md for the exact symptom reported in sessions 204/205.
If DONE.md doesn't have it, inspect the current state via ADB screenshot.

### What to do
1. Navigate to any recipe detail screen via ADB
2. ADB screenshot — capture current floating bar state
3. Identify the bug (overlapping UI, wrong position, not showing, etc.)
4. Find the floating bar component in `apps/mobile`
5. Fix the root cause — do NOT patch with margins or z-index hacks unless that IS the root cause
6. ADB screenshot confirming fix

## BUG 2 — Camera Capture

### Symptom (as reported from session 204/205)
Camera capture for recipe scanning has a bug on the mobile scan screen.
Check DONE.md for the exact symptom from sessions 204/205.
If DONE.md doesn't have it, navigate to the scan screen and test.

### What to do
1. Navigate to the Scan screen via ADB
2. ADB screenshot — capture current state
3. Attempt camera capture — identify the failure mode
4. Find the camera component (likely uses `expo-camera` or `expo-image-picker`)
5. Fix the root cause
6. ADB screenshot confirming camera opens and captures correctly

## GUARDRAILS
- Read `navigator.md` before navigating to any screen — use the documented ADB commands
- Every fix must be verified with an ADB screenshot, not just code inspection
- Do NOT use `npx tsc --noEmit` as the only verification — must test on emulator
- Do not touch web code in this session
- If either bug requires a native module reinstall (`expo prebuild`), note this explicitly
  and follow the prebuild checklist in CLAUDE.md (Jetifier, signing config, etc.)

## MOBILE TYPESCRIPT CHECK
```bash
cd apps/mobile && npx tsc --noEmit
```
Must be clean before considering session done.

## WRAPUP REQUIREMENT
DONE.md entry must include:
- ADB screenshot filenames proving both bugs are fixed
- Exact root cause of each bug (one sentence each)
- Whether prebuild was required
- tsc clean confirmed for mobile
- Both bugs verified on emulator (not just code-confirmed)
