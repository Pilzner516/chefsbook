# Floating Tab Bar — Option C
# Save to: docs/prompts/floating-tab-bar.md

Read CLAUDE.md and apps/mobile/CLAUDE.md to orient yourself.
Read .claude/agents/navigator.md for screen locations.

Replace the standard tab bar with a floating pill-shaped tab bar.
Visual only — no functionality changes.

## Step 1 — Remove default tab bar styling
In apps/mobile/app/(tabs)/_layout.tsx:

Set tabBarStyle to hidden on the default navigator:
tabBar: () => <FloatingTabBar />
This replaces the system tab bar entirely with our custom component.

## Step 2 — Create FloatingTabBar component
Create apps/mobile/components/FloatingTabBar.tsx

Import:
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePathname, router } from 'expo-router'
import { useTheme } from '../context/ThemeContext'

### Tab definitions — icons must match the section topic:

const TABS = [
  {
    name: 'index',
    route: '/(tabs)/',
    label: 'Recipes',
    icon: 'book-outline',          // open book — recipe collection
    iconActive: 'book',
  },
  {
    name: 'search',
    route: '/(tabs)/search',
    label: 'Search',
    icon: 'search-outline',        // magnifying glass — finding recipes
    iconActive: 'search',
  },
  {
    name: 'scan',
    route: '/(tabs)/scan',
    label: 'Scan',
    icon: 'camera-outline',        // camera — scanning/importing
    iconActive: 'camera',
    elevated: true,                // this tab floats above the pill
  },
  {
    name: 'plan',
    route: '/(tabs)/plan',
    label: 'Plan',
    icon: 'calendar-outline',      // calendar — meal planning
    iconActive: 'calendar',
  },
  {
    name: 'shop',
    route: '/(tabs)/shop',
    label: 'Cart',
    icon: 'cart-outline',          // shopping cart — grocery list
    iconActive: 'cart',
  },
]

### Layout:

const insets = useSafeAreaInsets()
const pathname = usePathname()

Pill container:
- Position: absolute, bottom: insets.bottom + 16 (always above gesture bar)
- Left: 40, Right: 40 (centered with margins)
- Height: 64px
- Background: white
- Border radius: 32px (full pill)
- Border: 1px solid colors.borderDefault
- Shadow: elevation 12, shadowColor #000, shadowOpacity 0.12,
  shadowRadius 16
- Flex direction: row, align items: center, justify content: space-around
- Padding horizontal: 8px

Each regular tab (non-elevated):
- Flex: 1
- Height: 64px
- Align items: center, justify content: center
- Gap: 3px between icon and label

Active tab indicator:
- When tab is active: show a pill background behind icon+label
- Background: colors.accentSoft (#fdecea)
- Border radius: 20px
- Padding: 6px 12px
- Icon color: colors.accent (#ce2b37)
- Label color: colors.accent (#ce2b37)
- Label font size: 11px, font weight 600

Inactive tab:
- Icon color: colors.textMuted (#9a8a7a)
- Label color: colors.textMuted (#9a8a7a)
- Label font size: 11px, font weight 400

### Elevated Scan tab (center):
The Scan tab floats ABOVE the pill bar:
- Position: absolute, top: -24px (rises above pill)
- Width: 56px, height: 56px
- Border radius: 28px (circle)
- Background: colors.accent (#ce2b37)
- Border: 3px solid white (creates separation from pill)
- Shadow: elevation 8, shadowColor colors.accent, shadowOpacity 0.4,
  shadowRadius 12
- Icon: camera, size 26px, color white
- Label: "Scan" below the pill in 10px, colors.textMuted,
  centered under the circle

When Scan is active:
- Background: darker red (#a81f2a)
- Scale: 1.05 via Animated.spring

### Animation:
Use Animated.spring for tab switches:
- Active pill background fades in with spring
- Elevated scan button scales on press

### Safe area:
The pill sits at: bottom = insets.bottom + 16
This ensures it never overlaps the Android gesture bar or
iOS home indicator on any device.

### Content padding:
In each tab screen, add paddingBottom to the scroll view:
paddingBottom: 64 + insets.bottom + 32
This ensures content is never hidden behind the floating bar.

Add a helper hook apps/mobile/lib/useTabBarHeight.ts:
export function useTabBarHeight() {
  const insets = useSafeAreaInsets()
  return 64 + insets.bottom + 32
}
Import and use this in all tab screens for their bottom padding.

## Step 3 — Update all tab screens for bottom padding
In each of these files, find the main ScrollView or FlashList
and add: contentContainerStyle={{ paddingBottom: tabBarHeight }}
using the useTabBarHeight() hook:
- apps/mobile/app/(tabs)/index.tsx
- apps/mobile/app/(tabs)/search.tsx
- apps/mobile/app/(tabs)/plan.tsx
- apps/mobile/app/(tabs)/shop.tsx
- apps/mobile/app/(tabs)/scan.tsx

## Step 4 — Update header logo spacing
In apps/mobile/components/ChefsBookHeader.tsx
(or wherever the header is implemented in _layout.tsx):

Add proper safe area top padding:
const insets = useSafeAreaInsets()
paddingTop: insets.top + 8

Logo text:
- Font size: 28px (slightly larger)
- Font family: Platform.select({ ios: 'Georgia', android: 'serif' })
- ONE word: "ChefsBook" — rendered as two Text spans side by side
  with NO space between them:
  <Text style={{ color: colors.textPrimary }}>Chefs</Text>
  <Text style={{ color: colors.accent }}>Book</Text>
- Both spans: same font size, same font family, same font weight bold
- Do NOT add a space between "Chefs" and "Book"
- Do NOT change to two separate words
- This matches the existing logo style exactly

This ensures the logo never bumps into the status bar icons.

## Step 5 — Verify
Navigate through all 5 tabs on emulator.

Take screenshot: adb exec-out screencap -p > /tmp/cb_screen.png
Describe:
- Floating pill is visible above the gesture area
- Scan button is elevated above the pill as a red circle
- Active tab shows red pill highlight
- Logo has proper spacing from status bar
- Content not hidden behind tab bar
Delete: Remove-Item /tmp/cb_screen.png -Force

Test each tab:
- Tap each tab, confirm navigation works
- Confirm Scan elevated button taps correctly
- Confirm content scrolls to bottom without being hidden

## Rules
- useSafeAreaInsets() for ALL position calculations — never hardcode
- useTheme().colors always — never hardcode hex
- Ionicons only — no emoji in tab bar
- Fix all errors without stopping
- Do not embed screenshots in conversation
- Commit when complete:
  git add -A && git commit -m "feat: floating pill tab bar with elevated scan button"
