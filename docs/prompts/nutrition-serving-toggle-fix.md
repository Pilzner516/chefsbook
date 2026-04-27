# Prompt: Nutrition Facts — Fix Default Serving View + Restore Toggle + Trim Disclaimer

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/nutrition-serving-toggle-fix.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## FULL SPEC

---

Read the following agent files before writing any code:
- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/deployment.md`

Then execute this spec fully, test, deploy, and run /wrapup.

---

## TYPE: CODE FIX

## Summary

Three related issues in the Nutrition Facts component on both web and mobile:

1. **Wrong default view** — values display per-100g instead of per-serving by default
2. **Missing toggle** — the "Per Serving / Per 100g" toggle is absent; user cannot switch views
3. **Verbose disclaimer** — the long AI reasoning paragraph below the nutrition grid must be removed; only one line is needed

---

## Pre-flight

1. Locate the Nutrition Facts component on web:
   - Search `apps/web` for the nutrition component (likely `NutritionFacts`, `NutritionCard`, or similar)
   - Check the recipe detail page to confirm which component renders it

2. Locate the Nutrition Facts component on mobile:
   - Search `apps/mobile` for the equivalent component

3. Identify where nutrition data is stored — confirm whether the DB/API returns both `per_serving` and `per_100g` fields, or just one set with a multiplier

4. Run `\d recipes` (or the relevant table) on RPi5 to confirm nutrition column names

---

## Fix 1 — Default to Per Serving

The component must default to showing **per-serving** values, not per-100g.

- If state controls the view, initialize it to `'serving'` (not `'100g'`)
- If the component receives nutrition data and applies a multiplier, ensure the multiplier for the default state is 1 (serving) not the 100g conversion

---

## Fix 2 — Restore Per Serving / Per 100g Toggle

The toggle must be present and functional on both web and mobile.

**Toggle behaviour:**
- Two options: `Per Serving` | `Per 100g`
- Default selected: `Per Serving`
- Switching recalculates all displayed values accordingly
- Toggle must be visually consistent with the existing ChefsBook design system (Trattoria theme: cream `#faf7f0`, pomodoro red `#ce2b37`, basil green `#009246`)

**If the toggle was accidentally removed:** restore it. Do not rebuild from scratch if the original code exists — find the git history or any existing toggle logic and reinstate it.

**If the toggle never existed in the current implementation:** build it cleanly:
- Web: a small pill/tab toggle above or below the nutrition grid
- Mobile: same pill/tab toggle using NativeWind

---

## Fix 3 — Trim Disclaimer Text

Remove the long AI reasoning paragraph that appears below the nutrition grid (the one explaining assumptions about ingredient weights, cooking losses, sodium calculations, etc.).

**Keep only this single line:**
> Estimated by Sous Chef. Not a substitute for professional dietary advice.

Delete all other text in that section. No ellipsis, no "read more", just the one line.

---

## Testing

### Web
- Open any recipe that has AI-generated nutrition facts
- Confirm values display per-serving by default
- Confirm the Per Serving / Per 100g toggle is visible
- Click toggle → values change correctly
- Confirm only the single disclaimer line appears below the grid
- No console errors

### Mobile (emulator CB_API_34)
- Navigate to a recipe with nutrition facts
- Confirm per-serving default
- Confirm toggle is present and functional
- Confirm single disclaimer line only
- Take ADB screenshot as proof

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5 via `/mnt/chefsbook/deploy-staging.sh`.

---

## Wrapup

Follow `wrapup.md` fully. Every checklist item requires proof (psql, curl, or ADB screenshot). No items may be marked DONE by reading code alone.
