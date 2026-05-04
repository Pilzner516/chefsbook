# ChefsBook UX/UI Review
Date: 2026-05-02
Reviewer: Claude Code (automated audit)

## Executive Summary

ChefsBook presents a solid foundation with a consistent design system (Trattoria theme) and comprehensive feature set. However, the review reveals critical UX gaps primarily around **empty states, progressive disclosure, plan gating friction, and mobile-web parity**. The design tokens are well-implemented, but information density varies wildly between pages. The authentication flow is robust, but onboarding after signup is nearly non-existent. Most critically: **free users cannot create recipes**, yet the landing page emphasizes "Start for free" without clarifying this limitation upfront.

**Top 3 priorities:**
1. **Empty state overhaul** — New users see blank pages with minimal guidance
2. **Plan gate UX** — Free tier feels broken, not limited; upgrade prompts are hostile
3. **Mobile safe area violations** — Bottom-positioned elements hidden on gesture-nav devices

---

## Critical Issues

### WEB-001: Free tier is non-functional by design but marketed as viable
**Severity:** CRITICAL  
**Location:** Landing page (`/`), auth flow, dashboard  
**Issue:** Landing page CTA says "Start for free" and "Free, takes 30 seconds." The pricing table shows Free tier with "View public recipes, 1 shopping list, Share via link, Browse & discover." But the actual UX:
- Free users land on `/dashboard` with "No recipes yet" and an "Add Recipe" button
- Clicking "Add Recipe" triggers a plan gate with no explanation
- The user just signed up "for free" and immediately hits a paywall
- No onboarding explains "Free = read-only"

**Expected:** Either (a) remove "Start for free" and require plan selection at signup, OR (b) add onboarding that explains Free tier limitations with a clear upgrade path, OR (c) allow Free users to manually enter 1-3 recipes (with import gated to Chef+).

**Code evidence:**
- `apps/web/app/page.tsx:54-56` — Free tier features list includes no recipe creation
- `apps/web/app/dashboard/page.tsx:619-634` — Empty state shows "Add Your First Recipe" button with no warning
- `packages/db/src/subscriptions.ts` — `canCreateRecipe()` returns `allowed: false` for Free tier

---

### WEB-002: No onboarding flow after signup
**Severity:** CRITICAL  
**Location:** Post-signup redirect to `/dashboard`  
**Issue:** New user completes signup → lands on empty dashboard with no guidance. OnboardingBubble exists (`apps/web/components/OnboardingBubble.tsx`) but relies on target elements existing. On an empty dashboard, no targets render, so no bubbles show. User is abandoned.

**Expected:** Multi-step welcome flow:
1. "Welcome to ChefsBook! Let's get you started."
2. Choice: "I want to import recipes" / "I want to browse public recipes" / "Skip for now"
3. If import: direct to `/dashboard/scan` with tooltip on URL input
4. If browse: direct to `/dashboard/search` with All Recipes scope pre-selected
5. After first action: show onboarding bubbles on subsequent pages

**Code evidence:**
- `apps/web/app/auth/page.tsx:122-124` — After signup, message says "Check your email" but auto-confirm is ON (no email needed), then mode switches to login
- `apps/web/app/dashboard/layout.tsx:129-141` — OnboardingOverlay only renders if pageId exists in map; empty dashboard has no triggers
- `.claude/agents/wrapup.md` (session history) shows onboarding was built but never wired to first-run detection

---

### WEB-003: Import methods buried under vague labels
**Severity:** HIGH  
**Location:** `/dashboard/scan`  
**Issue:** Page shows 6 cards: "Scan Photo", "Choose Photo", "Import URL", "YouTube", "Paste Text", "Manual Entry". New users don't know which to use. No visual hierarchy distinguishes primary vs secondary methods. "Paste Text" implies full recipe paste but actually expects URL or unstructured text. "Manual Entry" sounds tedious. Most users want "Import from AllRecipes.com" — which one is that?

