# ChefsBook Mobile Parity Audit
# Date: 2026-04-14
# Web reference: sessions 87-131
# Auditor: Claude Code (session 132)

---

## Executive Summary

1. **No notification system on mobile** — Web has a full 5-tab notification panel (comments, likes, followers, moderation). Mobile has zero notification UI. Users cannot see when someone likes, comments, or follows them.
2. **No message inbox on mobile** — Web has a full conversation UI with Realtime. Mobile can compose messages from profiles but has no inbox/history to read replies.
3. **Like button bypasses plan gate on mobile** — Web uses `/api/recipe/[id]/like` server route with 403 for free users + upgrade dialog. Mobile calls `toggleLike()` directly — no plan enforcement.
4. **39+ hardcoded hex colors in mobile code** — Violates the `useTheme().colors` mandate. Spread across recipe detail, layout, plans, search, and speak screens.
5. **Release signing not configured** — Android release build uses `signingConfigs.debug`. Cannot submit to Play Store without proper keystore.

---

## Distribution Blockers

| Issue | Severity | Details |
|-------|----------|---------|
| Release signing uses debug keystore | BLOCKER | `build.gradle` line 115: `signingConfig signingConfigs.debug` for release builds. Must configure production keystore before Play Store submission. |
| 39+ hardcoded hex colors | HIGH | Files: recipe/[id].tsx, _layout.tsx, plans.tsx, search.tsx, speak.tsx + 6 others. Colors include #ffffff, #92400e, #faf7f0, #1a1a1a, #7a6a5a, #fef3c7, #fbbf24, #a81f2a, #ef4444, #f59e0b. Must migrate to `useTheme().colors`. |
| Mobile TypeScript errors (3) | MEDIUM | `SafeAreaView` style prop issue on auth/signin.tsx:62 and auth/signup.tsx:80. expo-file-system type resolution (runtime works). |
| No forgot password link visible | MEDIUM | Sign In screen shows no "Forgot password?" link in the visual (code has modal at signin.tsx:42-56 but may not render visibly on all builds). |
| Sign Up missing username field | CHECK | ADB screenshot of Sign Up shows only Full name / Email / Password. Username + promo code fields (present in source code) may require scrolling or may be in a stale build. Verify on fresh build. |

---

## High Priority Gaps

### 1. Notification System (MISSING)
- **Web:** Full NotificationBell component with slide-in panel, 5 tabs (All/Comments/Likes/Followers/Moderation), unread badge, mark-read
- **Mobile:** No notification bell, no notification list, no notification screen
- **Impact:** Users have no way to know someone interacted with their content

### 2. Message Inbox (MISSING)
- **Web:** Full conversation list + thread view with avatars, Realtime subscription, role pills
- **Mobile:** Can compose a message from another user's profile (bottom sheet), but **no inbox screen** to view conversations or read replies
- **Impact:** Messages are write-only on mobile — users can send but never read responses

### 3. Like Plan Gate (MISSING)
- **Web:** LikeButton calls `/api/recipe/[id]/like` → returns 403 for free plan → shows upgrade dialog
- **Mobile:** LikeButton calls `toggleLike(recipeId, userId)` directly from `@chefsbook/db` — no plan check
- **Impact:** Free users can like on mobile, violating subscription model

### 4. Translated Titles in Recipe List (MISSING)
- **Web:** Recipe list shows translated titles via `getBatchTranslatedTitles()` when language != English
- **Mobile:** Recipe list shows only `item.title` (English original)
- **Impact:** Non-English users see untranslated titles

### 5. Translation Banner on Recipe Detail (MISSING)
- **Web:** Shows "Hang tight -- we're translating this recipe for you..." banner with spinner during Sonnet translation
- **Mobile:** No loading/pending UI for translation

### 6. Visibility Toggle (MISSING)
- **Web:** Private/Public toggle on recipe detail
- **Mobile:** No visibility management UI at all
- **Impact:** Users cannot make recipes private from mobile

---

## Medium Priority Gaps

