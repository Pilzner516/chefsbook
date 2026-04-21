# Prompt 203: Post-demo mobile fixes (4 items)

## Scope
MOBILE APP ONLY. Do NOT modify apps/web. Shared packages (@chefsbook/db, @chefsbook/ai, @chefsbook/ui) may be extended if a fix needs a new shared helper, but only additively — no behavior changes to existing exports used by web.

Four independent fixes from the live demo. Complete each fix fully — including verification step — before starting the next one. Report findings + implementation + verification after each fix, then pause for acknowledgement before continuing to the next. This prevents the "declared done without testing" failure mode.

## SESSION START (mandatory)
Read CLAUDE.md, DONE.md, AGENDA.md, .claude/agents/testing.md, .claude/agents/deployment.md, .claude/agents/navigator.md. Follow the 9-step SESSION START sequence per CLAUDE.md.

If navigator.md is stale (last-changed date > 7 days), spot-check the routes you'll touch before relying on it.

## Global constraints (apply to all 4 fixes)
- All new UI strings MUST go through i18n with keys added to all 5 locales (en/fr/es/it/de). No hardcoded English.
- All dialogs MUST use ChefsDialog via useConfirmDialog / useAlertDialog. No native Alert.alert.
- All colors MUST come from useTheme().colors. No hardcoded hex.
- All modals/full-screen overlays MUST respect useSafeAreaInsets().
- Do NOT run `expo prebuild --clean` (wipes the signing config).
- Do NOT commit apps/mobile/android/ (gitignored).
- Root-cause every fix. No patching over bugs. If a fix seems to require a patch on top of a patch, stop and report.

---

## FIX 1 — Custom floating bar (My Recipes / Search / Scan / Plan / Cart) missing on recipe detail

### Symptom
The app uses a CUSTOM floating navigation bar — NOT the Expo Router Tabs component — for primary navigation between My Recipes, Search, Scan, Plan, and Cart. This custom bar appears on most screens but is missing on recipe detail (`apps/mobile/app/recipe/[id].tsx`). It should appear on recipe detail as well, matching the other primary screens.

### Context
Do NOT assume this is the Expo Router tab bar or that it lives in `app/(tabs)/_layout.tsx`. The project uses a custom-built floating navigation component whose location is unknown to the human requester. Your first job is to find it.

### Investigation (mandatory — report findings before writing any fix)
1. Grep `apps/mobile/app` and `apps/mobile/components` for button labels the bar contains: "My Recipes", "Search", "Scan", "Plan", "Cart" — including plausible i18n keys like `tabs.scan`, `nav.scan`, `common.scan`. Cross-reference matches in locale files (`apps/mobile/locales/en.json` etc.) to find the component that uses them.
2. Grep for component names likely matching a custom floating bar: FloatingBar, FloatingNav, BottomNav, CustomTabBar, NavBar, ActionBar, FloatingTabBar, plus CSS-level hints: `position: 'absolute'` combined with `bottom:` on a container rendering roughly 5 button children.
3. Check `apps/mobile/app/_layout.tsx` and any `(tabs)/_layout.tsx` for where this custom bar is mounted. It may be rendered as a sibling to Stack / Slot, or inside a wrapper that some routes use and recipe/[id] does not.
4. Compare a screen where it DOES render (e.g., a My Recipes tab screen) to `recipe/[id].tsx`. What wrapper / layout / Slot is one using that the other is not?
5. REPORT before writing any fix:
   - File path of the custom floating bar component
   - File where it is mounted, and how (globally in root layout, inside a specific layout group, manually per-screen, etc.)
   - Exact reason recipe detail does not get it
   - Proposed fix (likely one of: mount globally in root `_layout.tsx`, wrap recipe/[id] in the same layout that mounts it, or move recipe/[id] into the same route group)

Pause after the investigation report. Do not proceed to implementation until the diagnosis is confirmed by the human.

### Implementation (after diagnosis is approved)
Make the custom floating bar appear on recipe detail using the same mechanism that makes it appear on primary screens. Preferred approach: if the bar is conditionally mounted, mount it globally in the root layout so every screen inherits it by default, then opt specific screens OUT (settings modal, auth screens, landing) rather than opting screens IN. This prevents the same gap from recurring on future stack screens.

Required behavior on recipe detail:
- Floating bar is visible with the same positioning (z-index, bottom inset, opacity/blur if any) as on other screens
- Floating bar does NOT overlap the existing recipe action row (Like / Save / Share). If it would, add bottom padding equal to the bar's height to the recipe content's scroll container so the last row is reachable above the bar.
- Tapping Scan / Search / Plan / etc. from recipe detail navigates to the target screen
- If the bar has an active-tab highlight, confirm behavior is sensible from recipe detail (probably no active highlight since recipe detail is not a top-level destination)

