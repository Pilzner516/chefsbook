# Prompt: Mobile-1 — Verify Nutrition-5 + Fix Open Mobile Bugs
# Model: OPUS
# Launch: Read docs/prompts/prompt-mobile-1.md and execute fully.

---

## MANDATORY PRE-FLIGHT

Read ALL of these before touching anything:
- CLAUDE.md — full project context, mobile stack, emulator setup
- apps/mobile/CLAUDE.md — mobile-specific agent instructions
- docs/agents/testing.md — ADB screenshot requirements are MANDATORY
- docs/agents/ui-guardian.md — Trattoria design system for React Native

**Launch emulator first:**
```bash
emulator -avd Medium_Phone_API_36.1 -no-snapshot -gpu host
```

Confirm emulator is running and app connects before proceeding.
Take an ADB screenshot immediately — this is your baseline.

---

## SCOPE — THREE TASKS

1. Verify Nutrition-5 NutritionCard works on emulator (code was written, never tested)
2. Fix floating bar on recipe detail screen
3. Fix camera capture on scan screen

---

## TASK 1 — Nutrition-5 Verification

NutritionCard.tsx was built in Nutrition-5 but the emulator was not available
at that time. Verify it now.

Read:
- apps/mobile/components/NutritionCard.tsx — understand what was built
- apps/mobile/app/recipe/[id].tsx — confirm NutritionCard is mounted

**Test steps with ADB screenshots at each:**
1. Navigate to a recipe that HAS nutrition data → NutritionCard visible below steps
2. Tap "Per 100g" toggle → values update → ADB screenshot
3. Restart app → toggle state restored from AsyncStorage → ADB screenshot
4. Navigate to a recipe WITHOUT nutrition (as owner) → "Generate Nutrition" button → ADB screenshot
5. Tap Generate → spinner → card populates → ADB screenshot
6. Low-confidence recipe (recipe with few/vague ingredients) → amber warning text → ADB screenshot

**If bugs found during verification:** fix them in this session before moving on.
Common issues to check:
- AsyncStorage import correct for Expo SDK 54
- API call includes auth token (Bearer header)
- Nutrition JSONB fields match what the component expects
- Per 100g toggle hidden correctly when per_100g is null

---

## TASK 2 — Floating Bar Bug on Recipe Detail

**Symptom:** The floating action bar on the recipe detail screen has a visual bug.
Check DONE.md sessions 204/205 for the exact symptom if recorded.
If not documented, navigate to any recipe detail and inspect visually.

Common floating bar bugs:
- Overlaps content instead of sitting above it (needs bottom padding on scroll view)
- Wrong z-index / not visible
- Appears behind the keyboard when it shouldn't

**Fix approach:**
1. ADB screenshot of current state
2. Identify the specific issue
3. Fix root cause — no z-index hacks unless z-index IS the root cause
4. ADB screenshot confirming fix

---

## TASK 3 — Camera Capture Bug on Scan Screen

**Symptom:** Camera capture on the scan screen has a bug.
Navigate to the Scan tab, attempt to use the camera.

Check:
- Does the camera open?
- Does the capture button work?
- Does the captured image get processed?
- Any permission dialogs that aren't being handled?

**Fix approach:**
1. ADB screenshot of scan screen current state
2. Identify exact failure mode
3. Check expo-camera version compatibility with Expo SDK 54
4. Fix root cause
5. ADB screenshot confirming camera opens and captures

---

## GUARDRAILS

- ADB screenshots are mandatory — every task requires visual proof
- Do not touch web files
- Do not modify generateNutrition() or the API route
- If a task reveals a deeper architectural issue that can't be fixed quickly,
  document it clearly in DONE.md and move on — don't get blocked

---

## TYPESCRIPT CHECK
```bash
cd apps/mobile && npx tsc --noEmit
```
Zero errors required before wrapup.

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION MOBILE-1]`) must include:
- Nutrition-5 verified: list each test step and ADB screenshot filename
- Any bugs found and fixed in NutritionCard
- Floating bar: exact root cause (one sentence) + ADB screenshot filename
- Camera: exact root cause (one sentence) + ADB screenshot filename
- tsc clean confirmed
- EXPLICITLY LIST as SKIPPED: Mobile-2 (social), Mobile-3 (profiles/badge),
  Mobile-4 (meal plan nutrition), Mobile-5 (nutrition search filters)
