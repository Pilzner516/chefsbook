# Prompt: Mobile Image Generation — Theme Selection Error Fix

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/mobile-image-gen-fix.md fully and autonomously, from pre-flight through verification and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUGFIX — MOBILE ONLY

## Overview

When a user taps "generate new image" on a recipe detail screen and selects any theme,
the mobile app shows a generic error: **"Error: Something went wrong"**

The real error is being swallowed by a catch block. This session must:
1. Surface the real underlying error
2. Identify and fix the root cause
3. Verify all themes work end-to-end

---

## Agent files to read — ALL of these, in order, before touching any code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/image-system.md`
- `.claude/agents/ai-cost.md`
- `.claude/agents/navigator.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Search for the error string `"Something went wrong"` across `apps/mobile/` — find every
   catch block that surfaces this message and log the file + line number
2. Trace the full call stack from the theme selector UI component → store/hook →
   `@chefsbook/ai` function → external API call
3. Check `apps/mobile/.env.local` — confirm ALL required keys are present:
   - `EXPO_PUBLIC_SUPABASE_URL` (should be `https://api.chefsbk.app` post login-fix)
   - Any Pexels API key
   - Any image generation service key
4. Check whether the image generation function constructs URLs using `EXPO_PUBLIC_SUPABASE_URL`
   or `EXPO_PUBLIC_WEB_URL` — the recent `RALPH-MOBILE-LOGIN-FIX` session changed the
   Supabase URL; image endpoints may be pointing at the wrong host
5. Check `feature-registry.md` for the image generation feature status before writing
   a single line of code

---

## Diagnosis methodology

Do NOT guess and patch. Follow this order:

### Step 1 — Surface the real error
In every catch block identified in pre-flight step 1, temporarily add:
```typescript
console.error('[IMAGE-GEN-DEBUG] Real error:', error);
```
Build and run on device/emulator. Trigger the error. Read the ADB log:
```bash
adb logcat | grep IMAGE-GEN-DEBUG
```
The real error message is the root cause. Fix that. Remove the debug log after.

### Step 2 — Hypothesis checklist
Work through this list in order. Stop at the first confirmed cause.

| # | Hypothesis | How to verify |
|---|-----------|---------------|
| 1 | Missing or expired API key (Pexels, image service) | Check `.env.local`; test the key with a raw curl |
| 2 | Wrong base URL after env migration | Log the constructed URL before the fetch call |
| 3 | Theme parameter type mismatch (string vs enum vs object) | Log the params sent to the AI function |
| 4 | Network request blocked (cleartext, wrong IP) | Check `network_security_config.xml`; check ADB logcat for network errors |
| 5 | AI function throws before the API call (bad input shape) | Add a try/catch one level up, before the external call |
| 6 | Response parsing failure (unexpected shape from API) | Log the raw API response before parsing |

### Step 3 — Fix only the confirmed root cause
Do not refactor unrelated code. Make the smallest change that fixes the bug.

---

## Known gotchas — check these before assuming a new bug

From `CLAUDE.md` decisions log:

- **Mobile Supabase URL**: After `RALPH-MOBILE-LOGIN-FIX`, `apps/mobile/.env.local` must
  use `https://api.chefsbk.app` — NOT the old RPi5 Tailscale IP. Any image endpoint that
  derives its URL from the Supabase URL may be broken if it was constructed before this fix.
- **Web URL hack**: `speak.tsx:180` has a port-replacement hack (`.replace(':8000', ':3000')`)
  that is now dead code but produces the correct hostname by coincidence. If the image
  generation code has a similar pattern, it may be silently broken.
- **All AI calls are server-side on web** — but mobile calls `@chefsbook/ai` directly (no
  CORS restriction in React Native). If the image generation function was recently moved
  server-side for web, check it still exports a mobile-compatible path in `@chefsbook/ai`.
- **Metro blockList**: root `node_modules` react/react-native are excluded. If `@chefsbook/ai`
  recently added a dependency that pulls in a duplicate, bundle may be silently wrong.

---

## Verification

### ADB navigation to reproduce
```bash
# Navigate to a recipe detail screen
# (get a recipe ID first from logcat or use a known one)
adb shell am start -n com.chefsbook.app/.MainActivity
# Then navigate to recipe detail → image generation → select theme
```

### Confirm fix works for ALL themes
Test every available theme option — if there are N themes, test all N. A fix that
only works for one theme is not a fix.

### TypeScript
```bash
cd apps/mobile && npx tsc --noEmit
```
Must pass with 0 errors.

### Regression check
Verify that the following still work after the fix:
- Recipe detail screen loads normally
- Existing recipe images still display
- Image upload (user photo) still works if separate from generation

---

## What NOT to do

- Do NOT change `.env.local` values without confirming the new value is correct first
- Do NOT refactor the image system beyond fixing the confirmed root cause
- Do NOT add new AI model calls — if the fix requires a new `callClaude()` call,
  read `ai-cost.md` first and get the cheapest model appropriate for the task
- Do NOT rebuild the APK unless the fix requires native module changes —
  JS-only fixes hot-reload on the dev client

---

## Wrapup

Follow `wrapup.md` fully.

In the DONE.md entry, include:
- The real error message that was being swallowed
- The root cause (one sentence)
- The file(s) changed
- Which themes were tested and confirmed working
- Whether an APK rebuild was required
