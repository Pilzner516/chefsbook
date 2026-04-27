# Prompt: Nutrition Facts — Emergency Fix (Values Disappeared)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/nutrition-emergency-fix.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: CODE FIX

## Context

The previous session (NUTRITION-FIX) edited NutritionCard on web and mobile to remove
the verbose AI notes paragraph. After that change, ALL nutrition values have disappeared
from the recipe detail page on mobile. Web may be affected too — verify both.

This is a regression introduced by the previous session. The fix must restore the full
nutrition display while keeping ONLY the disclaimer cleanup that was intentional.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md` — mandatory, understand wrapup requirements before starting
- `.claude/agents/testing.md` — mandatory every session
- `.claude/agents/feature-registry.md` — mandatory; check NutritionCard feature entry before touching anything
- `.claude/agents/ui-guardian.md` — this session touches a component on both web and mobile
- `.claude/agents/data-flow.md` — nutrition data is fetched and may pass through Zustand; understand the data shape before editing
- `.claude/agents/deployment.md` — mandatory; web changes must be deployed to RPi5
- `.claude/agents/navigator.md` — required for emulator navigation and ADB screenshot commands

Run ALL pre-flight checklists from every agent above before writing any code.

---

## Step 1 — Triage: find what broke

Run `git diff HEAD~1` (or `git show HEAD`) to see exactly what the previous session changed
in NutritionCard on both web and mobile.

Look for:
- Accidental deletion of JSX blocks beyond just the notes/disclaimer section
- Early returns or null guards that now short-circuit before rendering
- A removed import or variable that other parts of the component depended on
- The `nutrition.notes` removal accidentally cutting into surrounding JSX structure
  (mismatched braces, unclosed conditionals, etc.)

Do NOT guess. Read the actual diff first.

---

## Step 2 — Fix

Restore ONLY what was accidentally removed. The one intentional change to keep:
- The verbose AI reasoning paragraph is gone ✓
- Only "Estimated by Sous Chef. Not a substitute for professional dietary advice." remains ✓

Everything else (calorie/protein/fat/carbs/fiber/sugar/sodium grid, toggle, heading)
must be fully restored and rendering correctly.

---

## Step 3 — Verify on web

Open a recipe with nutrition data on the web app.
Confirm with your own eyes:
- Nutrition grid is visible (all 7 values)
- Per Serving / Per 100g toggle is present and functional
- Single-line disclaimer only
- No console errors

---

## Step 4 — Verify on mobile

Get the emulator running:
- `emulator -avd CB_API_34 -no-snapshot -gpu host`
- If System UI crashes: `emulator -avd CB_API_34 -no-snapshot -wipe-data -gpu host`
- Wait for full boot before testing

Navigate to a recipe with nutrition data.
Take ADB screenshot proving the nutrition grid is visible:
```bash
adb exec-out screencap -p > /tmp/nutrition_restored.png
```

---

## Step 5 — Deploy

Follow `deployment.md`. Deploy web to RPi5 via `/mnt/chefsbook/deploy-staging.sh`.
Rebuild mobile APK only if mobile code changed.

---

## Wrapup

Follow `wrapup.md` fully.
Every checklist item requires a screenshot or curl/psql result as proof.
"Code looks correct" is NOT acceptable proof for any item.