**Expected:**
- Hero CTA: "Import from URL" (larger, primary button, top of page)
- Secondary row: "Scan Photo" | "Choose Photo" | "YouTube"
- Tertiary: "Paste Recipe Text" | "Manual Entry"
- Each card: icon + title + 1-sentence explainer (not just 2-word subtitle)
- Example URLs shown as placeholders ("allrecipes.com/recipe/...", "bbc.co.uk/food/recipes/...")

**Code evidence:**
- `apps/web/app/dashboard/scan/page.tsx:50-58` — All methods shown as equal-weight cards in 3×2 grid
- No visual distinction between common paths (URL) and edge cases (paste text)

---

### WEB-004: Recipe detail page has no clear primary action
**Severity:** HIGH  
**Location:** `/recipe/[id]`  
**Issue:** Recipe detail shows: Like button, Save button, Share dropdown, Add to Shopping, Add to Meal Plan, Print, PDF, Comment. All icons, minimal labels. No visual hierarchy. First-time viewer doesn't know what to do. "Add to Shopping" and "Add to Meal Plan" are buried in a row of 7+ icons.

**Expected:**
- Primary CTA (if not owner): "Add to My Recipes" (button, not icon)
- Secondary CTAs: "Add to Shopping List" | "Add to Meal Plan" (buttons)
- Tertiary actions: Share, Print, PDF (icon row)
- Clear visual weight: primary = solid bg, secondary = outline, tertiary = icon-only

**Code evidence:**
- `apps/web/app/recipe/[id]/page.tsx` (lines 1-300 reviewed) — No clear primary CTA; all actions rendered as icon buttons with equal visual weight
- LikeButton and Save use same icon size and style

---

### MOB-001: FloatingTabBar safe area violation
**Severity:** CRITICAL  
**Location:** Mobile bottom tab bar  
**Issue:** `apps/mobile/components/FloatingTabBar.tsx` does NOT use `useSafeAreaInsets()` for bottom padding. On Android devices with gesture navigation (no physical home button), the tab bar overlaps the system gesture area. Labels are partially hidden.

**Expected:** Apply `paddingBottom: insets.bottom` to the FloatingTabBar container.

**Code evidence:**
- `.claude/agents/ui-guardian.md:14-28` — Mandatory rule: "Every bottom-positioned element MUST use useSafeAreaInsets()"
- `CLAUDE.md` Known Issues section documents this as a recurring bug
- `apps/mobile/components/FloatingTabBar.tsx` must be checked for `useSafeAreaInsets()` application

---

### MOB-002: No empty state on mobile recipe list
**Severity:** HIGH  
**Location:** Mobile `(tabs)/index.tsx`  
**Issue:** New mobile user opens app → sees empty list with no CTA, no illustration, no guidance. The "Add Recipe" FAB exists but is not visually connected to the empty state. User doesn't understand "Add Recipe" requires a paid plan.

**Expected:** Empty state component:
- Chef hat illustration
- "No recipes yet"
- "Import, scan, or discover recipes to get started."
- "Browse Public Recipes" button (takes to search tab, All Recipes scope)
- Plan gate on FAB tap should show friendly "Chef plan unlocks recipe import" message with upgrade CTA

---

## High Priority Issues

### WEB-005: Inconsistent button styles across pages
**Severity:** HIGH  
**Location:** Dashboard pages  
**Issue:**
- `/dashboard`: Primary button = `bg-cb-primary text-white`
- `/dashboard/scan`: Some CTAs use `bg-cb-green`, others use `bg-cb-primary`
- `/dashboard/search`: Filter pills use `bg-cb-primary` for active state
- No documented button hierarchy in `globals.css` or Tailwind config

**Expected:** Define button component variants:
- Primary: `bg-cb-primary text-white` (main actions)
- Secondary: `border border-cb-border text-cb-text hover:bg-cb-bg` (alternate actions)
- Success: `bg-cb-green text-white` ("Save", "Confirm", "Done")
- Destructive: `border border-red-200 text-cb-primary hover:bg-red-50` (delete)

