# ChefsBook — Session 128: Mobile vs Web Feature Parity Audit
# Source: Web app significantly advanced in sessions 87-127, mobile needs catching up
# Target: apps/mobile + apps/web (read-only audit)
# Output: docs/MOBILE-PARITY-AUDIT-2026-04-14.md

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before starting.

This session produces a comprehensive parity audit comparing the mobile
app against the web app. Do NOT fix anything — document everything.

The goal is to identify what needs to be built/fixed on mobile before
distributing on Android and iOS.

---

## AUDIT METHODOLOGY

For each feature area:
1. Read the web implementation
2. Read the mobile implementation
3. Compare and classify as:
   - ✅ PARITY — mobile matches web
   - ⚠️ PARTIAL — mobile has the feature but incomplete/different
   - ❌ MISSING — feature exists on web, not on mobile
   - 📱 MOBILE-ONLY — feature only makes sense on mobile (skip)
   - 🚫 DEFERRED — intentionally not on mobile yet (document reason)

---

## SECTION 1 — Authentication & Onboarding

Check each on mobile vs web:
- Email/password sign in
- Sign up with username + family-friendly check
- Forgot password / reset link flow
- Change password in settings
- Onboarding bubbles (web has 8 pages — does mobile have any?)
- Help tips toggle in settings

---

## SECTION 2 — Recipe Management

- Recipe list (My Recipes) — grid/list/table views
- Recipe detail (read mode) — all sections visible
- Recipe detail (edit mode) — all fields editable
- Cuisine dropdown (web now has full dropdown — does mobile?)
- Tags management (add/remove/AI suggest)
- Recipe versioning + Save a Copy
- Recipe visibility toggle (private/shared_link/public)
- Attribution pills (submitter + source URL — both showing?)
- Like button (web now via API route — mobile still direct?)
- Save/bookmark button + count
- Comment section (threaded, unlimited depth)
- Comment likes
- Comment notifications to recipe owner
- Like notifications to recipe owner
- Share recipe (copy link, PDF, social)
- Print recipe (web only — mobile uses share/PDF)
- Add to meal plan from recipe detail
- Add to shopping list from recipe detail
- Translated titles in recipe list
- "Hang tight" translation banner on recipe detail
- Recipe moderation (AI runs on import/edit)

---

## SECTION 3 — Import & Scan

- URL import (JSON-LD first, Claude fallback)
- Instagram import
- Multi-page photo scan
- Dish identification from photo
- Speak a Recipe
- File import (PDF/Word/CSV) — web only or mobile too?
- YouTube import — web only or mobile too?
- Cookbook intelligence (ISBN/barcode)
- Pexels photo picker after import
- Post-import image sheet
- Title translation fires on import
- isInstagramUrl check before standard import

---

## SECTION 4 — Search & Discovery

- My Recipes / All Recipes toggle (added session 88)
- Search by title, cuisine, tags, ingredients
- Category filter pills (cuisine, course, dietary)
- Public recipe feed (All Recipes default)
- Follow-based What's New feed
- Auto-tag button

---

## SECTION 5 — Shopping List

- Store-first list creation (StorePicker)
- Store grouping with logos (StoreAvatar)
- Department grouping (13 departments)
- 3 view modes (Dept/Recipe/A-Z)
- Font size toggle (A/A+/A++)
- Check off items (local-only)
- Offline cache + sync on reconnect
- Consolidated "All [Store]" view — formatting matches individual lists?
- View mode toggle on consolidated list
- Add to list from recipe detail
- Add week/day from meal plan

---

## SECTION 6 — Meal Plan

- 7-day calendar view
- Add recipe to day (MealPlanPicker)
- Daypart pill (tappable — Breakfast/Lunch/Dinner/Snack)
- Servings pill (tappable stepper)
- Portions mismatch warning
- AI Meal Plan Wizard
- Remove recipe from day
- Add day/week to shopping cart
- Servings mismatch warning when adding from recipe detail

---

## SECTION 7 — Notifications & Social

