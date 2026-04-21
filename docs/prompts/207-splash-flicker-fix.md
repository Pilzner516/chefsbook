# Prompt 207: Splash screen flicker — native splash flash before JS splash renders

## Scope
MOBILE APP ONLY. Single issue: the 3-second branded splash is inconsistent. Sometimes the logo-and-hat splash shows correctly for 3 seconds. Other times, users see a brief flash of a tiny native-splash hat icon on a white background before the app transitions straight to the My Recipes tab (skipping the JS splash entirely).

Do NOT modify apps/web. Do NOT touch camera, floating bar, or GuidedScanFlow.

## Context
Session 203's FIX 4 added a 3-second splash using `expo-splash-screen`. The native splash (configured in `app.json`) is supposed to hold until the JS-rendered splash has mounted and taken over. When it works, the transition is seamless. When it doesn't, there's a visible gap: native splash → white flash → tabs, with the JS splash never appearing.

Likely causes (in order of probability):
1. `SplashScreen.hideAsync()` is called too early in `_layout.tsx` — before the JS splash component has actually rendered a frame
2. The native splash asset in `app.json` doesn't match the JS splash design (tiny hat on white vs. centered logo on cream), making the handoff visually jarring
3. The minimum 3-second timer starts too late in the lifecycle, so on fast devices the JS splash hides before it's seen
4. React Native's initial render races with `hideAsync()` — classic Expo SDK 54 timing quirk

## SESSION START (mandatory)
Read CLAUDE.md, DONE.md (sessions 203 and 204 entries — FIX 4 details), AGENDA.md, .claude/agents/testing.md.

## Global constraints
- Do NOT run `expo prebuild --clean`.
- Do NOT commit apps/mobile/android/.
- Do NOT increase the 3-second minimum beyond 3 seconds. The goal is to make the 3 seconds reliable, not longer.
- Do NOT add a second splash layer on top to "mask" the flash. Fix the underlying timing.

## Phase 1 — Diagnostic (pause after)

### Step 1.1 — Inspect the current splash implementation
Read:
- `apps/mobile/app.json` — splash config (image path, background color, resizeMode)
- `apps/mobile/app/_layout.tsx` — `SplashScreen.preventAutoHideAsync()` + `hideAsync()` call sites
- Any JS splash component (likely `apps/mobile/components/SplashScreen.tsx` or similar, or inline in `_layout.tsx`)

Report:
- Exact timing of `preventAutoHideAsync` (should be module-scope, not inside an effect)
- Exact timing of `hideAsync` (what conditions must be met before it fires)
- Whether the JS splash is mounted BEFORE `hideAsync` fires
- What image `app.json` uses for the native splash + what image the JS splash uses — are they the same composition or different?

### Step 1.2 — Reproduce on device
Install current APK. Force-stop the app. Launch cold, repeat 10 times, note how many times the JS splash shows properly vs. flashes to white.

If reproduction rate matches user's report ("sometimes it shows, sometimes it flashes"), you have a timing race. If it's consistent one way, it's a design mismatch between native and JS splash.

### Step 1.3 — Report and PAUSE
Post:
- Code findings from 1.1
- Reproduction rate from 1.2
- Most likely cause (with confidence)
- Proposed fix in plain English

WAIT FOR USER APPROVAL before implementing.

## Phase 2 — Implementation (after approval)

Most likely correct fixes:

**If the issue is timing (hideAsync fires too early):**
- Move `hideAsync` to fire AFTER the JS splash's `onLayout` callback, guaranteeing it has painted
- OR use `SplashScreen.hideAsync()` only inside a `useEffect` that depends on the JS splash being mounted

**If the issue is asset mismatch (native splash looks different from JS splash):**
- Update `app.json`'s splash image to match the JS splash's centered-logo-on-cream composition
- Matching assets means the native → JS handoff is seamless even if there's a sub-frame gap

**If the issue is the 3-second timer:**
- Ensure the timer starts at `preventAutoHideAsync` call (earliest possible moment), not inside a later effect

Most likely fix is BOTH timing + asset match. The agent should apply both unless there's reason not to.

## Phase 3 — Verification (device required)

Cold-launch the APK 10 times in a row (force-stop + launch). Report:
- How many times the JS splash showed cleanly for ~3 seconds: __ / 10
- How many times there was a visible flash: __ / 10
- Target: 10 / 10 clean

Also test warm resume (background → foreground): splash must NOT re-show. Instant resume.

ADB screen recording of one cold launch (`adb shell screenrecord /sdcard/splash-test.mp4 --time-limit 6 --size 720x1280`) pulled back to the dev machine would be ideal. Screencaps at t=0.5s, t=1.5s, t=2.5s, t=3.5s acceptable if screenrecord isn't practical.

Do NOT declare "done" unless the 10-cold-launches test hits at least 9/10 clean. 

## Phase 4 — Rebuild + wrap

Rebuild release APK per prompt 200. Verify apksigner cert matches session 142 fingerprint.

Run /wrapup. DONE.md entry:
- Root cause
- Fix applied (timing / asset / both)
- 10-launch test result
- TYPE: CODE FIX

Commit message: `fix(mobile): session <N> - reliable 3-second splash (no native→JS flash)`

Push both repos.

## Failure modes to avoid
- Declaring "fixed" after one successful launch. Flakiness requires repeat-testing.
- Adding a longer splash to hide the flash. That's cosmetic papering.
- Touching anything other than splash code. This is a focused fix.