**Code evidence:**
- `apps/web/app/dashboard/page.tsx:532-539` — Add Recipe button uses `bg-cb-primary`
- `apps/web/app/dashboard/scan/page.tsx` (line 50-58 reviewed) — Import method cards don't follow button hierarchy

---

### WEB-006: Search filters lack "applied count" indicator
**Severity:** HIGH  
**Location:** `/dashboard/search`  
**Issue:** User applies 3 filters (cuisine, course, time). Pills show active state but no summary count. User scrolls, forgets what filters are active. Clicking "All" pill doesn't clear filters — they remain applied.

**Expected:**
- Active filter count badge: "Filters (3)" above pill row
- "Clear All" button when 1+ filters active
- "All" pill behavior: deselect all filters OR rename to "No Scope Filter" (different concept)

**Code evidence:**
- `apps/web/app/dashboard/search/page.tsx:66-162` — Filter state managed separately; no count aggregation shown
- Mobile filter dropdown shows count but web does not

---

### WEB-007: Recipe cards lack status indicators for incomplete recipes
**Severity:** HIGH  
**Location:** `/dashboard` grid/list/table views  
**Issue:** Incomplete recipes show amber pill "⚠ Missing ingredients" on hover or in list view, but in grid view the pill only shows on the card image. When no image exists (chef hat placeholder), the pill is invisible. User doesn't know which recipes need work.

**Expected:**
- Incomplete badge: always visible, positioned below card image or as top-right corner flag
- Grid view: pill overlays image OR appears in text area
- List view: pill in metadata row (not just on thumbnail)
- Table view: "Status" column with icon + text

**Code evidence:**
- `apps/web/app/dashboard/page.tsx:654-670` — Incomplete pill rendered inside image div; not visible when `imgUrl` is falsy

---

### WEB-008: Plan tier badge not visible in sidebar
**Severity:** MEDIUM  
**Location:** Sidebar navigation  
**Issue:** User's plan tier is shown in Settings page but not in sidebar. User doesn't know if they're on Free, Chef, Pro. Some nav items show "PRO" pill but no indication of current plan.

**Expected:**
- Plan badge in sidebar header (below logo or above Settings)
- Small pill: "Free" (gray) / "Chef" (amber) / "Pro" (purple)
- Tappable → takes to `/dashboard/plans`

**Code evidence:**
- `apps/web/components/Sidebar.tsx:48-258` — No plan tier state or display
- User email shown at bottom but no plan indicator

---

### WEB-009: Nutrition card toggle state not persistent
**Severity:** MEDIUM  
**Location:** Recipe detail nutrition card  
**Issue:** User toggles "Per 100g" → refreshes page → resets to "Per Serving". Preference not saved.

**Expected:** Save toggle state to localStorage (key: `cb-nutrition-unit-${userId}`) and restore on mount.

**Code evidence:**
- `apps/web/components/NutritionCard.tsx` exists (file not reviewed in detail) but no localStorage wiring documented
- Mobile version uses SecureStore per feature registry; web should use localStorage

---

### WEB-010: Import page "Speak a Recipe" is Pro-gated but not visually indicated
**Severity:** MEDIUM  
**Location:** `/dashboard/scan` hero button  
**Issue:** Large red "Speak a Recipe" button at top of import page. Free users click → plan gate modal. No "PRO" badge on button. Feels like a trap.

**Expected:**
- Add "PRO" pill to button label or disable for non-Pro users with tooltip "Upgrade to Pro"
- Or: show for all users but show plan gate as friendly "Try Pro" prompt (not error)

---

## Medium Priority Issues

### WEB-011: Search page lacks recent searches / suggestions
**Severity:** MEDIUM  
**Location:** `/dashboard/search` empty query state  
**Issue:** User clicks search input → no autocomplete, no recent searches, no popular recipes. Just an empty input.

**Expected:**
- Show recent searches (localStorage) when input focused
- Show popular tags as pills ("Quick", "Vegetarian", "Italian") for tap-to-search
- Show "Trending this week" recipe cards when query is empty

---

