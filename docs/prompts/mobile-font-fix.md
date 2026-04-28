# Prompt: Mobile — Fix ChefsBook Brand Font (Header + Splash Screen)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/mobile-font-fix.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: CODE FIX

## Context

The ChefsBook wordmark displays correctly on the web app using the brand font.
On mobile, the same wordmark in the app header and on the splash/welcome landing
screen is rendering in a system fallback font instead. The two images show the
difference clearly — web is correct, mobile is not.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/navigator.md`

Run ALL pre-flight checklists before writing any code.

---

## Step 1 — Identify the correct font

Find the brand font used on the web app:
- Check `apps/web/app/layout.tsx` or `apps/web/app/globals.css` for font imports
- Check `tailwind.config.js` for fontFamily definitions
- The wordmark "ChefsBook" uses a specific font for the brand name — identify the
  exact font name and weight

---

## Step 2 — Check mobile font setup

- Check `apps/mobile/app/_layout.tsx` for `useFonts` or `expo-font` usage
- Check `apps/mobile/assets/fonts/` to see what font files are present
- Check `apps/mobile/components/ChefsBookHeader.tsx` to see what fontFamily is
  applied to the "ChefsBook" wordmark text
- Check the splash/landing screen (likely `apps/mobile/app/index.tsx` or
  `apps/mobile/app/(auth)/index.tsx`) for the same

---

## Step 3 — Fix

**If the font file exists in `assets/fonts/` but is not being loaded:**
- Add it to `useFonts()` in `_layout.tsx`
- Apply the correct `fontFamily` to the wordmark Text components

**If the font file is missing from `assets/fonts/`:**
- Copy it from the web app's font assets or identify the source
- Add to `apps/mobile/assets/fonts/`
- Load via `useFonts()` in `_layout.tsx`
- Apply to wordmark Text components

**If a different font rendering approach is used (e.g. SVG logo, image asset):**
- Check how the web renders the wordmark — if it is an SVG or image, match that
  approach on mobile rather than using a Text component with custom font

**Ensure the fix covers both:**
1. `ChefsBookHeader.tsx` — the header wordmark shown on all authenticated screens
2. The splash/welcome landing screen — the wordmark shown before sign-in

The wordmark colouring must be:
- **"Chefs"** → pomodoro red `#ce2b37`
- **"book"** → black `#000000` (lowercase — rendered as "Chefsbook" not "ChefsBook")

Ensure both parts use the correct font AND the correct colour AND the correct casing.
Fix any screen or component where the wordmark is incorrectly capitalised as "ChefsBook"
or has the colours reversed.

---

## Testing

ADB screenshots required:
```bash
adb exec-out screencap -p > /tmp/font_header.png
adb exec-out screencap -p > /tmp/font_splash.png
```

- Screenshot of the app header showing "ChefsBook" in the correct brand font
- Screenshot of the splash/landing screen showing the same
- Both must visually match the web app wordmark style

Rebuild APK before testing:
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
ADB screenshots of both fixed screens are mandatory proof.
State exactly which font name and file was applied.
