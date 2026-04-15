# ChefsBook — Session 42: Full Verification Sweep
# Purpose: Verify all features from sessions 36–41 are working correctly on
#          both chefsbk.app (web) and the installed APK (mobile)
# Target: apps/web (live) + apps/mobile (emulator or device)

---

## CONTEXT

This is a verification-only session. Do NOT write any new code unless something
is completely broken and unfixable without a small targeted fix. The goal is to
confirm everything deployed is working, identify anything still broken, and
produce a clear QA report.

SSH to RPi5 first to confirm the web app is running:
```bash
ssh rasp@rpi5-eth
pm2 status
```
Confirm `chefsbook-web` shows `online`. If not, run `pm2 restart chefsbook-web`.

---

## WEB VERIFICATION — chefsbk.app

Open chefsbk.app in a browser and verify each item. Mark ✅ pass or ❌ fail.

### Landing Page (session 36 + 37)
- [ ] Chef's hat logo is high resolution and not blurry, displayed at ~128px
- [ ] Feature card emoji icons are removed, headers are larger with red left border
- [ ] "How it works" shows 4 distinct cards side by side (not plain circles)
- [ ] Monthly/Annual toggle is vertically aligned on the same line
- [ ] "Start for free" buttons navigate to the sign-up page (not 404)
- [ ] "See how it works" scrolls to the How it works section

### Recipe Detail (session 38)
- [ ] Like count shows near the recipe title (not at the bottom)
- [ ] Share button opens dropdown with: Copy link, Download PDF (Pro), Social post
- [ ] PDF option is gated — non-Pro sees upgrade prompt
- [ ] No standalone PDF button at the bottom of the recipe
- [ ] Comments section is visible on public recipes (empty state if no comments)
- [ ] Discover is removed from the sidebar navigation

### Images (session 39)
- [ ] Recipe cards in dashboard show uploaded images (not broken icons)
- [ ] Recipe cards in search results show images
- [ ] Meal plan day cards show recipe images
- [ ] Add recipe modal in meal plan shows recipe thumbnails
- [ ] Avatar in settings page shows (not broken)
- [ ] Chef's hat shown when recipe has no image
- [ ] "Your Photos" thumbnails in recipe detail show correctly

### Shopping List (session 40)
- [ ] Creating a new shopping list does not crash
- [ ] List is created successfully and appears in the list

### Usernames (session 40)
- [ ] Settings page: username shows with lock icon and "Cannot be changed" text
- [ ] Settings page: display name has helper text explaining it's changeable

### Recipe Moderation (session 41)
- [ ] Admin dashboard at chefsbk.app/admin shows recipe moderation queue section
- [ ] Mild flagged recipes show yellow "FLAGGED — MILD" badge
- [ ] Serious flagged recipes show red "AUTO-HIDDEN — SERIOUS" badge

---

## MOBILE VERIFICATION — emulator or device

Launch the app and verify each item:

### Images
- [ ] Recipe cards show uploaded images (Pexels, camera, gallery)
- [ ] Chef's hat shows when recipe has no image
- [ ] Recipe detail hero shows uploaded image (not chef's hat alongside it)

### Usernames + Plans
- [ ] Sign up flow includes username field with availability check
- [ ] Pro plan features accessible (confirm with pro100 promo code account)

### Recipe Moderation
- [ ] Importing a recipe runs moderation (no visible change for clean recipes)
- [ ] Frozen account banner appears in layout if account is frozen (test via admin)

### General
- [ ] App launches without crash
- [ ] Sign in works and session persists after closing and reopening
- [ ] Shopping list create works on mobile

---

## OUTPUT

Produce a QA report with this format:

```
## chefsbk.app Verification Report — [date]

### ✅ Passing
- [list each passing item]

### ❌ Failing
- [list each failing item with brief description of what's wrong]

### ⚠️ Not Tested
- [list anything that couldn't be tested and why]
```

Do NOT attempt to fix failing items in this session. Just document them clearly
so they can be addressed in the next round of fix prompts.

---

## COMPLETION

- [ ] Web verification complete
- [ ] Mobile verification complete
- [ ] QA report produced and saved to `docs/QA-REPORT-2026-04-10.md`
- [ ] Run /wrapup to update DONE.md