### Verification
- ADB screencap of recipe detail with the floating bar visible at the bottom
- ADB screencap of a known-good screen (e.g., My Recipes) for visual comparison — floating bar should look identical
- Tap each floating bar button from recipe detail and confirm navigation works
- Scroll to the bottom of a long recipe — confirm Like / Save / Share are reachable, not hidden under the bar
- Regression check: settings modal, sign-in, sign-up, landing screens do NOT show the floating bar if they previously did not
- Deep link from `chefsbk.app/recipe/[id]` lands on recipe detail with the floating bar visible

### Likely regressions to watch for
- If the bar is moved to the root layout, screens that should NOT have it (sign-in, sign-up, landing, settings modal, onboarding) will start showing it. The fix should include an explicit allow-list OR deny-list so these screens stay correct.

---

## FIX 2 — Camera capture never completes the import

### Symptom
From the Scan tab, tapping "Scan a photo" then Camera launches the camera. User takes the photo. The photo is captured but the app does not proceed to the import flow. Selecting an existing photo from the gallery works fine.

### Investigation
1. Find the camera launch code in `apps/mobile/app/(tabs)/scan.tsx`. Expected API: `ImagePicker.launchCameraAsync()`.
2. Compare the camera result handler to the gallery result handler (`launchImageLibraryAsync`). The gallery handler works — diff the two paths.
3. Check for:
   - Wrong result shape access (`result.uri` vs `result.assets[0].uri` — ImagePicker SDK changed this)
   - `canceled` vs `cancelled` property name (breaking change between SDK versions)
   - Missing await on a Promise that resolves after the camera modal dismisses
   - Permissions race (camera permission granted but photo saved to a path the app cannot read)
   - State update happening on an unmounted component (camera modal unmounts and remounts the scan screen)
4. REPORT root cause with file path + line number + the exact diff between camera and gallery result handling before writing a fix.

### Implementation
Fix so camera capture proceeds into the same import flow as gallery selection, calling the same identification + confirmation screens. If the SDK returns a different result shape for camera vs gallery, normalize at the boundary, not further downstream.

### Verification
- ADB or physical device test: tap Scan, then Camera, then take photo. Confirm the identification/confirmation screen (from FIX 3, or the current flow if FIX 3 is not done yet) appears.
- Test gallery path still works (regression check).
- If emulator camera does not work reliably, note this and validate on physical device in post-session step.

---

## FIX 3 — New conversational scan-to-recipe flow

### Current behavior
Scan tab to photo to Claude Vision classifies to recipe created with AI-identified data. Limited user control.

### New required flow
After photo capture (camera OR gallery) and AI dish identification via Haiku Vision, present a guided multi-step flow:

**Step A — Dish confirmation + user inputs (ALWAYS shown)**
- Display the AI-identified dish name
- Editable text field pre-filled with the AI title. User can override with their own title.
- Optional multi-line text field labeled "Comments / notes about this dish" (examples: "this is my grandmother's version", "I don't like cilantro", "this was at Restaurant X")
- "Continue" button

**Step B — AI follow-up questions (0 to 3 questions MAXIMUM)**
- Based on the Vision output + user comments, AI asks up to 3 targeted clarifying questions. Keep it minimal — no 10-question wizard. Typical useful questions: cuisine confirmation (only if ambiguous), approximate servings, dietary notes, rough cook/prep time.
- Questions rendered on a single screen with the question(s) + input field(s). NOT a chat-bubble sequence.
- Skip this step entirely if the AI has high confidence and no useful questions to ask. Do not ask filler questions to hit a minimum.

**Step C — "Anything else?" (ALWAYS shown)**
- Yes/No ChefsDialog: "Do you have anything else you'd like to add?"
- If No, proceed to generation.
- If Yes, open a final text window (multi-line input, labeled "Final thoughts") then Submit then proceed to generation.

**Step D — Recipe generation (not user-facing, just what happens)**
- Combine all signals: Vision scan output, user-provided title, user comments from Step A, user answers from Step B, final thoughts from Step C
- Enhance with: (a) a public-recipe lookup in ChefsBook (`listPublicRecipes` / search RPC) for similar dishes as reference; (b) optional web context via existing Claude search tool if already in the AI package
- Single Claude Sonnet call to produce the final structured recipe (ingredients, steps, description, tags). Do NOT make 3 separate AI calls. One structured call.
- Log via `logAiCall` with a new action name (e.g., `scan_guided_generation`, model: sonnet). Add to CLAUDE.md AI cost table.

