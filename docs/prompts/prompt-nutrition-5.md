# Prompt: Nutrition-5 — Mobile Parity
# Model: OPUS
# Launch: Read docs/prompts/prompt-nutrition-5.md and execute fully through to deployment.

---

## MANDATORY PRE-FLIGHT — READ BEFORE WRITING ANY CODE

**Project foundation:**
- CLAUDE.md — pay close attention to mobile-specific setup (emulator, ADB, Expo SDK 54)
- docs/nutrition-design.md
- docs/agents/feature-registry.md
- docs/agents/testing.md — mobile testing section specifically (ADB screenshots required)
- docs/agents/ui-guardian.md — Trattoria design system for React Native

**Codebase audit — critical reading:**
- apps/mobile/app/ — find the recipe detail screen
- apps/mobile/components/ — scan for existing card/component patterns
- apps/web/components/NutritionCard.tsx — the web component to port (Nutrition-1)
- How the mobile recipe detail screen fetches recipe data (does it include nutrition?)
- apps/mobile/lib/ or similar — find the Supabase client setup for mobile

**Emulator setup:**
```bash
emulator -avd Medium_Phone_API_36.1 -no-snapshot -gpu host
```
Take an ADB screenshot of the recipe detail screen BEFORE making any changes.
This is your baseline.

---

## CONTEXT

Nutrition-1 built the web NutritionCard.
Nutrition-5 brings the same experience to the React Native mobile app.
The feature set is identical — same data, same toggle, same confidence handling.
The implementation is React Native, not web.

---

## SCOPE — THIS SESSION ONLY

**Build:**
- React Native NutritionCard component for mobile
- Mount in mobile recipe detail screen
- Ensure the recipe detail query includes nutrition data

**Do NOT build:**
- Mobile search filters (deferred — complex interaction, separate session)
- Mobile meal plan nutrition display (deferred)
- Bulk backfill (Nutrition-6)
- Any web changes

---

## MOBILE NutritionCard COMPONENT

Create `apps/mobile/components/NutritionCard.tsx`

This is a React Native component — no HTML, no Tailwind, use StyleSheet or
NativeWind (check which the mobile app uses — read existing components first).

**Feature parity with web version:**
- 7 nutrition values: Calories, Protein, Carbs, Fat, Fiber, Sugar, Sodium
- Per serving / Per 100g toggle (only when per_100g is not null)
- Toggle persisted via AsyncStorage key `'cb-nutrition-toggle'`
  (React Native equivalent of localStorage)
- Confidence < 0.5: amber warning text above values
- Owner: "Generate Nutrition" button when no nutrition data
- Non-owner: hide card when no nutrition data
- Regenerate button (owner only) in card footer
- Disclaimer: "Estimated by Sous Chef. Not a substitute for professional dietary advice."

**Mobile-specific design considerations:**
- Full-width card (mobile has no two-column layout)
- Values in a 2×4 grid (2 columns, 4 rows) with generous touch targets
- Toggle implemented as two pressable pills side by side
- Trattoria colours: cream `#faf7f0`, red `#ce2b37`
- Match the visual weight and spacing of existing mobile recipe detail sections

Opus: inspect at least 3 existing mobile components before designing the layout.
The mobile app has established patterns for cards and sections — follow them.

**Generate / Regenerate flow:**
- Calls the same API endpoint as web: POST /api/recipes/[id]/generate-nutrition
- Uses the mobile Supabase auth token in the Authorization header
- Shows ActivityIndicator during generation
- Updates state in place on success

---

## MOUNT IN RECIPE DETAIL SCREEN

Find the recipe detail screen in apps/mobile/app/.

- Add `nutrition` and `nutrition_generated_at` to the recipe data fetch query
- Mount `<NutritionCard />` after the steps list, before the notes section
  (matching web placement)
- Pass nutrition, isOwner, recipeId, servings as props

---

## GUARDRAILS

- Do not modify any web files
- Do not modify generateNutrition() or the API route
- If the mobile recipe detail uses a different data fetching pattern than the web,
  follow the mobile pattern — do not introduce web patterns into the app
- ADB screenshot is required at every major step — do not claim something works
  without visual proof

---

## VERIFICATION (ADB screenshots are mandatory — not optional)

Build check:
```bash
cd apps/mobile && npx tsc --noEmit
```

Emulator tests with ADB screenshots at each step:
1. Screenshot: recipe detail BEFORE any changes (baseline)
2. Navigate to a recipe WITH nutrition data → NutritionCard appears below steps
   → ADB screenshot
3. Tap "Per 100g" toggle → values change → ADB screenshot
4. Reload app → toggle state persisted from AsyncStorage → ADB screenshot
5. Navigate to a recipe WITHOUT nutrition data (as owner) → "Generate Nutrition"
   button visible → ADB screenshot
6. Tap Generate → ActivityIndicator → card populates → ADB screenshot
7. Navigate to a recipe WITHOUT nutrition data (as non-owner, if testable) →
   card hidden entirely
8. Low-confidence recipe → amber warning text visible → ADB screenshot

---

## DEPLOYMENT

Mobile does not deploy to RPi5. After TypeScript is clean and ADB tests pass:
- Confirm the Expo dev build works: `cd apps/mobile && npx expo start`
- If a production build is required per CLAUDE.md, follow that process

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION NUTRITION-5]`) must include:
- ADB screenshot filenames for each test step above
- Description of what the mobile NutritionCard looks like (layout, colours)
- Toggle working confirmed (with screenshot)
- Generate flow confirmed (with before/after screenshots)
- tsc clean: apps/mobile
- Expo build confirmed
- EXPLICITLY LIST as SKIPPED: Nutrition-6, mobile search filters, mobile meal plan nutrition
