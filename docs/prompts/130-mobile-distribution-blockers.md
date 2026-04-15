# ChefsBook — Session 130: Mobile Distribution Blockers
# Source: Mobile parity audit session 128 — fixes required before Play Store/App Store
# Target: apps/mobile
# Priority: Must complete before any distribution attempt

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, ui-guardian.md, and ALL
mandatory agents per SESSION START sequence before touching anything.

The mobile parity audit identified 4 distribution blockers. Fix all of
them in this session. Do not attempt Play Store / App Store submission
until all 4 pass.

---

## BLOCKER 1 — Release signing uses debug keystore

The release APK is being signed with the debug keystore. Play Store
and App Store reject apps signed with debug keystores.

### Fix
Generate a proper release keystore:

```bash
cd apps/mobile/android

# Generate release keystore (one-time)
keytool -genkey -v \
  -keystore chefsbook-release.keystore \
  -alias chefsbook \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

You will be prompted for:
- Keystore password (generate a strong one, save it securely)
- Key alias password (can be same as keystore password)
- Name, org, city, country details

IMPORTANT: Stop and ask the user for the keystore details before
generating. The user must provide or approve the passwords and
details — do not generate random ones.

After generating:
1. Add to android/gradle.properties (never commit this file):
```
MYAPP_UPLOAD_STORE_FILE=chefsbook-release.keystore
MYAPP_UPLOAD_KEY_ALIAS=chefsbook
MYAPP_UPLOAD_STORE_PASSWORD=<password>
MYAPP_UPLOAD_KEY_PASSWORD=<password>
```

2. Update android/app/build.gradle to use the release signing config:
```gradle
android {
  signingConfigs {
    release {
      storeFile file(MYAPP_UPLOAD_STORE_FILE)
      storePassword MYAPP_UPLOAD_STORE_PASSWORD
      keyAlias MYAPP_UPLOAD_KEY_ALIAS
      keyPassword MYAPP_UPLOAD_KEY_PASSWORD
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
    }
  }
}
```

3. Add chefsbook-release.keystore to .gitignore — NEVER commit this file
4. Add MYAPP_UPLOAD_* entries to .gitignore as well
5. Document the keystore location and backup instructions in CLAUDE.md

---

## BLOCKER 2 — 39+ hardcoded hex colors

Mobile components use hardcoded hex values instead of
useTheme().colors. This violates the Trattoria theme system and
will break when theme changes are needed.

### Find all violations
```bash
grep -r "#ce2b37\|#faf7f0\|#009246\|#ffffff\|#1a1a1a\|#6b7280" \
  apps/mobile/app apps/mobile/components \
  --include="*.tsx" --include="*.ts" -n | head -50
```

### Fix
For each hardcoded hex found:
- Replace with the correct useTheme().colors token:
  - #ce2b37 → colors.accent (pomodoro red)
  - #faf7f0 → colors.bgScreen (cream)
  - #009246 → colors.accentGreen (basil green)
  - #ffffff → colors.bgCard (white)
  - #1a1a1a → colors.textPrimary (near black)
  - #6b7280 → colors.textSecondary (grey)

Pattern to follow:
```typescript
// Wrong
style={{ color: '#ce2b37' }}

// Right
const { colors } = useTheme()
style={{ color: colors.accent }}
```

Fix ALL 39+ instances. Run the grep again after to confirm zero
hardcoded hex colors remain.

---

## BLOCKER 3 — 3 TypeScript errors

The mobile app has 3 TypeScript errors that must be resolved.

```bash
cd apps/mobile && npx tsc --noEmit 2>&1
```

Show the exact errors, then fix each one properly.
Do not use @ts-ignore or @ts-expect-error to suppress them.
Fix the actual type issues.

---

## BLOCKER 4 — Sign-up field visibility issue

The audit noted the sign-up screen may not be showing all fields
(username and promo code fields may be hidden or cut off).

### Diagnose
```bash
# Take ADB screenshot of sign-up screen
adb exec-out screencap -p > /tmp/signup.png
# Describe what you see
# Then delete
Remove-Item /tmp/signup.png -Force
```

If fields are missing:
- Check if the screen has proper ScrollView wrapping
- Check safe area insets on the bottom (keyboard pushes content up)
- Ensure all fields are visible when the keyboard is open

Fix any layout issues found.

---

## VERIFICATION

After all 4 blockers are fixed:

```bash
# TypeScript clean
cd apps/mobile && npx tsc --noEmit 2>&1
# Must show 0 errors

# Zero hardcoded hex
grep -r "#ce2b37\|#faf7f0\|#009246" \
  apps/mobile/app apps/mobile/components \
  --include="*.tsx" --include="*.ts" | wc -l
# Must return 0

# Build a test release APK
cd apps/mobile
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
npx expo run:android --variant release
# Must succeed without signing errors
```

---

## COMPLETION CHECKLIST

- [ ] Stopped and asked user for keystore passwords/details before generating
- [ ] Release keystore generated at android/chefsbook-release.keystore
- [ ] build.gradle updated with release signing config
- [ ] Keystore and passwords added to .gitignore (never committed)
- [ ] Keystore backup instructions documented in CLAUDE.md
- [ ] Zero hardcoded hex colors in apps/mobile (verified via grep)
- [ ] All hex replacements use useTheme().colors tokens
- [ ] 3 TypeScript errors resolved (no @ts-ignore)
- [ ] Sign-up screen shows all fields (username, email, password, promo)
- [ ] Release APK builds successfully with proper signing
- [ ] feature-registry.md updated
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