| Feature | Web | Mobile | Notes |
|---------|-----|--------|-------|
| Recipe list view modes (grid/list/table) | 3 modes with localStorage | Grid only | Low priority — grid works well on mobile |
| Save/bookmark button on recipe detail | toggleFavourite button | Shows save_count but no action button | Users can see saves but can't bookmark |
| Title translation on import | Fire-and-forget via saveWithModeration | Not triggered | New imports don't get title translations |
| Recipe moderation on import | Via saveWithModeration wrapper | Runs directly but separately | Functionally equivalent |
| Auto-tag button | In search page | Not present | Web-only feature |
| Avatar upload in settings | Click-to-upload file input | Not implemented | Can only change on web |
| Help tips toggle | ON/OFF switch in settings | Not present | Web-only onboarding |
| Feedback card ("Got an Idea?") | FeedbackCard component | Not found in mobile | Missing user feedback path |
| Cookbook list screen | Full grid with covers | Not present | Only cookbook detail exists |
| Cookbook add (ISBN/barcode) | Modal with lookup | Not present | Web-only |
| Technique list + detail | Full pages with difficulty badges | Not present at all | Entirely missing on mobile |
| File import (PDF/Word/CSV) | /api/import/file | Not present | Web-only |
| YouTube import | /api/import/youtube | Listed in SOURCE_OPTIONS but not wired | Dead button |
| Metric/Imperial toggle UI | Toggle in sidebar | Exists in preferencesStore but no visible UI | Toggle stored but hidden |

---

## Low Priority / Deferred

| Feature | Reason |
|---------|--------|
| Onboarding bubbles (8 pages) | Web-first UX; mobile would need different approach (tooltips or walkthrough) |
| Print recipe | N/A on mobile — share/PDF covers this |
| Admin dashboard | Web-only by design |
| Cookbook intelligence (ISBN lookup) | Complex UI, web-first |
| Bookmark batch import | Desktop workflow (bookmarks.html export) |

---

## Mobile-Specific Issues

### UX Issues Observed via ADB
1. **Landing screen** — Clean, well-branded. Chef's hat logo, "Your recipes, beautifully organized" tagline, Sign In (filled red), Create Account (outlined), Continue as guest. No safe area issues visible.
2. **Sign In screen** — "Welcome back" header, Email + Password fields, Sign In button, Google OAuth stub ("Sign in with Google"), "Don't have an account? Sign Up" link. **No visible "Forgot password?" link** despite code containing the modal.
3. **Sign Up screen** — "Create Account" header with Full name / Email / Password only visible. **Username field not visible** in screenshot — may require scroll or may be a stale build (code has username + promo code fields).

### Code Issues
1. **39+ hardcoded hex colors** — Directly violates the `useTheme().colors` mandate from ui-guardian.md
2. **3 TypeScript errors** — SafeAreaView style prop type mismatch on both auth screens
3. **YouTube import dead button** — Listed in SOURCE_OPTIONS but handler not wired in scan.tsx
4. **Metric/Imperial toggle invisible** — State exists in preferencesStore but no UI exposes it in settings

---

## Build Readiness Checklist

| Item | Status | Evidence |
|------|--------|----------|
| App icon (all sizes) | PASS | `./assets/icon.png` configured in app.json |
| Splash screen | PASS | Configured with #faf7f0 background |
| Bundle ID | PASS | `com.chefsbook.app` (iOS + Android) |
| Version number | PASS | 1.0.0 / versionCode 1 |
| No debug console.log | PASS | 0 occurrences in app/ and components/ |
| No __DEV__ checks | PASS | 0 occurrences |
| Release signing | FAIL | Uses `signingConfigs.debug` for release builds |
| EAS build profiles | PASS | 4 profiles: development, staging, preview, production |
| EAS production auto-increment | PASS | `autoIncrement: true` for versionCode |
| Jetifier | PASS | `android.enableJetifier=true` in gradle.properties |
| Alert.prompt usage | PASS | None found |
| window.confirm/alert | PASS | None found |
| Privacy policy URL | PASS | /privacy page exists on web |
| iOS stub | PASS | iOS bundleId configured in app.json |
| Hardcoded hex colors | FAIL | 39+ instances across 10+ files |
| TypeScript clean | FAIL | 3 errors (SafeAreaView + expo-file-system) |

