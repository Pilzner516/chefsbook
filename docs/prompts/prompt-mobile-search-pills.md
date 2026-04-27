# Prompt: Mobile — Search Tab Pills 2×2 Grid Layout
# Model: Sonnet
# Launch: Read docs/prompts/prompt-mobile-search-pills.md and execute fully.
# TYPE: CODE FIX

---

## CONTEXT

The Search screen has 4 tab pills at the top:
  All Recipes | My Recipes | Following | What's New

These are currently in a horizontal scrolling row that goes off screen.
This looks unfinished and requires the user to scroll right to find options.

The fix: arrange the 4 pills in a **2×2 centered grid** so everything is
visible at once with no horizontal scrolling.

---

## PRE-FLIGHT

Read these files — nothing else needed:
- apps/mobile/app/(tabs)/search.tsx — find the tab pill implementation
- docs/agents/ui-guardian.md — Trattoria colours

Launch emulator:
```bash
emulator -avd Medium_Phone_API_36.1 -no-snapshot -gpu host
```
ADB screenshot of current state as baseline.

---

## THE FIX

### Target layout
```
┌──────────────────┬──────────────────┐
│   All Recipes    │   My Recipes     │
├──────────────────┼──────────────────┤
│   Following      │   What's New     │
└──────────────────┴──────────────────┘
```

### Implementation

Replace the horizontal `ScrollView` or `FlatList` containing the pills
with a wrapped 2-column grid using `flexWrap`:

```typescript
// Container
<View style={{
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: 8,
  paddingHorizontal: 16,
  marginBottom: 12,
}}>
  {tabs.map(tab => (
    <TabPill key={tab.key} tab={tab} />
  ))}
</View>
```

Each pill:
```typescript
// Each pill takes exactly 50% width minus gap
<Pressable style={{
  width: '48%',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 10,
  borderRadius: 20,
  backgroundColor: isActive ? colors.primary : colors.surface,
  borderWidth: 1,
  borderColor: isActive ? colors.primary : colors.border,
}}>
  <Text style={{
    color: isActive ? '#FFFFFF' : colors.textPrimary,
    fontWeight: isActive ? '600' : '400',
    fontSize: 14,
  }}>
    {tab.label}
  </Text>
</Pressable>
```

### Active state
- Active pill: pomodoro red background `#ce2b37`, white text, bold
- Inactive pill: cream/surface background, primary text, border
- Matches current active styling — only change is the layout

### Rules
- useTheme().colors always — never hardcode except `#ce2b37` for active
  which is a brand constant
- No horizontal scrolling — all 4 pills visible without any scroll
- Pills are equal width (48% each, 2 per row)
- Centered in the screen
- Minimum touch target 44px height

---

## GUARDRAILS

- Do not change tab logic, navigation, or what each tab shows
- Do not change the filter chips below (Cuisine, Course etc.) —
  only the 4 top tab pills
- Do not touch web files
- If the current implementation uses a specific tab component,
  adapt it — don't rewrite the entire tab system

---

## VERIFICATION

TypeScript:
```bash
cd apps/mobile && npx tsc --noEmit
```

ADB screenshots:
1. Before: horizontal scroll pills going off screen (baseline)
2. After: 2×2 grid, all 4 pills visible → ADB screenshot
3. Tap "My Recipes" → active state correct (red background) → ADB screenshot
4. Tap "Following" → switches correctly → ADB screenshot
5. No pill goes off screen at any point

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION MOBILE-SEARCH-PILLS]`) must include:
- ADB screenshot filenames: before + after
- Confirmed all 4 tabs visible without horizontal scroll
- Active state confirmed working on all 4 tabs
- tsc clean confirmed
