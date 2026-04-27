# Prompt: Search Screen — Scope Selector Dropdown (Replace 2×2 Pills)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/search-scope-dropdown.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: UI POLISH

## Context

The search screen currently shows 4 scope pills in a 2×2 grid:
- All Recipes / My Recipes
- Following / What's New

These take up significant vertical space. The request is to collapse them into a single
compact dropdown row that expands/collapses on tap — matching the same animation
pattern already used for the filter section collapse built in the previous session.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/navigator.md`

Run ALL pre-flight checklists from every agent above before writing any code.

---

## Pre-flight

Read the current implementation in `apps/mobile/app/(tabs)/search.tsx` before
writing any code. Understand:
- How the 4 scope tabs currently manage state
- What query/fetch each scope triggers
- How the filter collapse animation was implemented in the previous session
  (reuse the same pattern — do not invent a new one)

---

## Required behaviour

### Collapsed state (default)
A single full-width row showing:
```
[ All Recipes  ▾ ]
```
- Left: selected scope label (e.g. "All Recipes")
- Right: chevron-down icon
- Same pill/rounded styling as the existing active pill (pomodoro red `#ce2b37`
  background, white text, fontWeight 600)
- Takes the same height as a single pill row

### Expanded state (on tap)
The row expands downward to reveal all 4 options stacked or in the same 2×2 grid
as today — use `LayoutAnimation.configureNext` matching the filter collapse animation:
```
[ All Recipes  ▾ ]   ← currently selected, shown at top
  My Recipes
  Following
  What's New
```
- Or keep the 2×2 grid layout for the expanded options — whichever is cleaner
- Non-selected options: inactive pill style (cream background, border, dark text)
- Tapping an option: selects it, collapses back to single row showing the new selection
- Tapping the selected row again: toggles collapse/expand

### Default
- Default selection: **All Recipes**
- On mount, always start collapsed

---

## Implementation notes

- Do NOT change the underlying scope logic, queries, or fetch behaviour — only the
  UI presentation of the selector changes
- Reuse the exact same `LayoutAnimation.configureNext` call from the filter collapse
  — keep the animation consistent
- The chevron icon should rotate 180° when expanded (use `Animated.Value` for rotation
  or a simple conditional if rotation animation is complex)
- i18n: all 4 scope labels already have translation keys — reuse them, do not add new keys

---

## Testing

- ADB screenshot: collapsed state showing "All Recipes ▾"
- ADB screenshot: expanded state showing all 4 options
- ADB screenshot: after selecting "My Recipes" — collapsed showing "My Recipes ▾"
- Confirm scope switching still loads correct recipes for each option
- Confirm filter collapse (from previous session) still works correctly — no regression

```bash
adb exec-out screencap -p > /tmp/scope_collapsed.png
adb exec-out screencap -p > /tmp/scope_expanded.png
adb exec-out screencap -p > /tmp/scope_myrecipes.png
```

---

## Deploy

Mobile only — rebuild and reinstall APK:
```bash
rm -f android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle

export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
cd apps/mobile
EXPO_PUBLIC_APP_VARIANT=staging npx expo run:android --variant release
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## Wrapup

Follow `wrapup.md` fully.
ADB screenshots required for all 3 states (collapsed / expanded / selection made).
"Code looks correct" is not valid proof.
