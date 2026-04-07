# ChefsBook — Session: Android Safe Area + QA Notepad Polish
# Source: QA Report 2026-04-07 · Items 1, 19, 20
# Target: apps/mobile

---

## CONTEXT

Three UI issues where elements are either overlapping Android system navigation buttons or are placed in a way that creates accidental interactions. Read CLAUDE.md before starting.

---

## FIX 1 — QA Notepad: Move "Clear All" away from action buttons + add confirmation (Item 1)

**Current behaviour:** The "Clear All" button sits directly next to the "Upload" and "Close" buttons in the QA Notepad, making accidental clears likely.

**Fix:**

1. Move the "Clear All" button to the very bottom of the notepad's note list — below all notes, not in the header action bar.
2. Style it as a standalone destructive action: red text, no background, full-width or left-aligned, with adequate top margin to visually separate it from the list content.
3. Add a confirmation dialog before clearing:
   - Title: "Clear all notes?"
   - Body: "This will permanently delete all notepad entries."
   - Buttons: "Cancel" (dismiss) and "Clear All" (destructive, red).
   - Use the app's existing `ConfirmDialog` component — do NOT use the native `Alert` (broken in landscape mode per CLAUDE.md key decisions).
4. The Upload and Close buttons in the header remain unchanged.

**Verify:**
- Open QA Notepad → "Clear All" button is at the bottom of the list, not near Upload/Close.
- Tap "Clear All" → confirmation dialog appears.
- Tap "Cancel" → dialog dismisses, notes intact.
- Tap "Clear All" in dialog → all notes cleared.

---

## FIX 2 — "Add new shopping list" button hidden behind Android navigation bar (Item 19)

**Symptom:** The "Add new shopping list" button is positioned below the Android system navigation buttons and cannot be tapped.

**Root cause:** The `ScrollView` or `View` containing the shopping list screen is not accounting for the bottom safe area inset.

**Fix:**

1. In the shopping list screen (`apps/mobile`), locate the bottom action button or FAB for adding a new list.
2. Wrap the screen content in a `SafeAreaView` with `edges={['bottom']}`, or add `paddingBottom` using the `useSafeAreaInsets()` hook.
3. If the button is a floating action button (FAB), ensure its `bottom` position accounts for `insets.bottom` (typically 16–24px + inset value).
4. Apply consistently: the button must be tappable in both gesture-navigation mode (larger inset) and classic 3-button navigation mode.

**Pattern to use:**
```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();
// FAB style:
<TouchableOpacity style={{ bottom: 24 + insets.bottom }}>
```

**Verify:** Open shopping list screen → "Add new list" button is fully visible and tappable above the Android navigation bar on a device with gesture navigation.

---

## FIX 3 — QA Notepad: "Add item" button hidden behind Android navigation bar (Item 20)

**Symptom:** The "Add item" button inside the QA Notepad is positioned below the Android system navigation buttons.

**Fix:** Same safe-area pattern as Fix 2 above, applied to the Notepad component's input/action area.

1. Locate the "Add item" input row or button in the Notepad component.
2. Apply `paddingBottom: insets.bottom` or wrap in `SafeAreaView edges={['bottom']}`.
3. If the notepad is a modal or bottom sheet, ensure the sheet itself has `bottomInset` set correctly via the sheet library being used.

**Verify:** Open QA Notepad → "Add item" button/input is fully visible and tappable above the Android navigation bar.

---

## GLOBAL SAFE AREA AUDIT

While applying Fixes 2 and 3, do a quick scan of all other bottom-positioned UI elements in the app for the same issue:
- Shopping list item actions
- Recipe detail action bar
- Meal plan FAB
- Any bottom sheet footers

Flag (in a comment or TODO) any other elements that appear to have the same problem, but only fix the two items explicitly listed above in this session.

---

## COMPLETION CHECKLIST

Before wrapping:
- [ ] QA Notepad "Clear All" moved to bottom of list with confirmation dialog
- [ ] Shopping list "Add new list" button above Android nav bar
- [ ] Notepad "Add item" button above Android nav bar
- [ ] No regressions in notepad functionality (add, edit, export, close)
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
