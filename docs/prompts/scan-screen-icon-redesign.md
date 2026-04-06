# Scan Screen Icon & Card Redesign
# Save to: docs/prompts/scan-screen-icon-redesign.md

Read CLAUDE.md and apps/mobile/CLAUDE.md to orient yourself.
Read .claude/agents/navigator.md to understand screen structure.

Redesign the icons and cards on the Scan/Import tab to match 
the Trattoria theme. This is a visual polish pass only — 
do not change any functionality.

## Step 1 — Replace emoji icons with vector icons

In apps/mobile/app/(tabs)/scan.tsx:

Import vector icons at the top:
import { Ionicons } from '@expo/vector-icons'

Remove ALL emoji icons. Replace with Ionicons:
- Scan Photo:    name="camera"        
- Import URL:    name="link"          
- Choose Photo:  name="images"        
- Manual Entry:  name="create"        
- Speak button:  name="mic"           

Icon size: 32px on grid cards, 36px on Speak hero button.

## Step 2 — Icon container style

Each grid card icon sits inside a colored circle:

const IconCircle = ({ name, size = 32 }) => (
  <View style={{
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,  // #fdecea — light red
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  }}>
    <Ionicons 
      name={name} 
      size={size} 
      color={colors.accent}  // #ce2b37 — pomodoro red
    />
  </View>
)

Use this IconCircle component for all 4 grid cards.

For the Speak hero button — icon stays white (no circle needed,
button itself is red background).

## Step 3 — Card styling

Update each grid card style:
- Background: colors.bgScreen (#faf7f0) — warm cream, not white
- Border: 1.5px left border in colors.accent (#ce2b37)
- Border radius: 14px
- Shadow: shadowColor #000, shadowOpacity 0.07, 
  shadowRadius 8, elevation 3
- Padding: 20px vertical, 16px horizontal
- Align items center

Card label text:
- Font size: 15px
- Font weight: '600'
- Color: colors.textPrimary
- marginTop: 4px

Card subtitle text:
- Font size: 12px
- Color: colors.textMuted
- marginTop: 2px

## Step 4 — Chrome share banner styling

Update the "Share recipes directly from Chrome" banner:
- Background: colors.bgScreen (#faf7f0)
- Left border: 3px solid colors.accentGreen (#009246)
- Border radius: 12px
- Replace globe emoji with:
  <Ionicons name="globe-outline" size={20} color={colors.accentGreen} />
- Title: 14px semibold textPrimary
- Body text: 13px textSecondary
- Step numbers: small basil green circles with white numbers

## Step 5 — Speak hero button refinement
- Keep red background (already correct)
- Replace mic emoji with:
  <Ionicons name="mic" size={36} color="white" />
- Add subtle inner glow: 
  shadowColor: colors.accent,
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 6

## Step 6 — Verify
Navigate to Scan tab on emulator:
adb shell input tap [scan tab X coordinate from navigator.md]

Take screenshot:
adb exec-out screencap -p > /tmp/cb_screen.png

Describe what you see — confirm:
- No emoji icons anywhere
- All 4 grid cards have cream background with red left border
- Icons are inside red-tinted circles
- Speak button has mic icon, red background, subtle glow
- Chrome banner has green left border

Delete screenshot:
Remove-Item /tmp/cb_screen.png -Force

## Rules
- useTheme().colors always — never hardcode hex
- @expo/vector-icons is already installed — do not add new packages
- Do not change any functionality — visual only
- Fix any errors without stopping
- Do not embed screenshots in conversation