- Notification bell (web has full panel — does mobile have equivalent?)
- Notification types: comment, like, follow, moderation
- Follow / unfollow on profiles
- Followers / Following lists
- What's New feed
- Direct messages (/dashboard/messages equivalent on mobile?)
- Message compose from profile
- Unread message badge

---

## SECTION 8 — Settings & Preferences

- Language selector (exactly 5 languages)
- Metric/Imperial toggle (wired to unitConversion.ts?)
- Profile edit (name, bio, avatar)
- Privacy toggle (is_searchable)
- Change password
- Plan display + upgrade CTA
- Help tips toggle (ON/OFF visual switch)
- Feedback card ("Got an Idea?")

---

## SECTION 9 — Profile Pages

- Own profile view
- Other user profile (/dashboard/chef/[username] equivalent)
- Follow/Following counts
- Public recipes shown on profile
- Message button on other user profile
- Sidebar visible on profile pages (web fixed this)

---

## SECTION 10 — Cookbooks & Techniques

- Cookbook list (My Cookbooks)
- Cookbook detail with recipe cards
- Technique list (My Techniques)
- Technique detail page

---

## SECTION 11 — Mobile-Specific UX Checks

Check these mobile-specific concerns:
- Safe area insets on ALL modals, bottom sheets, footers
- Tab bar visible and correct size
- No hardcoded hex colors (useTheme().colors everywhere)
- No Alert.prompt usage (should be ChefsDialog)
- No native confirm/alert (should be ChefsDialog)
- ADB screenshot of key screens: recipes tab, recipe detail,
  search, scan, shop, plan, settings
  (describe what you see — do not embed images)
- Are there any screens that crash on open?
- Does the app run on API 33/34 emulator?

---

## SECTION 12 — Build Readiness for Distribution

Check the following for Play Store / App Store readiness:

```bash
# Check app.json / app.config.js
cat apps/mobile/app.json | grep -E "version|bundleId|package|icon|splash"

# Check for debug artifacts
grep -r "console\.log\|__DEV__" apps/mobile/app \
  --include="*.tsx" --include="*.ts" | wc -l

# Check EAS config
cat apps/mobile/eas.json

# Check Android permissions in app.json
cat apps/mobile/app.json | grep -A5 "permissions"

# Check if release APK builds cleanly
# (do not build — just check gradle config)
cat apps/mobile/android/app/build.gradle | grep -E "versionCode|versionName"
```

Distribution checklist:
- [ ] App icon (all sizes) — is CBHat.png correctly applied?
- [ ] Splash screen — correct branding?
- [ ] Bundle ID correct (com.chefsbook.app — not stale squash-scorer)
- [ ] Version number set
- [ ] No debug console.log artifacts
- [ ] Release signing configured
- [ ] Privacy policy URL in app store listing (/privacy page exists ✓)
- [ ] iOS: stub configured for future submission?

---

## REPORT FORMAT

Structure docs/MOBILE-PARITY-AUDIT-2026-04-14.md as:

```markdown
# ChefsBook Mobile Parity Audit
# Date: 2026-04-14
# Web reference: sessions 87-127

## Executive Summary
[Top 5 most important gaps to fix before distribution]

## Distribution Blockers 🔴
[Any issues that MUST be fixed before Play Store / App Store submission]

## High Priority Gaps ⚠️
[Features missing on mobile that significantly affect UX]

## Medium Priority Gaps
[Features missing but not blocking distribution]

## Low Priority / Deferred
[Intentionally deferred or web-only features]

## Mobile-Specific Issues
[Things broken or wrong specifically on mobile]

## Build Readiness Checklist
[Pass/fail for each distribution item]

## Section-by-Section Findings
[Full parity table per section]

## Recommended Build Order
[Ordered list of what to fix first for fastest path to distribution]
```

---

## COMPLETION CHECKLIST

- [ ] All 12 sections audited with real code evidence
- [ ] ADB screenshots taken and described for key screens
- [ ] Report written to docs/MOBILE-PARITY-AUDIT-2026-04-14.md
- [ ] Distribution blockers clearly identified
- [ ] Recommended build order provided
- [ ] No fixes applied — audit only
- [ ] Committed: git add docs/MOBILE-PARITY-AUDIT-2026-04-14.md && git commit
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