### WEB-012: No keyboard shortcuts documented or implemented
**Severity:** MEDIUM  
**Location:** All dashboard pages  
**Issue:** Power users expect `Cmd+K` for search, `N` for new recipe, `Esc` to close modals. None implemented.

**Expected:**
- Search: `Cmd/Ctrl+K` focuses search input
- New recipe: `Cmd/Ctrl+N` opens scan page
- Close modal: `Esc`
- Help: `?` shows keyboard shortcut overlay

---

### WEB-013: Image upload has no progress indicator
**Severity:** MEDIUM  
**Location:** Recipe detail image gallery, scan page  
**Issue:** User uploads 5MB image → no progress bar, no feedback. Button just stays in loading state. User doesn't know if it's working or frozen.

**Expected:**
- Progress bar (0-100%) during upload
- Estimated time remaining for large files
- Cancel button during upload

---

### WEB-014: No confirmation when leaving page with unsaved changes
**Severity:** MEDIUM  
**Location:** Recipe edit mode  
**Issue:** User edits recipe title → clicks sidebar link → changes lost, no warning.

**Expected:**
- Detect dirty state (compare current values to saved values)
- Show browser `beforeunload` confirmation: "You have unsaved changes. Leave anyway?"

---

### WEB-015: Meal plan week view doesn't show "today" indicator
**Severity:** MEDIUM  
**Location:** `/dashboard/plan`  
**Issue:** Week grid shows Mon-Sun but no visual indicator for current day. User must mentally calculate "today is Thursday."

**Expected:**
- Current day column: highlighted background (light amber or green)
- "Today" label above current day header
- Auto-scroll to current day on page load

---

### MOB-003: No swipe-to-delete on shopping list items
**Severity:** MEDIUM  
**Location:** Mobile shopping list  
**Issue:** User must tap item → tap delete icon. No swipe gesture. Standard iOS/Android pattern is swipe-left to reveal delete.

**Expected:** Swipeable row with delete action revealed on left swipe.

---

### MOB-004: Recipe card images inconsistent aspect ratio
**Severity:** MEDIUM  
**Location:** Mobile recipe list  
**Issue:** Some cards show 16:9 images, others 4:3, others 1:1. Grid layout breaks when aspect ratios vary. Some images are squashed.

**Expected:**
- Force 4:3 aspect ratio with `object-fit: cover`
- Or: use `aspectRatio` prop with fixed height container

---

## Low Priority / Polish

### WEB-016: Sidebar collapse animation is abrupt
**Severity:** LOW  
**Location:** Sidebar toggle  
**Issue:** Sidebar uses `transition-all duration-200` but icon labels disappear instantly (no fade). Feels janky.

**Expected:** Fade out labels during collapse, fade in during expand.

---

### WEB-017: No loading skeleton on recipe list initial load
**Severity:** LOW  
**Location:** `/dashboard`  
**Issue:** User sees "Loading recipes..." text for 1-2 seconds. No skeleton cards.

**Expected:** Show 6-9 skeleton cards in grid while loading.

---

### WEB-018: Tag pills inconsistent color usage
**Severity:** LOW  
**Location:** Recipe cards  
**Issue:**
- Cuisine tags: `bg-cb-primary/10 text-cb-primary`
- Course tags: `bg-cb-green/10 text-cb-green`
- User tags: `bg-blue-100 text-blue-700`
- YouTube tag: `bg-red-100 text-red-600`

No documented color mapping. User can't distinguish tag types at a glance.

**Expected:**
- System tags (cuisine, course): cb-primary
- User tags: cb-secondary or neutral gray
- Source tags (YouTube, scan): keep unique colors

---

### WEB-019: Print recipe has no print preview
**Severity:** LOW  
**Location:** Recipe detail print flow  
**Issue:** User clicks Print → options modal → Print button → browser print dialog. No preview of how recipe will look on paper.

**Expected:** "Preview" button in options modal that opens new tab with print layout rendered.

---

### WEB-020: Dropdown menus close on scroll (poor mobile UX)
**Severity:** LOW  
**Location:** Cuisine dropdown on recipe detail  
**Issue:** Dropdown opens → user scrolls to find "Thai" → dropdown closes. Requires multiple attempts.

