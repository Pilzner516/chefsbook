# App Icon Setup + Landing Page + Splash Screen
# Save to: docs/prompts/app-icon-setup.md

Read CLAUDE.md, apps/mobile/CLAUDE.md and
.claude/agents/navigator.md to orient yourself.

A new app icon image has been placed in the docs/ folder.
Find the exact filename first:
ls docs/*.png docs/*.jpg docs/*.jpeg 2>/dev/null

===================================================================
## STEP 1 — Crop and resize icon image
===================================================================

Using Python Pillow:
pip install Pillow --break-system-packages

Write and run scripts/process_icon.py:

from PIL import Image
import os

src = 'docs/[FIND ACTUAL FILENAME AND REPLACE THIS]'
img = Image.open(src).convert('RGBA')

# Square crop — center crop removing cream sides
w, h = img.size
size = min(w, h)
left = (w - size) // 2
top = (h - size) // 2
img_square = img.crop((left, top, left + size, top + size))

assets = 'apps/mobile/assets'
os.makedirs(assets, exist_ok=True)

# icon.png — 1024x1024
img_square.resize((1024, 1024), Image.LANCZOS).save(f'{assets}/icon.png')

# adaptive-icon.png — 1024x1024
img_square.resize((1024, 1024), Image.LANCZOS).save(f'{assets}/adaptive-icon.png')

# favicon.png — 32x32
img_square.resize((32, 32), Image.LANCZOS).save(f'{assets}/favicon.png')

print('Icon assets generated successfully')

Run the script from monorepo root:
python scripts/process_icon.py

===================================================================
## STEP 2 — Generate splash screen
===================================================================

Add to scripts/process_icon.py and run again:

from PIL import Image
import os

# Splash — 1284x2778 portrait, cream background
splash_w, splash_h = 1284, 2778
splash = Image.new('RGBA', (splash_w, splash_h), '#faf7f0')

# Place icon centered, 360px wide, slightly above center
icon = Image.open('apps/mobile/assets/icon.png').convert('RGBA')
icon_size = 360
icon_resized = icon.resize((icon_size, icon_size), Image.LANCZOS)
icon_x = (splash_w - icon_size) // 2
icon_y = (splash_h // 2) - icon_size
splash.paste(icon_resized, (icon_x, icon_y), icon_resized)

splash.save('apps/mobile/assets/splash.png')
print('Splash screen generated')

===================================================================
## STEP 3 — Landing page (apps/mobile/app/index.tsx)
===================================================================

Replace the existing landing screen with this exact layout.
All items centered horizontally, centered vertically on screen.

Import at top:
import { Image } from 'react-native'

Layout structure (top to bottom, all centered):

### 1. App icon image
<Image
  source={require('../assets/icon.png')}
  style={{
    width: 120,
    height: 120,
    borderRadius: 26,
    marginBottom: 20,
    alignSelf: 'center',
  }}
  resizeMode="contain"
/>

### 2. ChefsBook dual-color logo
<Text style={{ 
  fontSize: 34, 
  fontWeight: 'bold',
  fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
  textAlign: 'center',
  marginBottom: 8,
}}>
  <Text style={{ color: colors.textPrimary }}>Chefs</Text>
  <Text style={{ color: colors.accent }}>Book</Text>
</Text>

### 3. Tagline
<Text style={{
  fontSize: 14,
  color: colors.textSecondary,
  textAlign: 'center',
  marginBottom: 32,
  fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
}}>
  Your recipes, beautifully organized
</Text>

### 4. Three decorative dots
<View style={{ 
  flexDirection: 'row', 
  gap: 8, 
  justifyContent: 'center',
  marginBottom: 40,
}}>
  <View style={{ width: 5, height: 5, borderRadius: 2.5, 
    backgroundColor: colors.borderDefault }} />
  <View style={{ width: 5, height: 5, borderRadius: 2.5, 
    backgroundColor: colors.accent }} />
  <View style={{ width: 5, height: 5, borderRadius: 2.5, 
    backgroundColor: colors.borderDefault }} />
</View>

### 5. Sign In button
Full width minus 40px margins, height 52px, borderRadius 26
Background: colors.accent, white bold text 16px
On press: navigate to /auth/signin

### 6. Create Account button (marginTop: 16)
Same dimensions, outlined style:
Border: 1.5px colors.accent, text: colors.accent
On press: navigate to /auth/signup

### 7. Continue as guest (marginTop: 24)
fontSize: 13, color: colors.textMuted, centered
With horizontal lines either side (same as mockup)
On press: navigate to /(tabs)/ without auth
Note: unauthenticated users see only public/discover recipes

### Container
- Background: colors.bgScreen (#faf7f0)
- Flex: 1, justifyContent: 'center', alignItems: 'center'
- paddingHorizontal: 40
- Safe area insets applied at top and bottom

===================================================================
## STEP 4 — Update app.json
===================================================================

In apps/mobile/app.json confirm/update:

"icon": "./assets/icon.png",
"splash": {
  "image": "./assets/splash.png",
  "resizeMode": "contain",
  "backgroundColor": "#faf7f0"
},
"android": {
  "package": "com.chefsbook.app",
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#ce2b37"
  }
}

Also update apps/mobile/app.staging.json with same asset paths.

===================================================================
## STEP 5 — Web favicon
===================================================================

Copy favicon to web:
cp apps/mobile/assets/favicon.png apps/web/public/favicon.png

In apps/web/app/layout.tsx update metadata:
export const metadata = {
  title: 'ChefsBook',
  description: 'Your recipes, beautifully organized',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
}

===================================================================
## STEP 6 — Rebuild
===================================================================

Full rebuild required for icon changes to take effect:
cd apps/mobile
npx expo run:android

===================================================================
## STEP 7 — Verify
===================================================================

1. adb screenshot to /tmp/cb_screen.png of landing screen
   Describe:
   - Icon image shows above ChefsBook logo
   - Logo is dual-color (dark Chefs, red Book)
   - Tagline visible below logo
   - Three dots visible
   - Sign In button in solid red
   - Create Account button outlined
   - Continue as guest text link
   Delete /tmp/cb_screen.png after

2. Check emulator app drawer
   Confirm new chef hat icon shows for the app

3. Test Continue as guest
   Confirm it navigates to recipe list without auth

Fix all errors without stopping.
Do not embed screenshots in conversation.
Commit: git add -A && git commit -m "feat: app icon, splash screen, landing page redesign"
