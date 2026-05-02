# Prompt: ChefsBook — Full UX/UI/Design Review

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/ux-review.md fully and autonomously. This is a read-only audit — do not modify any application code, database, or config files. Produce a structured report and save it to docs/ux-review-findings.md. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: AUDIT — READ-ONLY. NO CODE CHANGES.

This session produces a report only. Zero application code is written or modified.
The only file created is `docs/ux-review-findings.md`.

---

## Agent files to read — ALL of these, in order, before starting

- `.claude/agents/wrapup.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/feature-registry.md`

Do NOT read deployment.md, testing.md, or any other agent — this is not a build session.
Do NOT run tsc, builds, or migrations.

---

## Reviewer role

You are a senior product designer and UX engineer conducting a pre-launch audit of
ChefsBook (chefsbk.app), a multi-tenant SaaS recipe app. You are looking for real
problems — things that would cause a new user to be confused, frustrated, or to churn.

Be direct and specific. Do not soften findings. Rate each issue by severity:

- **CRITICAL** — Broken, inaccessible, or completely confusing. Blocks the user.
- **HIGH** — Noticeably bad UX that hurts trust or conversion. Should fix before launch.
- **MEDIUM** — Friction or inconsistency that accumulates. Fix in next sprint.
- **LOW** — Polish items. Nice to fix, not urgent.
- **PASS** — No issues found.

---

## Pre-flight: before reviewing any page

1. Read `apps/web/CLAUDE.md` if it exists — understand web-specific conventions
2. Grep for `cb-` Tailwind tokens in `apps/web/tailwind.config.*` — understand the
   design token system before evaluating color usage
3. Read `apps/web/app/globals.css` — note any global typography or spacing rules
4. Read `apps/mobile/app/(tabs)/_layout.tsx` — confirm tab structure and order
5. Note the plan tiers: Free (no recipe creation), Chef, Family, Pro
6. Note: `ChefsDialog` is the unified dialog component for web + mobile —
   any native `alert()` or `confirm()` is a known bug

---

## Web pages to review

Browse each page on chefsbk.app using the browser tool. For pages that require auth,
use the admin account credentials from CLAUDE.md. For each page, evaluate:

### Evaluation criteria (apply to every page)

- **Visual hierarchy**: Is it immediately clear what this page is for and what to do?
- **Typography**: Consistent font sizes, weights, line heights? Headers distinguishable?
- **Spacing**: Consistent padding/margin rhythm? Anything cramped or overflowing?
- **Color**: Consistent use of cb-* design tokens? Any raw hex or off-brand colors?
- **Responsive layout**: Does it hold together at 375px (mobile viewport)?
- **Empty states**: What does a new user with no data see? Is it helpful or just blank?
- **Loading states**: Are there skeletons or spinners? Or does content pop in jarringly?
- **Error states**: What happens when something fails? Is the error shown clearly?
- **CTAs**: Are primary actions visually distinct? Is there ever more than one primary CTA competing?
- **Consistency**: Do buttons, pills, dialogs, and cards look the same across pages?
- **Plan gating**: Is the upgrade prompt clear, non-hostile, and placed at the right moment?
- **Navigation**: Is it obvious where you are and how to get back?

### Page list

#### Public / unauthenticated

1. **Landing page** — `/`
   - Does the headline and sub-headline immediately communicate what ChefsBook is?
   - Is the primary CTA prominent?
   - Does the feature section actually show the value, or just list words?
   - Social proof: is there any? Should there be?
   - Mobile: does the hero collapse gracefully?

2. **Auth page** — `/auth`
   - Sign in vs sign up: is it clear which mode you're in?
   - Error messages: are they human-readable?
   - Is there a "forgot password" link?
   - Does the form work on mobile keyboard-up?

3. **Public recipe detail** — `/recipe/[id]` (pick any public recipe)
   - First impression: does the recipe look appetizing and trustworthy?
   - Attribution row (submitter, source, modifier pills): is it legible and not cluttered?
   - Ingredients and steps: scannable while cooking?
   - Save button: visible to logged-out users? What happens when they click it?
   - Is the nutrition card integrated cleanly or does it feel tacked on?