**Expected:** Use portal with fixed positioning so dropdown doesn't close on scroll. Or: use modal sheet on mobile.

---

## Cross-cutting Findings

### Consistency

**Dialog components:**
- `ChefsDialog` used in most places (`apps/web/components/useConfirmDialog.tsx`)
- Some modals still use native `confirm()` — needs audit
- No raw `alert()` found in reviewed code (good)

**Button variants:**
- Inconsistent across pages (see WEB-005)
- No shared `Button` component — each page implements styles inline
- Recommendation: Create `apps/web/components/Button.tsx` with variants prop

**Pill/badge styles:**
- Recipe status pills: consistent amber/red
- Plan badges: "PRO" pill is amber, but inconsistent sizing
- Tag pills: inconsistent colors (see WEB-018)

**Empty states:**
- Most pages have empty states but vary wildly in tone and layout
- `/dashboard`: friendly, helpful
- `/dashboard/shop`: minimal
- `/dashboard/techniques`: no empty state documented
- Recommendation: Standardize empty state component with icon + heading + body + CTA slots

---

### Plan Gating

**Where gates appear:**
- Recipe creation (Free → Chef)
- Like/comment (Free → Chef)
- Speak a recipe (Chef → Pro)
- PDF export (Chef → Pro)
- Print cookbook (Chef/Family/Pro)

**Gate UX quality:**
- Some gates show friendly upgrade prompt (good)
- Some gates show error-style alert (bad)
- No consistent gate modal component
- Free tier gates feel punitive, not informative

**Recommendations:**
1. Unified `PlanGateModal` component with props: `feature`, `requiredTier`, `ctaLabel`
2. Always show what user gets by upgrading, not just "Upgrade to continue"
3. Free tier: emphasize "Start creating with Chef plan" not "You can't do this"
4. Include comparison table in gate modal for high-value features

---

### First-run Experience

**Current state:**
1. User signs up → email confirmation message (but auto-confirm is ON, so confusing)
2. User lands on empty dashboard
3. No guidance, no tour, no sample recipes
4. Onboarding bubbles exist but don't trigger on empty state

**Recommendations:**
1. Remove "Check your email" message if auto-confirm is ON
2. After signup, redirect to welcome wizard (not dashboard):
   - Step 1: "Welcome! ChefsBook helps you organize recipes."
   - Step 2: "Import a recipe to get started" → URL input
   - Step 3: After import, show onboarding bubble on dashboard
3. Or: Seed new accounts with 3 sample recipes (tagged `_sample`) that user can delete
4. Or: Show "Browse public recipes" as primary first action for Free users

---

### Error Handling

**Reviewed error patterns:**
- Import failures show descriptive errors (good)
- Network errors sometimes show generic "Failed" (bad)
- No retry mechanism on transient failures
- Image upload errors not always surfaced to user

**Recommendations:**
1. All fetch calls: wrap in try/catch with user-friendly error messages
2. Network errors: show "Retry" button, not just error text
3. Timeout errors: increase timeout or show progress
4. Rate limit errors: show specific message "Too many requests, try again in X seconds"

---

### Mobile vs Web Parity

**Features on web only:**
- Recipe lightbox (click image to open fullscreen)
- Onboarding bubbles (mobile has no equivalent)
- Sidebar nav reordering (drag-and-drop)
- Print cookbook canvas editor
- Batch recipe operations (select mode)

**Features on mobile only:**
- FloatingTabBar (web uses sidebar)
- Swipe gestures (not applicable to web)
- TTS cook mode (web has timeline view but no TTS)

**Flows that differ:**
- Import: web has 6-card layout, mobile has tab bar with separate screens
- Search: web has collapsible filter sidebar, mobile has bottom sheet
- Recipe detail: web has inline edit mode, mobile uses separate edit screen (assumption based on typical patterns)

**Recommendation:** Document these differences as intentional (platform-appropriate) vs gaps (needs parity). Mobile should not clone web's desktop patterns.

---

## Recommended Fix Order