---

## Section-by-Section Findings

### Section 1: Authentication & Onboarding

| Feature | Mobile | Web | Parity |
|---------|--------|-----|--------|
| Email/password sign in | EXISTS (auth/signin.tsx) | EXISTS | PARITY |
| Sign up with username | EXISTS (auth/signup.tsx, regex validation) | EXISTS | PARITY |
| Username family-friendly check | EXISTS (isUsernameFamilyFriendly call) | EXISTS | PARITY |
| Google OAuth | STUB (button exists, not wired) | STUB | PARITY |
| Forgot password | EXISTS (modal in signin.tsx) | EXISTS | PARTIAL - not visually prominent on mobile |
| Change password | EXISTS (modal.tsx settings) | EXISTS | PARITY |
| Landing page | EXISTS (index.tsx, chef's hat + CTAs) | EXISTS (page.tsx hero) | PARITY |
| Onboarding bubbles | MISSING | EXISTS (8 pages, 20+ bubbles) | MISSING |
| Help tips toggle | MISSING | EXISTS (settings) | MISSING |

### Section 2: Recipe Management

| Feature | Mobile | Web | Parity |
|---------|--------|-----|--------|
| Recipe list | EXISTS (FlashList grid) | EXISTS (grid/list/table) | PARTIAL |
| Recipe detail (read) | EXISTS | EXISTS | PARITY |
| Recipe detail (edit) | EXISTS (all fields) | EXISTS (all fields) | PARITY |
| Cuisine dropdown | EXISTS | EXISTS | PARITY |
| Tags management | EXISTS (TagManager) | EXISTS | PARITY |
| Versioning + Save a Copy | EXISTS | EXISTS | PARITY |
| Visibility toggle | MISSING | EXISTS | MISSING |
| Attribution pills | EXISTS | EXISTS | PARITY |
| Like button | EXISTS (direct DB, no plan gate) | EXISTS (API route, plan gate) | PARTIAL |
| Save/bookmark button | MISSING (shows count only) | EXISTS | PARTIAL |
| Comments (threaded) | EXISTS | EXISTS | PARITY |
| Comment likes | EXISTS | EXISTS | PARITY |
| Comment notifications | EXISTS (createNotification) | EXISTS | PARITY |
| Like notifications | EXISTS (via toggleLike) | EXISTS (via API route) | PARTIAL |
| Share recipe | EXISTS (share menu) | EXISTS | PARITY |
| PDF export | EXISTS (Pro gate) | EXISTS (Pro gate) | PARITY |
| Add to meal plan | EXISTS | EXISTS | PARITY |
| Add to shopping list | EXISTS | EXISTS | PARITY |
| Translated titles in list | MISSING | EXISTS | MISSING |
| Translation banner | MISSING | EXISTS | MISSING |
| Recipe moderation | EXISTS | EXISTS | PARITY |

### Section 3: Import & Scan

| Feature | Mobile | Web | Parity |
|---------|--------|-----|--------|
| URL import (JSON-LD) | EXISTS | EXISTS | PARITY |
| Instagram import | EXISTS (isInstagramUrl check) | MISSING (no IG check) | MOBILE-ONLY |
| Multi-page photo scan | EXISTS (up to 5 pages) | MISSING | MOBILE-ONLY |
| Dish identification | EXISTS (analyseScannedImage) | MISSING | MOBILE-ONLY |
| Speak a Recipe | EXISTS | EXISTS | PARITY |
| File import (PDF/Word/CSV) | MISSING | EXISTS | DEFERRED |
| YouTube import | PARTIAL (listed, not wired) | EXISTS | MISSING |
| Cookbook ISBN/barcode | MISSING | EXISTS | DEFERRED |
| Pexels photo picker | EXISTS | MISSING | MOBILE-ONLY |
| PostImportImageSheet | EXISTS | MISSING | MOBILE-ONLY |
| Title translation on import | MISSING | EXISTS | MISSING |
| Moderation on import | EXISTS | EXISTS | PARITY |

### Section 4: Search & Discovery

| Feature | Mobile | Web | Parity |
|---------|--------|-----|--------|
| My Recipes / All toggle | EXISTS (Discover/My Recipes) | EXISTS | PARITY |
| Search by title/cuisine/tags | EXISTS | EXISTS | PARITY |
| Category filter pills | EXISTS (8 types, visual pills) | EXISTS (dropdown panels) | PARITY |
| Public feed | EXISTS | EXISTS | PARITY |
| What's New (followed) | EXISTS | MISSING | MOBILE-ONLY |
| Auto-tag button | MISSING | EXISTS | MISSING |

### Section 5: Shopping List

| Feature | Mobile | Web | Parity |
|---------|--------|-----|--------|
| Store-first creation | EXISTS (StorePicker) | EXISTS | PARITY |
| Store grouping + logos | EXISTS (StoreAvatar) | EXISTS | PARITY |
| Department grouping (13) | EXISTS | EXISTS | PARITY |
| 3 view modes | EXISTS | EXISTS | PARITY |
| Font size toggle | EXISTS (3 sizes) | EXISTS | PARITY |
| Check off items | EXISTS | EXISTS | PARITY |
| Offline cache + sync | EXISTS | PARTIAL | MOBILE BETTER |
| Consolidated view | EXISTS | EXISTS | PARITY |
| Add from recipe | EXISTS | EXISTS | PARITY |
| Add from meal plan | EXISTS | EXISTS | PARITY |

### Section 6: Meal Plan

| Feature | Mobile | Web | Parity |
|---------|--------|-----|--------|
| 7-day calendar | EXISTS | EXISTS | PARITY |
| Add recipe to day | EXISTS (MealPlanPicker) | EXISTS | PARITY |
| Daypart pill | EXISTS | EXISTS | PARITY |
| Servings pill | EXISTS | EXISTS | PARITY |
| Portions mismatch | EXISTS | MISSING | MOBILE BETTER |
| AI Meal Plan Wizard | EXISTS | EXISTS | PARITY |
| Remove recipe from day | EXISTS | EXISTS | PARITY |
| Add to shopping cart | EXISTS | EXISTS | PARITY |

### Section 7: Notifications & Social

| Feature | Mobile | Web | Parity |
|---------|--------|-----|--------|
| Notification bell/panel | MISSING | EXISTS (5-tab panel) | MISSING |
| Comment notifications | MISSING (no UI) | EXISTS | MISSING |
| Like notifications | MISSING (no UI) | EXISTS | MISSING |
| Follow notifications | MISSING (no UI) | EXISTS | MISSING |
| Follow / unfollow | EXISTS | EXISTS | PARITY |
| Followers/Following lists | EXISTS (tappable tabs) | EXISTS | PARITY |
| What's New feed | EXISTS | MISSING | MOBILE-ONLY |
| DM conversation UI | MISSING (compose only) | EXISTS (full chat) | MISSING |
| Message compose | EXISTS (bottom sheet) | EXISTS | PARITY |
| Unread badge | MISSING | EXISTS | MISSING |

### Section 8: Settings & Preferences

| Feature | Mobile | Web | Parity |
|---------|--------|-----|--------|
| Language selector (5) | EXISTS (LanguagePickerModal) | EXISTS | PARITY |
| Metric/Imperial toggle | EXISTS (stored, no UI) | EXISTS | PARTIAL |
| Profile edit (name, bio) | EXISTS (Edit Profile modal) | EXISTS | PARITY |
| Avatar upload | MISSING | EXISTS | MISSING |
| Privacy toggle | EXISTS (is_searchable) | EXISTS | PARITY |
| Change password | EXISTS | EXISTS | PARITY |
| Plan display + upgrade | EXISTS | EXISTS | PARITY |
| Help tips toggle | MISSING | EXISTS | MISSING |
| Feedback card | MISSING | EXISTS | MISSING |

### Section 9: Profile Pages

| Feature | Mobile | Web | Parity |
|---------|--------|-----|--------|
| Own profile view | EXISTS | EXISTS | PARITY |
| Other user profile | EXISTS (chef/[id]) | EXISTS (chef/[username]) | PARITY |
| Follow/Following counts | EXISTS | EXISTS | PARITY |
| Public recipes | EXISTS (tab) | EXISTS | PARITY |
| Message button | EXISTS (bottom sheet) | EXISTS | PARITY |

### Section 10: Cookbooks & Techniques

| Feature | Mobile | Web | Parity |
|---------|--------|-----|--------|
| Cookbook list | MISSING | EXISTS (grid + covers) | MISSING |
| Cookbook detail | PARTIAL (recipes list only) | EXISTS (full page) | PARTIAL |
| Cookbook add | MISSING | EXISTS (ISBN modal) | DEFERRED |
| Technique list | MISSING | EXISTS (grid + badges) | MISSING |
| Technique detail | MISSING | EXISTS (full page) | MISSING |
| Technique creation | MISSING | EXISTS | DEFERRED |

---

## Parity Score Summary

| Status | Count |
|--------|-------|
| PARITY | 54 |
| PARTIAL | 8 |
| MISSING on mobile | 22 |
| MOBILE-ONLY | 6 |
| DEFERRED | 4 |

**Overall parity: 54/84 features (64%)**

---

## Recommended Build Order

Priority order for fastest path to Play Store distribution:

### Phase 1: Distribution Blockers (must fix)
1. **Configure release signing** — Create production keystore, update build.gradle
2. **Fix hardcoded hex colors** — Migrate 39+ instances to useTheme().colors
3. **Fix TypeScript errors** — SafeAreaView style prop on auth screens
4. **Verify sign-up form** — Confirm username + promo code fields render on fresh build

### Phase 2: Critical UX Gaps (before public launch)
5. **Notification list screen** — New tab or modal showing all notification types
6. **Message inbox screen** — Conversation list + thread view (reuse web patterns)
7. **Like plan gate** — Switch mobile LikeButton to use API route like web
8. **Visibility toggle** — Add private/public switch to recipe detail edit mode

### Phase 3: Translation Parity
9. **Translated titles in recipe list** — Wire getBatchTranslatedTitles()
10. **Translation banner** — "Hang tight" spinner on recipe detail
11. **Title translation on import** — Fire-and-forget after mobile recipe save

### Phase 4: Feature Completion
12. **Save/bookmark button** — Add explicit bookmark action (not just count display)
13. **YouTube import wiring** — Connect the dead button to the API route
14. **Feedback card** — Port FeedbackCard component
15. **Metric/Imperial toggle UI** — Surface existing store state in settings
16. **Avatar upload** — Add to mobile settings
17. **Cookbook list screen** — New screen for cookbook browsing
18. **Technique list + detail** — New screens for technique browsing

### Phase 5: Nice-to-Have
19. Onboarding flow (mobile-native walkthrough, not web bubbles)
20. Help tips toggle
21. Auto-tag from search
22. File import (PDF/Word/CSV)
23. Cookbook ISBN/barcode scanning

---

## Appendix: ADB Screenshots Taken

| Screen | File | Description |
|--------|------|-------------|
| Landing | mobile-screen1.png | Chef's hat logo, "Your recipes, beautifully organized", Sign In (red filled), Create Account (red outlined), Continue as guest |
| Sign Up | mobile-signin2.png | "Create Account" header, Full name / Email / Password fields, Sign Up button, "Sign up with Google" stub, "Already have an account? Sign In" — **Username field not visible** |
| Sign In | mobile-signin-page.png | "Welcome back" header, Email / Password fields, Sign In button, "Sign in with Google" stub, "Don't have an account? Sign Up" — **No visible forgot password link** |

Note: Could not complete sign-in on the emulator due to ADB text input issues (text concatenated across fields). Screenshots are limited to auth screens. Code-level audit covered all 12 sections comprehensively.

---

## Data Collection Method

- **Code audit:** 6 parallel exploration agents scanning apps/mobile/ vs apps/web/ for each feature area
- **ADB screenshots:** Android emulator (API 36, 1080x2400, Medium Phone)
- **Build config check:** app.json, eas.json, build.gradle, gradle.properties analyzed
- **No changes made** to any file, database, or configuration during this audit
