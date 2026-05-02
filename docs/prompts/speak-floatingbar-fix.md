# Prompt: Mobile — Hide FloatingTabBar on Wizard Screens (Speak + Audit)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/speak-floatingbar-fix.md fully and autonomously, from pre-flight through wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: CODE FIX — MOBILE ONLY

## Overview

The FloatingTabBar overlays the Continue button on the Speak a Recipe screen (`/speak`),
making it impossible to advance through the flow. The fix is to hide the FloatingTabBar
on wizard/flow screens that own their own navigation controls (back button + Continue).

This prompt also mandates an audit of every other root Stack screen to catch the same
issue before it is reported again.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/navigator.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Open `apps/mobile/app/_layout.tsx` and locate the FloatingTabBar conditional render.
   Identify the exact function or variable that controls which routes hide the bar
   (currently hides on: `/`, `/auth/*`, `/modal`, `/messages*`).
2. Open `apps/mobile/app/speak.tsx` and confirm it is a multi-step wizard screen
   with a Continue button pinned to the bottom.
3. Read `navigator.md` in full. List every root Stack screen that is NOT inside the
   `(tabs)` group. These are all candidates for the audit in FIX 2.
4. Confirm `npx tsc --noEmit` baseline passes in `apps/mobile` before making any changes.
   Note any pre-existing errors — do not introduce new ones.

---

## Context

After session MOBILE-FLOATING-BAR, the FloatingTabBar was moved from
`(tabs)/_layout.tsx` to the root `_layout.tsx`. It is conditionally hidden based on
the current pathname. The exclusion list only covers unauthenticated and modal routes.

Wizard screens — screens that run the user through a linear flow with their own back
button and step navigation — do not need or want the tab bar. The tab bar sitting on
top of the bottom button is a blocking UX bug on those screens.

The correct fix for wizard screens is to **hide the tab bar entirely**, not to add
`paddingBottom` to scroll content. `paddingBottom` is the right fix for content
screens where the tab bar should be visible but content was being obscured beneath it.

---

## FIX 1 — Hide FloatingTabBar on `/speak`

**File:** `apps/mobile/app/_layout.tsx`

Add `/speak` to the route exclusion list that hides the FloatingTabBar.

The speak screen is a multi-step wizard (record audio → review transcript → add
details → image → Continue). It has its own back button via Expo Router's stack header
and a Continue button pinned to the bottom. No tab bar is needed.

Do not add `paddingBottom` to `speak.tsx`. Hiding the bar is the correct fix.

---

## FIX 2 — Audit all root Stack screens

Check every root Stack screen listed in `navigator.md`. For each screen, answer:

> Does this screen have a button, input, or interactive element pinned to the bottom
> that the FloatingTabBar could cover?

**Decision per screen:**

| Screen type | Correct fix |
|---|---|
| Wizard / linear flow with own back + Continue | Add to exclusion list (hide bar) |
| Content screen where bar SHOULD show but content is obscured | Ensure `paddingBottom` is correct |
| Screen where bar is already handled correctly | No change — document as verified |

**Screens to assess (at minimum):**

- `/speak` — KNOWN BUG (FIX 1 above)
- `/recipe/new` — has floating Save bar; already has `paddingBottom` — verify the bar itself is not still visually overlapping
- `/plans` — review bottom button layout
- `/share/[token]` — review bottom button layout
- `/recipe/[id]` — content screen; already has `paddingBottom`; verify no regression
- `/chef/[id]` — verify
- `/cookbook/[id]` — verify

Document your findings for every screen assessed, even if no change was made.

---

## Constraints

- **Do NOT** move FloatingTabBar out of `_layout.tsx` — the current architecture is correct.
  Extend the exclusion list only.
- **Do NOT** use hardcoded bottom margins or padding anywhere. Always use
  `useSafeAreaInsets()` from `react-native-safe-area-context`. This is a non-negotiable
  UI rule from CLAUDE.md.
- **Do NOT** add `paddingBottom` workarounds to wizard screens. If the tab bar should
  not appear, hide it — do not push content up around it.
- Follow the existing exclusion list pattern exactly — do not refactor the logic, just
  add entries.

---

## Acceptance criteria

- [ ] FloatingTabBar does NOT render on `/speak`
- [ ] Continue button on the speak screen is fully visible and tappable at all steps
- [ ] FloatingTabBar is still visible on all 5 main tabs (My Recipes, Search, Scan, Plan, Cart)
- [ ] All root Stack screens from the audit have been assessed and documented
- [ ] Any other screens with the same blocking issue have been fixed
- [ ] `npx tsc --noEmit` clean in `apps/mobile` (no new errors beyond pre-existing baseline)
- [ ] ADB screenshot captured of speak screen confirming fix

---

## Testing

### ADB verification

```bash
# Wake emulator
adb shell input keyevent KEYCODE_WAKEUP

# Navigate to speak screen via Scan tab
adb shell input tap [scan-tab-x] [scan-tab-y]
# Then tap "Speak a Recipe" — coordinates from navigator.md

# Capture screenshot
adb exec-out screencap -p > docs/adb_screenshots/speak_floatingbar_fix.png

# Confirm tab bar on My Recipes tab
adb shell input tap [recipes-tab-x] [recipes-tab-y]
adb exec-out screencap -p > docs/adb_screenshots/speak_floatingbar_tabs_ok.png
```

Use exact tap coordinates from `navigator.md`. Update `navigator.md` if any coordinates
have changed.

### Manual checklist

- Step through the speak flow at least to Step 2. Confirm Continue button is tappable
  at each step.
- Navigate back to My Recipes tab. Confirm FloatingTabBar is present.
- Navigate to Search, Scan, Plan, Cart tabs. Confirm FloatingTabBar is present on all.
- If any other screens were fixed in FIX 2, verify those screens the same way.

---

## navigator.md update — REQUIRED

Add a changelog entry dated today with:

- Which screens were added to the FloatingTabBar exclusion list
- Which screens were audited and found to be unaffected
- Any screens where `paddingBottom` was corrected instead

---

## Wrapup

Follow `.claude/agents/wrapup.md` fully before ending the session.

DONE.md entry must include:
- `TYPE: CODE FIX`
- Root cause one-liner
- Every file changed
- Full audit findings table (screen → status → action taken)
- ADB screenshot filenames as verification evidence
