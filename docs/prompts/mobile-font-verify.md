# Prompt: Mobile Wordmark Font — Verify and Fix to Match Web

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/mobile-font-verify.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: CODE FIX

## Context

The previous session (MOBILE-FONT-FIX) applied Inter-Bold to the mobile wordmark.
Inter is the body font for ChefsBook but may NOT be the wordmark font. The web app
may use Playfair Display or another display font specifically for the "Chefsbook"
wordmark. This session must verify and fix if wrong.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/navigator.md`

---

## Step 1 — Find the exact font used on web

Read `apps/web/app/layout.tsx` and look for font imports at the top of the file.
There will be one or more `next/font/google` imports. Identify:

1. Which font is applied to the `<body>` tag (this is the body font)
2. Which font is used specifically in the wordmark component

Then find the wordmark component on web — search for "Chefsbook" or "ChefsBook"
as a text string in `apps/web/components/` and `apps/web/app/`. Look at what
`className` or `style` is applied to the "Chefs" and "book" text spans.

Record the exact font family name(s) used for the wordmark.

---

## Step 2 — Compare to mobile

Open `apps/mobile/components/ChefsBookHeader.tsx` and check what `fontFamily`
is currently applied to the wordmark text.

**If mobile already uses the same font as web:** session is done — confirm with
an ADB screenshot and wrapup. No changes needed.

**If mobile uses a different font (e.g. Inter-Bold but web uses Playfair Display):**
proceed to Step 3.

---

## Step 3 — Fix the font

### Download the correct font file

If the web wordmark uses a Google Font (e.g. Playfair Display):
- Find or download the .ttf file for the correct weight
- Common source: `https://fonts.google.com/specimen/Playfair+Display`
- Download the Bold weight (700) .ttf file
- Save to `apps/mobile/assets/fonts/` with a clear name
  e.g. `PlayfairDisplay-Bold.ttf`

If the web wordmark uses a custom/local font file:
- Find it in `apps/web/public/fonts/` or `apps/web/app/fonts/`
- Copy it to `apps/mobile/assets/fonts/`

### Load the font in mobile

In `apps/mobile/app/_layout.tsx`, add the new font to `useFonts()`:

```typescript
const [fontsLoaded] = useFonts({
  'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  'PlayfairDisplay-Bold': require('../assets/fonts/PlayfairDisplay-Bold.ttf'),
  // add the correct font name here
});
```

### Apply to wordmark components

Update ALL of the following to use the correct wordmark font:
- `apps/mobile/components/ChefsBookHeader.tsx`
- The splash/landing screen wordmark
- Any other screen where "Chefsbook" appears as a styled text wordmark

The wordmark colouring remains:
- **"Chefs"** → `#ce2b37` (pomodoro red)
- **"book"** → `#000000` (black, lowercase)

---

## Step 4 — Visual comparison

Take ADB screenshots and visually compare:
- Mobile header wordmark
- Web header wordmark (open chefsbk.app in the browser and screenshot or
  compare side by side)

They should look the same font style. If they do not match, investigate further
before wrapping up.

```bash
adb exec-out screencap -p > /tmp/wordmark_verify.png
```

---

## Deploy

Rebuild and reinstall APK only if font files or components changed:
```bash
rm -f android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle

export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
cd apps/mobile
EXPO_PUBLIC_APP_VARIANT=staging npx expo run:android --variant release
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

If no font changes were needed, no rebuild required.

---

## Wrapup

Follow `wrapup.md` fully.
State explicitly in DONE.md:
- What font the web wordmark uses
- What font mobile now uses
- Whether they match
ADB screenshot mandatory as proof.
