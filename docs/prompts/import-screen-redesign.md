# Import Screen Redesign + Android Share Target
# Save to: docs/prompts/import-screen-redesign.md

Read CLAUDE.md and apps/mobile/CLAUDE.md to orient yourself.

Redesign the Scan/Import tab screen and register ChefsBook as an 
Android share target for URLs shared from Chrome and other browsers.

## Step 1 — Redesign apps/mobile/app/(tabs)/scan.tsx

Replace the current card-list layout with a bold, icon-driven grid.

### Layout structure:

HEADER:
- Title: "Add a Recipe" in 22px bold textPrimary
- Subtitle: "Choose how to add" in 13px textMuted

SPEAK BUTTON (full width, hero element):
- Full width, 80px height, accent red background (#ce2b37)
- Large 🎤 icon (32px) + "Speak a Recipe" in 18px bold white
- Subtitle below icon: "Dictate and AI formats it instantly" in 
  12px white opacity 0.85
- Rounded 16px corners
- Subtle pulse animation using Reanimated to draw attention
- On tap: navigate to /speak

2x2 ICON GRID below the Speak button:
Each cell: white card, 12px rounded corners, subtle shadow, 
equal width, ~130px height, centered content

Cell 1 — Scan Photo (top left):
- Icon: 📷 at 36px
- Label: "Scan Photo" 15px semibold textPrimary
- Subtitle: "Cookbook or recipe card" 12px textMuted
- On tap: open camera picker

Cell 2 — Import URL (top right):
- Icon: 🔗 at 36px  
- Label: "Import URL" 15px semibold textPrimary
- Subtitle: "Paste any recipe link" 12px textMuted
- On tap: expand inline URL input (see below)

Cell 3 — Choose Photo (bottom left):
- Icon: 🖼️ at 36px
- Label: "Choose Photo" 15px semibold textPrimary
- Subtitle: "From your gallery" 12px textMuted
- On tap: open image library picker

Cell 4 — Manual Entry (bottom right):
- Icon: ✏️ at 36px
- Label: "Manual Entry" 15px semibold textPrimary
- Subtitle: "Type it yourself" 12px textMuted
- On tap: navigate to /recipe/new

URL INPUT (collapsible, shown when Import URL is tapped):
- Slides down below the grid with Reanimated height animation
- Text input: "Paste recipe URL..." placeholder
- Paste button: reads clipboard automatically via Clipboard API
- Import button: accent red, triggers import pipeline
- Also show: "Or share from your browser →" hint text in textMuted
  with a small Chrome icon and instruction:
  "In Chrome, tap Share ⋮ → ChefsBook"

SHARE FROM BROWSER BANNER (bottom of screen):
- Subtle banner with light cream background, border
- 🌐 icon + "Share recipes directly from Chrome"
- "Open any recipe in your browser, tap Share, select ChefsBook"
- Small "How it works" link that shows a 3-step tooltip

### Import progress:
- When any import is in progress show a full-width progress bar 
  below the header
- Text: "Importing recipe..." with a spinner
- On complete: green checkmark + "Recipe saved! View it →" 
  that navigates to the new recipe

## Step 2 — Register as Android Share Target

In apps/mobile/app.json add intent filters so ChefsBook appears 
in the Android share sheet when sharing URLs from Chrome:

In the android section add:
"intentFilters": [
  {
    "action": "VIEW",
    "autoVerify": true,
    "data": [
      { "scheme": "https" },
      { "scheme": "http" }
    ],
    "category": ["BROWSABLE", "DEFAULT"]
  },
  {
    "action": "SEND",
    "data": [{ "mimeType": "text/plain" }],
    "category": ["DEFAULT"]
  }
]

In apps/mobile/app/_layout.tsx:
- Add a Linking handler that listens for incoming shared URLs
- When a URL arrives via share sheet:
  1. Navigate to the Scan tab
  2. Auto-populate the URL input with the shared URL
  3. Immediately trigger the import pipeline
  4. Show progress and navigate to the new recipe on completion

Use expo-linking to handle incoming URLs:
import * as Linking from 'expo-linking'

Add in _layout.tsx:
useEffect(() => {
  // Handle URL shared from browser
  const subscription = Linking.addEventListener('url', ({ url }) => {
    if (url && url.startsWith('http')) {
      // trigger import with this URL
      router.push({ pathname: '/(tabs)/scan', params: { importUrl: url } })
    }
  })
  return () => subscription.remove()
}, [])

In scan.tsx read the importUrl param and auto-trigger import:
const { importUrl } = useLocalSearchParams()
useEffect(() => {
  if (importUrl) {
    setUrlInput(importUrl as string)
    handleImport(importUrl as string)
  }
}, [importUrl])

## Step 3 — Clipboard paste helper
In scan.tsx URL input:
- On mount, check clipboard for a URL using expo-clipboard
- If clipboard contains a valid URL (starts with http): 
  show a "Paste from clipboard" suggestion chip above the input
- Tapping it auto-fills and triggers import
- This covers the copy-paste workflow without requiring the 
  share sheet

import * as Clipboard from 'expo-clipboard'
Check: expo-clipboard is already installed. If not: 
npx expo install expo-clipboard

## Step 4 — Animation on Speak button
Use react-native-reanimated for a subtle pulse on the Speak button:
- Scale pulse: 1.0 → 1.02 → 1.0 on a 2 second loop
- Only pulses when the screen is focused (use useFocusEffect)
- Stops pulsing after user taps it once per session

## Step 5 — Rebuild dev client
The intent filter change requires a new native build:
cd apps/mobile && npx expo run:android
This is required for the share target to register with Android.

## Step 6 — Verify
- adb screenshot to /tmp/cb_screen.png of the redesigned scan screen
- Describe layout in text: confirm Speak is hero element, 
  2x2 grid is visible, URL input is collapsed
- Delete /tmp/cb_screen.png
- Test clipboard paste: copy a recipe URL, open app, 
  confirm paste suggestion appears
- Confirm share sheet registration (open Chrome, share a URL, 
  ChefsBook should appear as an option after the rebuild)

## Rules
- useTheme().colors always — never hardcode hex
- Reanimated for all animations — no setTimeout hacks
- expo-linking and expo-clipboard from Expo SDK 54
- Fix all errors without stopping
- Do not embed screenshots in conversation