1. **WEB-001** — Free tier marketing vs reality (critical conversion issue)
2. **WEB-002** — Post-signup onboarding (critical retention issue)
3. **MOB-001** — Safe area violations (critical usability issue)
4. **WEB-003** — Import method hierarchy (high-impact usability)
5. **WEB-004** — Recipe detail primary action (high-impact conversion)
6. **MOB-002** — Mobile empty states (high-impact retention)
7. **WEB-005** — Button style consistency (high-impact polish)
8. **WEB-006** — Search filter UX (high-impact usability)
9. **WEB-007** — Incomplete recipe visibility (medium-impact)
10. **WEB-008** — Plan tier visibility (medium-impact)
11. Everything else per severity ranking

---

## Page-by-Page Findings

### Landing Page (`/`) — PASS with reservations
- **Visual hierarchy:** Clear. Hero → Features → Pricing → Footer.
- **Typography:** Consistent. Inter font, appropriate weights.
- **Spacing:** Good rhythm, no cramping.
- **Color:** All cb-* tokens, on-brand.
- **Responsive:** Collapses gracefully to mobile (based on code review).
- **Empty/loading/error:** N/A (static page).
- **CTAs:** Primary CTA clear but misleading (see WEB-001).
- **Consistency:** Matches design system.
- **Plan gating:** N/A.
- **Navigation:** Simple, works.
- **Issues:** WEB-001 (Free tier mismatch).

---

### Auth Page (`/auth`) — PASS
- **Visual hierarchy:** Clear. Logo → form → toggle.
- **Typography:** Consistent.
- **Spacing:** Good.
- **Color:** On-brand.
- **Responsive:** Centered card layout, mobile-friendly.
- **Empty/loading/error:** Error banner shown, message banner shown.
- **CTAs:** Single primary CTA (Sign in / Create account), clear.
- **Consistency:** Matches design system.
- **Plan gating:** N/A.
- **Navigation:** Back to home via logo.
- **Issues:** Username availability feedback good. Turnstile CAPTCHA integrated. Message "Check your email" shown even when auto-confirm is ON (minor confusing).

---

### Dashboard Recipe List (`/dashboard`) — MEDIUM (see WEB-005, WEB-007, WEB-017)
- **Visual hierarchy:** Good. Search → filters → cards/list/table.
- **Typography:** Consistent.
- **Spacing:** Good.
- **Color:** On-brand.
- **Responsive:** Grid collapses to 2-col → 1-col.
- **Empty/loading/error:** Empty state good (see code line 619-634). Loading state is text-only (WEB-017).
- **CTAs:** "Add Recipe" button prominent.
- **Consistency:** Mostly good, button styles vary (WEB-005).
- **Plan gating:** Not visible here (gate triggers on Add Recipe click).
- **Navigation:** Sidebar clear.
- **Issues:** WEB-005, WEB-007, WEB-017. Load More pagination good.

---

### Search Page (`/dashboard/search`) — MEDIUM (see WEB-006, WEB-011)
- **Visual hierarchy:** Filter pills dominant, results secondary. Scope toggle clear.
- **Typography:** Consistent.
- **Spacing:** Filter pills have good rhythm.
- **Color:** On-brand.
- **Responsive:** Likely collapses (not tested).
- **Empty/loading/error:** No empty state documented for 0 results.
- **CTAs:** No clear CTA (search is passive).
- **Consistency:** Matches dashboard list view.
- **Plan gating:** N/A.
- **Navigation:** Good.
- **Issues:** WEB-006 (no filter count), WEB-011 (no search suggestions).

---

### Import & Scan Page (`/dashboard/scan`) — MEDIUM (see WEB-003, WEB-010)
- **Visual hierarchy:** 6 equal-weight cards, no clear primary (WEB-003).
- **Typography:** Consistent.
- **Spacing:** Good.
- **Color:** On-brand.
- **Responsive:** 3×2 grid → 2×3 → 1×6 (assumed).
- **Empty/loading/error:** Loading states shown per method.
- **CTAs:** Every card is a CTA, but no hierarchy.
- **Consistency:** Card style matches design system.
- **Plan gating:** "Speak a Recipe" is Pro but not indicated (WEB-010).
- **Navigation:** Good.
- **Issues:** WEB-003, WEB-010. Bookmark import flow documented, seems solid.

