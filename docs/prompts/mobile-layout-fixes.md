# Prompt: Mobile Layout Fixes — Overflow, Search Filter Collapse, Keyboard Avoidance

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/mobile-layout-fixes.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: CODE FIX

## Context

Three layout bugs reported on a Samsung S24 (physical device). All three are mobile-only.
Web is unaffected.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/navigator.md`

Run ALL pre-flight checklists from every agent above before writing any code.

---

## Bug 1 — Toggle overflow on recipe detail screen (Samsung S24)

**Symptom:** On the recipe detail screen, two toggles are clipped off the right edge of the screen:
- The metric / imperial unit toggle (top of recipe detail)
- The Per Serving / Per 100g nutrition toggle (NutritionCard)

The S24 has a 6.7" display at 1440×3088px (logical ~412dp wide). Content is being
rendered wider than the available viewport.

**Root cause to look for:**
- Fixed pixel widths on toggle containers instead of `flex-1` or percentage-based widths
- `minWidth` values that exceed the screen on narrower logical widths
- Horizontal padding on parent containers not accounting for safe area insets
- Missing `flexShrink: 1` on flex children that should compress

**Fix requirements:**
- Both toggles must be fully visible on screen widths from 360dp (small Android) up to 430dp (large phones)
- Use `flex: 1` / `flexShrink: 1` on containers rather than fixed widths
- Ensure safe area insets are respected (use `useSafeAreaInsets` if not already applied)
- Do NOT change the visual design of the toggles — only fix the sizing/layout

**Scope audit:**
After fixing the recipe detail toggles, audit ALL screens in `apps/mobile/app/` for similar
overflow patterns — any horizontal row with fixed widths, especially:
- Any toggle or pill group in a row
- Any header row with multiple elements
- Any card with side-by-side content

Document every file that needed a fix in the wrapup checklist.

---

## Bug 2 — Search screen: filters collapse when active

**Symptom:** On the search screen, when one or more filters are selected (cuisine, course,
nutrition, etc.), the filter pills at the top of the screen take up so much vertical space
that there is almost no room left to see the recipe results below.

**Required behaviour:**
- When NO filters are active: filter section displays normally (current behaviour)
- When ONE OR MORE filters are active: the full filter row/panel COLLAPSES to a single
  compact summary bar
- The summary bar shows:
  - A filter icon
  - A count of active filters, e.g. "3 filters active"
  - A chevron/arrow to expand
  - A "Clear all" button (X)
- Tapping the summary bar (or chevron) expands the filter panel back to full height
  so the user can adjust filters
- Tapping the X clears all filters and returns to expanded state
- The collapsed state gives maximum vertical space to the recipe results list

**Implementation notes:**
- The expand/collapse state should be local component state (not persisted)
- Auto-collapse when a filter is applied, auto-expand when all filters are cleared
- The transition should be smooth — use `LayoutAnimation.configureNext` or an
  `Animated.Value` for height
- The existing filter bottom sheet / pill UI must still work when expanded — do not
  rebuild the filter logic, only wrap it in a collapsible container

---

## Bug 3 — Keyboard overlapping text input fields

**Symptom:** When the on-screen keyboard opens (e.g. typing in the search field, or
any text input in the app), the keyboard covers the active input field. The user
cannot see what they are typing.

**Required behaviour:**
- When the keyboard opens, the screen content scrolls up or the input is pushed up
  so the active field remains visible above the keyboard
- This must work on all screens where text input exists

**Fix approach:**
- Audit ALL screens in `apps/mobile/app/` and components in `apps/mobile/components/`
  for text inputs (`TextInput`, search bars, form fields, comment inputs, etc.)
- For each screen with text input, ensure it is wrapped in `KeyboardAvoidingView` with:
  ```tsx
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    style={{ flex: 1 }}
  >
  ```
- If the input is inside a `ScrollView`, use `KeyboardAwareScrollView` from
  `react-native-keyboard-aware-scroll-view` IF already installed, otherwise use
  `ScrollView` with `keyboardShouldPersistTaps="handled"` and
  `automaticallyAdjustKeyboardInsets={true}` (RN 0.81 supports this natively)
- Do NOT add `KeyboardAvoidingView` to screens that have no text input — unnecessary
  wrapping causes layout issues on screens that don't need it
- Priority screens (fix these first):
  - Search screen (search text field)
  - Recipe detail (comment input if present)
  - Any modal or bottom sheet with a text input
  - Recipe create/edit forms
  - Login / signup screens

---

## Testing

### Required for each bug

**Bug 1 — Overflow:**
- ADB screenshot of recipe detail showing BOTH toggles fully visible
- ADB screenshot of any other screen that was fixed

**Bug 2 — Search filter collapse:**
- ADB screenshot: search screen with NO filters (expanded state, normal)
- ADB screenshot: search screen WITH filters active (collapsed to summary bar)
- ADB screenshot: tapping summary bar expands filters again

**Bug 3 — Keyboard:**
- ADB screenshot: search screen with keyboard open, search field visible above keyboard
- ADB screenshot: at least one other fixed screen showing field above keyboard

All screenshots saved to `docs/adb_screenshots/` with descriptive names.

### Emulator setup
```bash
# Launch
emulator -avd Medium_Phone_API_36.1 -no-snapshot -gpu host

# If System UI crashes — cold boot
emulator -avd Medium_Phone_API_36.1 -no-snapshot -wipe-data -gpu host

# Screenshot
adb exec-out screencap -p > /tmp/screenshot_name.png
```

### Confirm no regressions
Run the full Regression Smoke Test from `testing.md` before wrapup.

---

## Deploy

No web deployment needed — mobile only.
Rebuild and reinstall staging APK:
```bash
# Delete stale bundle first
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
Every checklist item requires an ADB screenshot as proof.
List every file changed with a one-line description of what was fixed.
"Code looks correct" is not valid proof for any item.