4. **Public chef profile** — `/chef/[id]`
   - Does the profile communicate who this person is?
   - Recipe grid: does it feel like a browsable collection?
   - Follow button: clear call to action?

5. **Public menu** — `/menu/[id]` (find a public menu if one exists)
   - Is the course structure legible?
   - Is it obvious this is a shareable menu?

6. **Plans/pricing page** — `/plans`
   - Is the pricing table scannable?
   - Feature comparison: are the right features highlighted for conversion?
   - CTA per plan: clear and distinct?
   - Free tier limitations: are they honest without being scary?

#### Authenticated — Dashboard

7. **My Recipes (dashboard)** — `/dashboard`
   - First-run empty state: what does a brand new Chef user see?
   - Recipe cards: image, title, tags — is the information density right?
   - Filters and search: do they work together intuitively?
   - "Load More" pagination: does the button feel natural or abrupt?
   - Incomplete recipe badge: is it noticeable without being alarming?
   - Add recipe button: always visible?
   - Sidebar navigation: clear labels and icons?

8. **My Menus** — `/dashboard/menus`
   - List of menus: scannable?
   - Create menu flow: frictionless?
   - Menu detail (`/dashboard/menus/[id]`): course sections clear?
   - Recipe picker modal: easy to find the right recipe?

9. **Meal Plan** — `/dashboard/plan`
   - Week grid: orientation clear (which day is today)?
   - Adding a recipe to a day: intuitive?
   - Servings mismatch warning: noticeable but not intrusive?
   - Empty days: helpful prompt or just empty cells?

10. **Shopping List** — `/dashboard/shop`
    - Department grouping: logical ordering?
    - Checkboxes: do checked items feel satisfying to tick off?
    - Combined list view vs individual list: is the toggle obvious?
    - Print layout: trigger it and confirm it looks clean

11. **Import & Scan** — `/dashboard/scan`
    - URL import: is the input prominent? Placeholder text helpful?
    - After import: does the user land in the right place?
    - Speak a recipe: is the microphone UX intuitive?
    - Instagram import: is the flow distinct from URL import?
    - Extension prompt: is it shown at the right moment?

12. **Print Cookbook builder** — `/dashboard/print-cookbook`
    - List of cookbooks: clear overview?
    - Create new cookbook: flow obvious?
    - Cookbook editor (`/dashboard/print-cookbook/[id]`):
      - Template picker: are the templates visually distinguishable?
      - Page size selector: clear labels?
      - Recipe picker: easy to add/remove/reorder recipes?
      - Fill zones: is the concept of a fill zone explained at all?
      - Flipbook preview: does it load and scale correctly?
      - "Order Print" CTA: prominent? Does it communicate cost clearly?

13. **Recipe detail (owned recipe)** — `/recipe/[id]` logged in as owner
    - Edit mode: how do you enter it? Obvious?
    - Version switcher (if personal versions built): clear Original/V1/V2 tabs?
    - Ask Sous Chef button: visible and clearly placed?
    - Delete: is the irreversible action gated by a confirmation dialog?
    - Re-import: is the button labeled clearly?

---

## Mobile screens to review

Connect to the Android emulator via ADB and review these screens.
Use the navigator agent at `.claude/agents/navigator.md` for ADB commands.
Capture ADB screenshots for each screen and include them (as file references) in findings.

### Mobile evaluation criteria (in addition to the web criteria above)

- **Safe area**: Are all bottom elements clear of the home indicator bar?
- **Touch targets**: Are tappable elements at least 44×44pt?
- **Keyboard avoidance**: Does the keyboard cover input fields?
- **Bottom tab bar**: Labels legible? Active state clear? Badge counts visible?
- **Gestures**: Does swipe-to-go-back work on all screens?
- **Font sizes**: Readable without zooming?
- **Dark mode** (if supported): Does anything look broken?

### Screen list