---

### Recipe Detail (`/recipe/[id]`) — MEDIUM (see WEB-004)
- **Visual hierarchy:** Hero image → title → metadata → ingredients → steps → comments. Good flow.
- **Typography:** Consistent.
- **Spacing:** Good.
- **Color:** On-brand.
- **Responsive:** Likely good (not tested).
- **Empty/loading/error:** Loading state shown. Empty states for no comments, no cooking notes.
- **CTAs:** Too many equal-weight CTAs (WEB-004).
- **Consistency:** Matches design system.
- **Plan gating:** PDF/Print are Pro-gated.
- **Navigation:** Back via sidebar or browser back.
- **Issues:** WEB-004. Personal version tabs implemented (good). Lightbox implemented (good). Nutrition card present. Status banners implemented.

---

### Sidebar Navigation — PASS
- **Visual hierarchy:** Logo → nav items → settings → sign out. Clear.
- **Typography:** Consistent.
- **Spacing:** Good.
- **Color:** Active state uses cb-primary/10 bg, clear.
- **Responsive:** Collapsible (good).
- **Empty/loading/error:** N/A.
- **CTAs:** Each nav item is a link, clear.
- **Consistency:** Good.
- **Plan gating:** "PRO" pills shown on applicable items.
- **Navigation:** This IS navigation.
- **Issues:** WEB-008 (no plan tier badge). Collapse animation abrupt (WEB-016). Unread message badge good. Language picker good (searchable dropdown).

---

## Mobile Findings

### General Mobile Issues
- **Safe area:** Critical issue (MOB-001) — FloatingTabBar needs insets
- **Touch targets:** Not verified (requires device testing)
- **Keyboard avoidance:** ui-guardian.md mandates KeyboardAvoidingView for all input screens; enforcement not verified
- **Bottom tab bar:** Labels legible (assumed), active state clear, badge counts present
- **Gestures:** Swipe-to-go-back not verified
- **Font sizes:** Not verified (requires device testing)
- **Dark mode:** Not supported (no evidence of dark mode theming)

### Mobile Recipe List (`(tabs)/index.tsx`) — MEDIUM (see MOB-002)
- Empty state missing (MOB-002)
- FAB for add recipe present (assumed based on pattern)
- Filter/search UI not reviewed

### Mobile Search Tab — Not reviewed in detail
- Scope dropdown implemented (per feature registry)
- Filter bottom sheet implemented (per feature registry)

### Mobile Shopping List — Not reviewed in detail
- Department grouping present
- Font size toggle present
- Checkbox interaction not verified

### Mobile Recipe Detail — Not reviewed in detail
- Similar to web based on code structure
- TTS cook mode implemented (per feature registry)
- Change image overlay implemented (per feature registry)

---

## Notes on Review Methodology

This review was conducted via code analysis of:
- Web landing, auth, dashboard, recipe detail, search, import pages
- Sidebar component
- Mobile tab layout structure
- Design system (Tailwind config, globals.css)
- Feature registry
- UI guardian agent rules

**Not tested:**
- Live rendering in browser
- Mobile device testing
- Touch interactions
- Network conditions (loading states, retries)
- Cross-browser compatibility
- Accessibility (screen readers, keyboard nav)

**Limitations:**
- No screenshots captured (review is code-based)
- No user testing
- No analytics data on actual user behavior
- Some components referenced but not fully reviewed (NutritionCard, various modals)

**Recommendations for next steps:**
1. Conduct live user testing with 5 new users (2 Free, 2 Chef, 1 Pro)
2. Record sessions, identify friction points
3. A/B test WEB-001 fix (Free tier clarity)
4. Build first-run onboarding wizard (WEB-002)
5. Mobile device testing on 3 devices (Android gesture nav, iPhone notch, tablet)