### Implementation notes
- Put the multi-step UI in a new component, e.g., `apps/mobile/components/GuidedScanFlow.tsx`, orchestrated from scan.tsx
- Each step is a full-screen modal with progress indicator (e.g., "Step 2 of 4")
- Back button on every step except Step A (going back from A cancels entirely)
- Loading state between Step B and Step C while AI generates follow-up questions (if any)
- Loading state between Step C/D and the recipe-detail page while generation runs
- Plan-gate at the entry point (checkRecipeLimit). Do not let users walk through all steps and hit a gate at save time.
- Existing Haiku Vision call (`analyseScannedImage` or `scanRecipe` in @chefsbook/ai) stays. The guided flow wraps around it.

### New i18n keys (add to all 5 locales)
Under a new `guidedScan` namespace:
- `title` — "New Recipe from Photo"
- `step1.heading` — "Is this right?"
- `step1.titleLabel` — "Recipe title"
- `step1.commentsLabel` — "Comments (optional)"
- `step1.commentsPlaceholder` — e.g., "Grandma's recipe, restaurant version, etc."
- `step2.heading` — "A few quick questions"
- `step3.heading` — "Anything else?"
- `step3.prompt` — "Do you have anything else you'd like to add?"
- `step3.finalLabel` — "Final thoughts"
- `generating` — "Creating your recipe..."
- Back / Continue / Submit / Yes / No buttons reuse existing common.* keys if present

### Verification
- Full walk-through on a running emulator OR physical device: camera, Step A (edit title, add comment), Step B (answer a question), Step C, Yes, final thoughts, generation, recipe detail page opens with expected content
- Second walk-through: Step C then No, skips final thoughts, generation
- Third walk-through: AI has high confidence so Step B is skipped, straight from A to C
- Verify logAiCall row in `ai_usage_log` with action=`scan_guided_generation` and non-zero input_tokens
- Verify plan gate fires on free tier before Step A

### Out of scope (flag for future sessions)
- Web parity for this flow
- Voice input in any step
- Real-time streaming of AI responses

---

## FIX 4 — Splash/landing screen held for 3 seconds on launch

### Symptom
App opens directly into the main UI. No branded splash moment. Users do not see the ChefsBook logo + chef hat before the app is ready.

### Implementation
1. Check if `expo-splash-screen` is already installed. If yes, work with it. If no, install it.
2. Configure the splash asset in `apps/mobile/app.json`:
   - Background: Trattoria cream `#faf7f0`
   - Image: composition of ChefsBook wordmark + chef's hat. Use `apps/mobile/assets/images/chefs-hat.png` and the existing wordmark asset. If a combined splash image does not exist, create one at a sensible resolution (e.g., 1242x2436 for iPhone sizing, scale-fit for Android).
3. In `apps/mobile/app/_layout.tsx`:
   - Call `SplashScreen.preventAutoHideAsync()` at module scope
   - In the root layout effect, await fonts/i18n/auth init, then `await new Promise(r => setTimeout(r, 3000 - elapsed))` to ensure minimum 3s hold
   - Call `SplashScreen.hideAsync()` after the minimum elapsed
4. Include a "Welcome to ChefsBook" tagline on the splash (static text on the image OR a React overlay rendered during the 3s if the splash can be extended to a component — Expo SDK 54 supports custom splash components).

### Verification
- ADB launch of the APK: observe the splash for 3 seconds before the landing/sign-in screen appears
- Cold launch (force-stop the app, then launch): splash shows
- Warm resume (background, then foreground): splash does NOT re-show (resume should be instant)
- No flash of white/black screen between splash and first real screen

### Do NOT
- Add the splash as just a 3-second blocking loop in JS without using `expo-splash-screen`. That causes a visible white flash before the JS mount.
- Extend the 3 seconds to mask slow app startup. If startup is slow, that is a separate issue. The 3s is the MINIMUM hold, not a cover-up.

---

## Session wrap (after all 4 fixes complete)

Run /wrapup. For each fix, record in DONE.md:
- Root cause (one sentence)
- Files changed
- Verification evidence (screencap path or physical-device note)
- TYPE tag: CODE FIX for fixes 1, 2, 4. TYPE: FEATURE for fix 3.

Rebuild the release APK at the end (same as prompt 200 procedure) so Bob can sideload the fixed build:
```
cd apps/mobile/android
./gradlew assembleRelease --no-daemon
```
Verify apksigner cert identity still matches session 142 fingerprint. Report APK path + size.

Update AGENDA.md:
- Remove any entries the 4 fixes closed
- Add any follow-ups uncovered during investigation

Commit + push both chefsbook and bob-hq repos.

## Failure mode to avoid
If any fix turns out to be significantly larger than estimated (e.g., FIX 3 requires a new DB column, or FIX 1 reveals the custom floating bar does not exist at all and needs to be built from scratch), STOP on that fix, report the scope change, and wait for direction. Do not quietly expand the prompt.