1. **Recipe list (Home tab)**
   - Empty state for new user
   - Recipe card image, title, tag density
   - Filter/search UX
   - FAB or add button visibility

2. **Search tab**
   - Filter collapse: active filter summary bar
   - Cuisine, dietary, calorie filters: accessible?
   - Results grid: image quality and card spacing

3. **Menus tab**
   - List of menus
   - Create menu modal: safe area on sheet bottom
   - Menu detail: course sections, recipe picker

4. **Meal Plan tab**
   - Week grid layout on mobile viewport
   - Day tap → recipe add flow
   - Servings mismatch warning dialog

5. **Shopping List tab**
   - Department grouping
   - Checkbox interaction feel
   - New item input: keyboard avoidance

6. **Recipe detail screen** — `/recipe/[id]`
   - Header image: aspect ratio correct?
   - Attribution row: modifier pills visible?
   - Ingredients: fraction formatting
   - Steps: numbered, scannable
   - Version switcher tabs (if personal versions built)
   - Ask Sous Chef button placement
   - Nutrition card: toggle works?

7. **Chef profile screen** — `/chef/[id]`
   - Follow button placement
   - Recipe grid

8. **Settings modal**
   - Plan badge visible?
   - Language selector: 5 supported languages only?
   - Metric/imperial toggle

9. **Notifications bell**
   - Badge count visible on tab bar
   - Notification list: readable, tappable

10. **Messages/inbox**
    - Conversation list
    - Thread view: keyboard avoidance
    - Admin reply thread (if applicable)

---

## Cross-cutting review areas

After reviewing individual pages, evaluate these themes across the whole product:

### 1. Consistency audit
- Do all modals use `ChefsDialog`? Flag any raw browser `alert()` or `confirm()`.
- Are button variants consistent? (Primary, secondary, destructive, text/link)
- Are pill/badge styles consistent? (Tags, plan badges, status badges, modifier pills)
- Are empty states consistent in tone and layout?

### 2. Plan gating UX
- Is the upgrade prompt shown at the right moment — when the user tries to do something?
- Is the free tier experience coherent, or does it feel like a crippled product?
- Is the Chef plan clearly the recommended starting plan?
- Is the pricing page linked from gate prompts?

### 3. First-run experience
- What happens immediately after signup?
- Is there any onboarding, tooltip, or guidance?
- Can a new user get a recipe into their collection within 60 seconds?

### 4. Error handling UX
- Submit a recipe URL that will fail — what does the user see?
- Trigger a plan gate — is the dialog friendly?
- Log out mid-session — does the app recover gracefully?

### 5. Mobile vs web parity
- List any features that exist on web but not mobile, or vice versa.
- Note any flows that work differently between platforms.

---

## Output format

Save findings to `docs/ux-review-findings.md` using this structure:

```markdown
# ChefsBook UX/UI Review
Date: [today]
Reviewer: Claude Code (automated audit)

## Executive Summary
[3-5 sentence overview of overall quality and top priorities]

## Critical Issues
[List — fix before launch]

## High Priority Issues
[List — fix this sprint]

## Medium Priority Issues
[List — fix next sprint]

## Low Priority / Polish
[List]

## Page-by-Page Findings

### [Page name] — [PASS / issues found]
[Finding per page]

## Mobile Findings

### [Screen name] — [PASS / issues found]
[Finding per screen]

## Cross-cutting Findings

### Consistency
### Plan Gating
### First-run Experience
### Error Handling
### Mobile vs Web Parity

## Recommended Fix Order
[Numbered list — highest impact first]
```

---

## Constraints

- **Read-only**: Do not modify any file except creating `docs/ux-review-findings.md`
- **No assumptions**: If a page is broken or inaccessible, log it as CRITICAL — don't try to fix it
- **Be honest**: This review is for internal use. Diplomatic softening is not helpful.
- **Include specifics**: "The button is hard to find" is not useful. "The Add Recipe button
  is below the fold on a 1280px viewport and has no fixed/sticky positioning" is useful.
- **No wrapup session needed**: This is audit-only. Do not update DONE.md or feature-registry.md.
