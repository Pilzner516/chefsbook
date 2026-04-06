# Standalone Production Build — APK + Web on RPi5
# Save to: docs/prompts/standalone-build.md

Read CLAUDE.md, apps/mobile/CLAUDE.md and
.claude/agents/navigator.md to orient yourself.

Create a standalone production build of ChefsBook:
- Android APK with separate package name (installs alongside dev)
- Web app deployed to rpi5-eth
- QA notepad export via share sheet only (no adb)

===================================================================
## STEP 1 — Environment configuration
===================================================================

Create apps/mobile/.env.staging at monorepo root:

# Staging environment — points to same Supabase as dev
EXPO_PUBLIC_SUPABASE_URL=http://100.110.47.62:8000
EXPO_PUBLIC_SUPABASE_ANON_KEY=[same as dev]
EXPO_PUBLIC_ANTHROPIC_API_KEY=[same as dev]
EXPO_PUBLIC_APP_VARIANT=staging

# No REACT_NATIVE_PACKAGER_HOSTNAME needed — standalone app

Create apps/web/.env.staging:
NEXT_PUBLIC_SUPABASE_URL=http://100.110.47.62:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=[same as dev]
ANTHROPIC_API_KEY=[same as dev]
NEXT_PUBLIC_APP_URL=http://100.110.47.62:3001

===================================================================
## STEP 2 — Separate app.json for staging
===================================================================

Create apps/mobile/app.staging.json:
Copy apps/mobile/app.json exactly, then change:

{
  "expo": {
    "name": "ChefsBook",
    "slug": "chefsbook-staging",
    "scheme": "chefsbook-staging",
    "version": "1.0.0",
    "android": {
      "package": "com.chefsbook.app.staging",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ce2b37"
      }
    },
    "ios": {
      "bundleIdentifier": "com.chefsbook.app.staging"
    },
    "extra": {
      "variant": "staging"
    }
  }
}

The different package name (com.chefsbook.app.staging vs
com.chefsbook.app) allows both to install on the same device.

===================================================================
## STEP 3 — EAS build configuration
===================================================================

Update apps/mobile/eas.json to add staging profiles:

{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "gradleCommand": ":app:assembleDebug" }
    },
    "staging": {
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease",
        "config": "app.staging.json"
      },
      "env": {
        "EXPO_PUBLIC_APP_VARIANT": "staging"
      }
    },
    "production": {
      "distribution": "store",
      "android": { "buildType": "app-bundle" }
    }
  }
}

===================================================================
## STEP 4 — Build the staging APK locally
===================================================================

Do NOT use EAS cloud build — build locally to avoid costs:

cd apps/mobile

# Set staging env
cp .env.staging .env.local

# Build with staging app config
EXPO_PUBLIC_APP_VARIANT=staging npx expo run:android \
  --variant release \
  --no-build-cache

If that fails, try Gradle directly:
cd android
./gradlew assembleRelease \
  -PappVariant=staging \
  -PpackageName=com.chefsbook.app.staging

The APK will be at:
apps/mobile/android/app/build/outputs/apk/release/app-release.apk

Install on connected device:
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk

Report: confirm APK installed as "ChefsBook" alongside 
the dev client on the emulator/device.

===================================================================
## STEP 5 — QA notepad in staging build
===================================================================

In apps/mobile/components/QANotepad.tsx:

Detect the app variant from env:
const isStaging = process.env.EXPO_PUBLIC_APP_VARIANT === 'staging'

In staging mode:
- Hide the "adb commands" documentation section
- Make the Export button MORE prominent (larger, with label)
- Export button text: "Share QA Report"
- On tap: use expo-sharing to open native share sheet
  with the formatted text report
- Add instruction text below export button:
  "Share this report with your developer or paste into Claude"

In dev mode (unchanged):
- adb commands documented in CLAUDE.md
- Export button as currently implemented

===================================================================
## STEP 6 — Web staging deployment on RPi5
===================================================================

SSH to rpi5-eth and set up the web app:

ssh rasp@rpi5-eth

