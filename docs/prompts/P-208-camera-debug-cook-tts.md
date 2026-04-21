# P-208 — Mobile: Camera Scan Debug + Cook Mode Text-to-Speech

## WAVE 1 — Runs in parallel with P-205 and P-209
## No file conflicts with P-205 or P-209 — safe to run simultaneously

---

## SESSION START

```bash
git pull origin main
```

Read agents in this order:
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md` (full)
3. `DONE.md` — note session 204 carry-forward: camera still broken
4. `.claude/agents/testing.md` (MANDATORY)
5. `.claude/agents/feature-registry.md` (MANDATORY)
6. `.claude/agents/ui-guardian.md` (MANDATORY)
7. `.claude/agents/navigator.md` (MANDATORY)
8. `.claude/agents/import-pipeline.md` (MANDATORY — camera scan is an import path)
9. `.claude/agents/ai-cost.md` (MANDATORY — scan uses Claude Vision)

Run ALL pre-flight checklists before proceeding.

---

## Context
QA report 4/20/2026 Items 7 and 8. Item 7 is also the session 204 camera carry-forward. Two independent features, no file conflicts between them.

---

## PART A — Camera Scan Silent Skip Investigation and Fix

### Problem
Two symptoms:
1. After taking a photo, app drops back to My Recipes tab without entering scan flow (session 204 carry-forward)
2. On multi-page scans, some captured pages silently disappear from the page list

### Step 1 — Reproduce and capture logcat BEFORE writing any code
```bash
adb logcat | grep -E "\[scan\]|scan|camera|image|picker|ERROR|WARN|Unhandled"
```
Reproduce the drop-to-My-Recipes bug. Paste the full relevant log output into your session analysis. Do not write a single fix line until you have the log.

### Step 2 — Read session 203's changes carefully
Read `apps/mobile/app/(tabs)/scan.tsx` and `apps/mobile/lib/image.ts`. Session 203 added try/catch blocks in `startScan`, `addScanPage`, and `launchCameraAsync`. Identify:
- Is the catch block swallowing the error silently (only `console.warn`)?
- Is there a navigation call inside the try that gets caught and suppressed?
- What happens when the function returns `null` — user cancelled vs actual error?

### Step 3 — Understand multi-page skip
Read `addScanPage` logic specifically. What happens when image manipulator errors, file URI is invalid, or array push fails silently?

### Step 4 — Write a diagnosis
Document your findings in session notes before touching any fix code:
- Exact line(s) causing the drop-to-tabs bug
- Exact condition causing multi-page skip
- Root cause (not just "the catch swallows it" — what SPECIFICALLY is throwing?)

### Fix Requirements (after diagnosis is confirmed)

1. **Drop-to-tabs bug**: Surface the real error to the user via `Alert.alert` or ChefsDialog. Navigation back to My Recipes must ONLY happen on explicit user action — not on any error condition.

2. **Multi-page skip**: Every camera capture must either:
   - Successfully add a page thumbnail to the scan list, OR
   - Show a visible error: "Couldn't add that page — please try again."
   The user must never silently lose a captured page.

3. **Cancel handling**: User explicitly cancels camera (null return, no asset) = NOT an error. Handle gracefully with no alert and no navigation change.

4. **Error pattern**: Use `Alert.alert('[Scan Error]', actualErrorMessage)` or ChefsDialog. Do NOT use silent `console.warn` as the only error response.

5. **Do NOT remove try/catch blocks** — refine them to surface errors properly instead.

6. If the root cause requires a different approach (different API, different URI handling), implement the proper fix — do not patch over a fundamental issue.

### Verification
- ADB logcat showing no unhandled rejections during scan
- Camera tap → confirm guided scan flow opens (GuidedScanFlow from session 203)
- Multi-page test: take 3 pages, confirm all 3 thumbnails appear
- ADB screenshot: guided scan flow open after camera capture

---

## PART B — Cook Mode Text-to-Speech

### Problem
Cook Mode has no audio — users must read the screen while cooking with occupied hands.

### Step 1 — Check if expo-speech is already installed
```bash
cat apps/mobile/package.json | grep speech
```
If not present:
```bash
cd apps/mobile && npx expo install expo-speech
```
Use `npx expo install` — NOT `npm install` — to get the SDK-54-compatible version.

### Feature Requirements

1. Locate the Cook Mode screen via `navigator.md`. Read the full screen before touching it.

2. Add a **TTS toggle button** in the Cook Mode header or controls bar:
   - Speaker icon
   - ON state: filled, pomodoro red `#ce2b37`
   - OFF state: outline, grey
   - State persists for the duration of the cook session only (no cross-session persistence needed)

3. **When TTS is ON and user advances/navigates to a step:**
   - Call `Speech.stop()` to cancel any in-progress speech
   - Call `Speech.speak(stepText)` with the current step's instruction text
   - Do NOT auto-speak on toggle-on — only speak on step navigation

4. **"Read this step" one-shot button:**
   - Small speaker icon button on the current step card
   - Tapping it reads the current step immediately regardless of toggle state
   - Does not change the toggle state

5. **Speaking behaviour:**
   - Stop before speaking: always call `Speech.stop()` first
   - Language: use device locale if available, fallback to `'en'`
   - If recipe is translated, speak the currently displayed language text
   - Speak step instructions only — NOT ingredient lists

6. **No AI calls** — pure device TTS via `expo-speech`. Zero Claude API usage for this feature.

7. Update `navigator.md` with TTS toggle on cook mode screen.

### Verification
- ADB screenshot: Cook Mode with TTS toggle button visible in header/controls
- ADB screenshot: "Read this step" button on a step card
- Logcat showing `expo-speech` output when speak is triggered
- `expo-speech` present in `apps/mobile/package.json` if it was newly added

---

## Build
After both parts verified:
```bash
cd apps/mobile
del android\app\build\generated\assets\createBundleReleaseJsAndAssets\index.android.bundle 2>nul
./gradlew assembleRelease --no-daemon
apksigner verify --print-certs apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```
Record APK size and signing SHA-256.

---

## Session Close
```
/wrapup
```
Wrapup requires: logcat diagnosis output for Part A, all ADB screenshots above, APK size + signing SHA.

---

## Guardrails
- git pull before starting
- Part A: logcat diagnosis BEFORE any fix code — no exceptions
- Part B: `expo-speech` only — zero AI/Claude API calls for TTS
- Do NOT touch recipe edit screens (P-205)
- Do NOT touch QA Notepad (P-205/P-206)
- Do NOT touch image upload/generation (P-207)
- Do NOT touch web files
- One commit per part
