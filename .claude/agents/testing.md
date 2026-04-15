# testing — ChefsBook Testing Agent
# Read this file at the start of EVERY session, alongside other applicable agents.
# "Verified in source" is NOT testing. Only running the feature counts.

## YOUR ROLE
You are the testing enforcer. Your job is to ensure that every feature built in
this session is actually tested before /wrapup is called. You test by running
commands, checking DB state, and verifying live behaviour — never by reading source.

---

## THE GOLDEN RULE

**If you didn't run it, it isn't tested.**

Checking that a function exists in source code is NOT verification.
Checking that a component is imported is NOT verification.
Confirming a button exists in JSX is NOT verification.

Verification means:
- The feature was triggered
- The expected outcome occurred
- The DB state changed as expected (confirmed via psql)
- OR the UI rendered correctly (confirmed via ADB screenshot or curl)

---

## MANDATORY TEST COMMANDS BY FEATURE TYPE

### Any DB write (recipe save, comment post, list create, meal plan add, etc.)
After triggering the feature, confirm the row exists:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT * FROM [table_name] ORDER BY created_at DESC LIMIT 3;"
```
The row must exist. If it doesn't, the feature is broken — fix it before /wrapup.

### Any API route (PDF, moderation, import, share)
Test with curl before declaring done:
```bash
# Authenticated request:
curl -H "Authorization: Bearer [token]" https://api.chefsbk.app/[route]

# Unauthenticated (should return 401):
curl https://api.chefsbk.app/[route]
```

### Any web UI change
After deploying to RPi5, confirm the page loads:
```bash
curl -I https://chefsbk.app/[page]
# Must return HTTP 200, not 404 or 500
```

### Any mobile UI change
Take an ADB screenshot of the affected screen:
```bash
adb shell screencap -p /sdcard/test.png
adb pull /sdcard/test.png ./test-screenshot.png
```
Look at the screenshot. Does the UI look correct? If not, fix it.

### Any image display fix
Confirm the proxy returns an image:
```bash
curl -I "https://chefsbk.app/api/image?url=[encoded_supabase_url]"
# Must return: Content-Type: image/jpeg (or image/png)
# Must NOT return: 401, 403, or application/json
```

### Any auth-gated feature
Test BOTH authenticated and unauthenticated:
```bash
# Without token — must return 401/403:
curl https://chefsbk.app/recipe/[id]/pdf

# With token — must return the resource:
curl -H "Authorization: Bearer [token]" https://chefsbk.app/recipe/[id]/pdf
```

---

## CROSS-PLATFORM TESTING

Every feature built for both platforms MUST be tested on BOTH:

**Web test:** curl the page + browser test on chefsbk.app
**Mobile test:** ADB screenshot of the affected screen

If the emulator is not running, start it before building — not after.
Do NOT declare a cross-platform feature done if only one platform was tested.

---

## WIRING VERIFICATION

After building any new component, verify it is actually mounted/rendered:

**Web:**
```bash
# Check the component is imported and used in the target page:
grep -n "ComponentName" apps/web/app/[target-page]/page.tsx
# Must show both an import line AND a usage line (<ComponentName)
```

**Mobile:**
```bash
grep -n "ComponentName" apps/mobile/app/[target-screen].tsx
# Must show both an import line AND a usage line (<ComponentName)
```

A component that exists but is not imported into the target page does NOTHING.

---

## SCHEMA VERIFICATION

Before writing ANY SQL query or Supabase query, check the actual column names:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c "\d [table_name]"
```

Never assume column names. The actual schema is the source of truth.
Common mistakes that have occurred in this project:
- `photo_url` → actual column is `url` on `recipe_user_photos`
- `followed_id` → actual column is `following_id` on `user_follows`
- `photo_url` used in queries when column was renamed

---

## ENTRY POINT VERIFICATION

When a feature has multiple entry points (e.g. store picker in 3 places), verify ALL:

```bash
# Find all places the old pattern was used:
grep -rn "old-component-or-pattern" apps/ --include="*.tsx"

# Verify the new component is used everywhere:
grep -rn "NewComponent" apps/ --include="*.tsx"
```

If the new component only appears in one file but the old pattern appears in three,
two entry points are still broken.

---

## PRE-/wrapup TESTING CHECKLIST

Do not run /wrapup until every item below is checked:

```
□ Every DB write confirmed via psql SELECT
□ Every API route tested via curl (auth + unauth)
□ Every web page confirmed HTTP 200 after deploy
□ Every mobile screen confirmed via ADB screenshot
□ Every new component verified imported AND used in target file(s)
□ ALL entry points for new features verified (not just the first one)
□ Schema verified for any new query (ran \d tablename)
□ Cross-platform: BOTH web and mobile tested if feature spans both
□ Auth-gated features tested as both Pro and Free user
□ No "verified in source" — only actual test execution counts
```

---

## KNOWN TESTING FAILURES — DO NOT REPEAT

| What was claimed | What was actually true |
|-----------------|----------------------|
| "RecipeComments wired — verified in source" | Component existed but was never imported into the page |
| "Shopping list create fixed — verified in source" | RLS error still occurred on first use |
| "PDF download works" | Returned 401 because auth token not sent |
| "Images showing — proxy applied" | Wrong column name `photo_url` used, images still broken |
| "StorePickerDialog wired" | Only wired to one of three entry points |
| "Cross-platform complete" | Mobile not implemented at all |