# Create staging directory
mkdir -p /mnt/chefsbook/web-staging
cd /mnt/chefsbook/web-staging

# Clone or copy the web app
# Option A — if git is set up on Pi:
git clone [repo URL] chefsbook
cd chefsbook

# Option B — rsync from dev machine (run from Windows):
# rsync -av --exclude node_modules --exclude .next \
#   /c/Users/seblu/aiproj/chefsbook/apps/web/ \
#   rasp@rpi5-eth:/mnt/chefsbook/web-staging/

# Install and build
cd apps/web
npm install
cp .env.staging .env.local
npm run build

# Install PM2 if not present
npm install -g pm2

# Start on port 3001 (3000 = dev, 3001 = staging)
pm2 start npm --name "chefsbook-staging" -- start -- -p 3001
pm2 save
pm2 startup

Create a deploy script at /mnt/chefsbook/deploy-staging.sh:
#!/bin/bash
cd /mnt/chefsbook/web-staging
git pull origin main
cd apps/web
npm install
npm run build
pm2 restart chefsbook-staging
echo "Staging deployed at http://100.110.47.62:3001"

chmod +x /mnt/chefsbook/deploy-staging.sh

Staging web URL: http://100.110.47.62:3001
Dev web URL:     http://localhost:3000 (unchanged)

===================================================================
## STEP 7 — Version indicator in both apps
===================================================================

Add a subtle version/environment indicator so you always
know which build you're using:

In apps/mobile/components/ChefsBookHeader.tsx:
If EXPO_PUBLIC_APP_VARIANT === 'staging':
  Show a tiny "STAGING" badge next to the logo:
  - 9px text, colors.accentGreen background (#009246)
  - White text, 3px 6px padding, border radius 4px
  - Positioned as superscript next to "Book"

In apps/web (layout or header):
If staging env:
  Show "STAGING" badge in same style in the header

This makes it instantly obvious which version you're in.

===================================================================
## STEP 8 — APK distribution
===================================================================

After building, copy the APK to a convenient location:

# Copy to user downloads for easy access
adb pull \
  /data/app/com.chefsbook.app.staging*/base.apk \
  C:/Users/seblu/Downloads/ChefsBook-staging.apk

# Also save to project:
cp apps/mobile/android/app/build/outputs/apk/release/app-release.apk \
   docs/builds/ChefsBook-staging-v1.0.apk

Create docs/builds/ directory and add to .gitignore:
echo "docs/builds/*.apk" >> .gitignore

Document in CLAUDE.md under "## Builds":
### Staging APK
Package: com.chefsbook.app.staging
Location: docs/builds/ChefsBook-staging-v1.0.apk
Web: http://100.110.47.62:3001
Build command: cd apps/mobile && npx expo run:android --variant release
Deploy web: ssh rasp@rpi5-eth && /mnt/chefsbook/deploy-staging.sh

### To update staging after code changes:
1. cd apps/mobile && npx expo run:android --variant release
2. adb install -r [apk path]
3. ssh rasp@rpi5-eth && /mnt/chefsbook/deploy-staging.sh

===================================================================
## STEP 9 — Verify
===================================================================

1. Confirm APK installs as separate app from dev client
   adb shell pm list packages | grep chefsbook
   Should show both:
   package:com.chefsbook.app
   package:com.chefsbook.app.staging

2. Launch staging app — confirm:
   - STAGING badge visible in header
   - Can log in with a@aol.com
   - Recipes load from Supabase
   - QA notepad accessible via logo tap
   - Share export works (no adb commands shown)

3. Open http://100.110.47.62:3001 in browser
   Confirm web staging is running

4. adb screenshot to /tmp/cb_screen.png
   Describe: both apps visible, staging badge showing
   Delete after

===================================================================
## RULES
===================================================================
- Dev environment (localhost:3000, com.chefsbook.app) 
  must remain completely unchanged
- Staging shares the same Supabase DB as dev
- Never commit .env.staging files — add to .gitignore
- Fix all errors without stopping
- Do not embed screenshots in conversation
- Commit when complete:
  git add -A && git commit -m "feat: staging build config — APK + web on rpi5"
