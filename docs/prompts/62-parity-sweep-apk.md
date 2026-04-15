# ChefsBook — Session 62: Web Parity Sweep + APK Rebuild
# Source: End of day verification 2026-04-10
# Target: apps/web + apps/mobile

---

## CONTEXT

Many features have been built over sessions 44–66. This session verifies every
feature works correctly on both platforms, fixes any gaps found, then builds a
fresh release APK. Run this as a single continuous session.

Read .claude/agents/testing.md, .claude/agents/ui-guardian.md,
.claude/agents/image-system.md, .claude/agents/data-flow.md, and
.claude/agents/deployment.md before starting.

---

## PART 1 — WEB VERIFICATION

For each item below, verify it works on chefsbk.app. Mark ✅ or ❌.
If ❌ — fix it immediately before moving to the next item.

### Shopping List
- [ ] Open any shopping list — no crash, no dark overlay
- [ ] Open a list WITH a store (ShopRite) — store name shows correctly
- [ ] Open a list WITHOUT a store (Sunday meals) — opens correctly, no crash
- [ ] Create new list — StorePickerDialog shows with existing stores + "New store..."
- [ ] Add recipe to shopping list → new list → StorePickerDialog appears
- [ ] Add meal plan day to cart → new list → StorePickerDialog appears
- [ ] All Create/Add buttons are pomodoro red (not green)

### Recipe Detail
- [ ] Like button toggles correctly
- [ ] Like COUNT click (as recipe owner) opens likers modal — does NOT toggle like
- [ ] Comments section visible on public recipe
- [ ] Posting a comment works — comment appears in list
- [ ] Share button opens dropdown with Copy link / PDF / Social post
- [ ] PDF download works for Pro user (generates and downloads)
- [ ] "+ Meal Plan" button in header opens meal plan picker
- [ ] Meal plan picker shows colour-coded day/meal slots
- [ ] "Your Photos" thumbnails render correctly (no broken images)
- [ ] Attribution tags show (@original_submitter locked, @shared_by removable)

### Meal Plan
- [ ] Meal plan day cards show daypart pill (bottom-left, dark background)
- [ ] Meal plan day cards show "4x Servings" pill (bottom-right, white background)
- [ ] Tapping daypart pill opens meal type picker
- [ ] Tapping servings pill opens stepper
- [ ] Adding day to cart with mismatched servings shows warning dialog

### Images
- [ ] Recipe cards in dashboard show uploaded images (no broken icons)
- [ ] Chef's hat shows when recipe has no image
- [ ] Discover/search page recipe cards show images
- [ ] Avatar images show in profile/comments/attribution

### Language
- [ ] Select French in sidebar → UI labels change to French
- [ ] Open a recipe in French → recipe content translates (after first load)
- [ ] Switch back to English → reverts correctly

### Auth + Plans
- [ ] Sign up flow includes username field with availability check
- [ ] Promo code field present on signup
- [ ] Settings shows username (locked) and display name (editable)
- [ ] Plans page shows 4 tiers with monthly/annual toggle

### Admin
- [ ] /admin route redirects non-admins silently
- [ ] Admin dashboard loads for seblux100@gmail.com

---

## PART 2 — FIX ANY ❌ ITEMS

For each failed item:
1. Identify root cause (check browser console, PM2 logs, DB)
2. Fix the code
3. Deploy to RPi5:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```
4. Re-verify the item passes

Do not proceed to Part 3 until all web items pass.

---

## PART 3 — MOBILE VERIFICATION

Launch the Android emulator:
```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME="100.79.28.59"
cd C:\Users\seblu\aiproj\chefsbook\apps\mobile
npx expo start --dev-client
```

Take ADB screenshots to verify each item:
```bash
adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png ./mobile-check.png
```

- [ ] App launches without crash
- [ ] Sign in works, session persists after close/reopen
- [ ] Recipe cards show uploaded images (not broken icons)
- [ ] Chef's hat shows when recipe has no image
- [ ] Recipe detail hero shows uploaded image (swipeable if multiple)
- [ ] Like button and count work correctly
- [ ] Comments section visible on public recipe
- [ ] "+ Meal Plan" button on recipe detail opens picker
- [ ] Meal plan day cards show daypart and servings pills
- [ ] Shopping tab → New list → StorePicker bottom sheet appears with stores
- [ ] Recipe detail → Add to Shopping List → New list → StorePicker appears
- [ ] Meal plan → cart → New list → StorePicker appears
- [ ] Language selector shows exactly 5 languages, French translates UI
- [ ] Safe area: all buttons above Android nav bar on gesture-nav device

Fix any ❌ items found on mobile before proceeding to Part 4.

---

## PART 4 — APK REBUILD

After all web and mobile verifications pass:

### Pre-build checks
```powershell
cd C:\Users\seblu\aiproj\chefsbook\apps\mobile
npx tsc --noEmit
```
Fix any TypeScript errors before building.

### Remove debug artifacts
```bash
grep -rn "console\.log\|console\.warn" apps/mobile/src apps/mobile/app \
  apps/mobile/store apps/mobile/components --include="*.ts" --include="*.tsx"
```
Remove any debug console statements found.

### Build release APK
```powershell
cd C:\Users\seblu\aiproj\chefsbook\apps\mobile\android
.\gradlew assembleRelease
```

Expected output:
```
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

### Install on device/emulator
```powershell
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

### Smoke test the APK
- [ ] App launches with chef's hat icon (not blank)
- [ ] Landing screen shows correctly (no three dots, no staging pill)
- [ ] Sign in works
- [ ] Recipe list loads with images
- [ ] Shopping list opens without crash

---

## COMPLETION CHECKLIST

- [ ] All web items verified — no ❌ remaining
- [ ] All mobile emulator items verified — no ❌ remaining
- [ ] TypeScript passes with no errors
- [ ] No console.log/warn in production code
- [ ] APK built successfully (note file size in DONE.md)
- [ ] APK installed and smoke tested
- [ ] Web deployed to RPi5 with all fixes
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
