# Prompt: Mobile — Floating Bar Fix (Dedicated Session)
# Model: OPUS
# Launch: Read docs/prompts/prompt-mobile-floating-bar.md and execute fully.
# TYPE: CODE FIX

---

## CONTEXT

The floating action bar on the recipe detail screen has an architectural issue
flagged in Mobile-1. The agent noted it requires "Expo Router restructuring"
rather than a quick patch. This session resolves it properly.

---

## MANDATORY PRE-FLIGHT

Read ALL of these before writing a single line of code:
- CLAUDE.md — full project context, mobile stack, emulator setup
- apps/mobile/CLAUDE.md — mobile-specific instructions
- docs/agents/testing.md — ADB screenshots are MANDATORY
- docs/agents/ui-guardian.md — Trattoria design system

**Launch emulator first:**
```bash
emulator -avd Medium_Phone_API_36.1 -no-snapshot -gpu host
```

**ADB screenshot of current state immediately** — capture the floating bar
bug as it exists today before touching anything. This is your baseline.

**Read these files before writing anything:**
- apps/mobile/app/recipe/[id].tsx — the recipe detail screen
- apps/mobile/components/ — find the floating bar component
- apps/mobile/app/_layout.tsx — understand the root layout
- apps/mobile/app/(tabs)/_layout.tsx — understand the tab layout

Understand the full component tree before diagnosing.

---

## DIAGNOSIS

The Mobile-1 agent described this as an "architectural issue requiring Expo
Router restructuring." Before writing any fix, document exactly what the
problem is:

1. ADB screenshot showing the bug
2. One-sentence description of the visual issue
   (overlapping content? wrong position? hidden behind tab bar? not visible?)
3. Root cause in the component tree
   (z-index conflict? absolute positioning breaking with Expo Router?
   SafeAreaView not accounting for floating element? Tab bar overlap?)

Write the diagnosis in a comment at the top of your code changes.

---

## COMMON FLOATING BAR ISSUES IN EXPO ROUTER

**Issue A — Bar hidden behind tab bar:**
The tab bar sits at the bottom. An absolutely-positioned floating bar at
`bottom: 0` renders behind the tab bar. Fix: use `bottom: tabBarHeight + 16`
where tabBarHeight is obtained from `useBottomTabBarHeight()` hook.

```typescript
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
const tabBarHeight = useBottomTabBarHeight();
// Apply: style={{ bottom: tabBarHeight + 16 }}
```

**Issue B — Bar overlapping content (no padding at scroll bottom):**
ScrollView content gets cut off behind the floating bar. Fix: add
`contentContainerStyle={{ paddingBottom: floatingBarHeight + 16 }}`
to the ScrollView.

**Issue C — Bar not respecting safe area on iPhone:**
On devices with home indicator, `bottom: 0` clips into the unsafe area.
Fix: use `useSafeAreaInsets()` and add `insets.bottom` to the bottom offset.

```typescript
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const insets = useSafeAreaInsets();
// Apply: style={{ bottom: insets.bottom + 16 }}
```

**Issue D — Expo Router layout conflict:**
The floating bar is defined inside a screen but the tab layout clips it.
Fix: move the floating bar to be rendered outside the ScrollView but inside
the screen's root View, with `position: 'absolute'`.

Opus: identify which of these (or which combination) applies before fixing.

---

## THE FIX

Once root cause is confirmed:

1. Fix the positioning so the bar is always visible above the tab bar
2. Fix the ScrollView padding so content is not hidden behind the bar
3. Ensure the bar respects safe area insets (important for iPhone compatibility)
4. The bar must not overlap the tab bar — it sits above it
5. The bar must not overlap recipe content when scrolled

**The bar should contain (check what's currently in it):**
Find the existing floating bar component and preserve ALL its current actions.
This is a positioning fix only — do not change what buttons the bar contains.

---

## GUARDRAILS

- Do not change web files
- Do not change any other mobile screen — only recipe detail
- Do not remove or change any floating bar actions/buttons
- The fix must work on both Android emulator AND iOS simulator (safe area aware)
- ADB screenshot required at every step — do not claim it works without visual proof
- If the fix requires changes to `_layout.tsx`, be extremely careful —
  layout changes affect every screen. Describe what you're changing and why
  before touching it.

---

## VERIFICATION

TypeScript:
```bash
cd apps/mobile && npx tsc --noEmit
```

ADB tests with screenshots:
1. Screenshot: floating bar BEFORE fix (baseline)
2. Navigate to recipe detail → floating bar visible ABOVE tab bar → ADB screenshot
3. Scroll to bottom of recipe → content not hidden behind bar → ADB screenshot
4. Scroll back up → bar still in correct position → ADB screenshot
5. Navigate away and back → bar still correct → ADB screenshot

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION MOBILE-FLOATING-BAR]`) must include:
- Diagnosis: exact root cause (one sentence)
- Which of Issues A/B/C/D (or other) applied
- Files changed (list them)
- ADB screenshot filenames: before + after
- Confirmed content not hidden behind bar (screenshot)
- tsc clean confirmed
