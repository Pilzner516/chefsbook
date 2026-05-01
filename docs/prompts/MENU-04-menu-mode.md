# Prompt: ChefsBook Menus — Menu Mode (Cook a Menu, Mobile + Web)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/MENU-04-menu-mode.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — MOBILE (primary) + WEB (secondary)

## Prerequisites

Sessions MENU-01 and MENU-02 must be complete. Confirm in DONE.md:
- `menus` and `menu_items` tables exist with data
- My Menus list + detail screens exist on both web and mobile
- `MenuWithItems` type is available from `packages/db/src/types/menus.ts`

---

## Overview

**Menu Mode** is a full-screen guided cooking experience that lets a user cook through
an entire menu — course by course — with a timeline view showing what to prepare across
all dishes simultaneously.

It is accessed from the Menu detail screen (web and mobile) via a
**"Start Cooking"** button. On mobile it is a full-screen immersive mode.
On web it is a wide-panel layout within the dashboard.

**Available to:** All authenticated users who have a menu.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/deployment.md`
- `.claude/agents/ai-cost.md`
- `.claude/agents/navigator.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read `apps/mobile/app/menu/[id].tsx` — confirm the "Start Cooking" button entry point
2. Read `packages/db/src/types/menus.ts` — understand `MenuWithItems` and `COURSE_ORDER`
3. Read `packages/db/src/queries/menus.ts` — confirm `getMenu(menuId)` returns full recipe data
   including `prep_time` and `cook_time` per recipe
4. Check if a recipe step-by-step cooking mode already exists on mobile (step navigator pattern)
   — reuse any existing step rendering components
5. Run `\d recipes` on RPi5 — confirm `prep_time`, `cook_time`, `servings` column names
6. Run `\d menu_items` on RPi5 — confirm column names

---

## Concepts

### Timeline calculation

For a given menu, the system calculates a **prep timeline** by working backwards from a
target serve time (set by the user, optional) or simply showing relative offsets.

Each recipe has:
- `prep_time` (minutes) — active hands-on work
- `cook_time` (minutes) — passive time (oven, simmer, rest)
- `total_time` = `prep_time + cook_time`

The timeline identifies:
- Which recipes can be prepped in parallel (e.g. dessert can be prepped while main is cooking)
- What the critical path is (longest sequence of dependent steps)
- When to start each recipe to serve all courses at intended times

For V1, use a simplified model:
- Calculate `total_time` per recipe
- Sort by `total_time` descending — longest first in the timeline
- Show a linear Gantt-style view with bars representing each recipe's total time
- Annotate when prep starts and when the dish is ready

This does not need AI — it is pure arithmetic on `prep_time` and `cook_time`.
If those fields are null for a recipe, show the recipe in the timeline without a time bar.

---

## Mobile — Menu Mode screen

Route: `apps/mobile/app/menu/[id]/cook.tsx`

Add as a stack screen. Accessible from the Menu detail screen via `"Start Cooking"` button.

### Screen structure

The screen has two modes toggled by a segmented control at the top:
**Timeline** | **Step by Step**

---

### Timeline view (default)

**Header:**
- Menu title
- `"Timeline"` | `"Step by Step"` segmented control
- Optional: `"Serve at:"` time picker (shows a time picker — sets the target meal time;
  when set, timeline shows "Start at HH:MM" labels on each recipe bar)

**Timeline body:**
A scrollable vertical list. Each recipe gets a row:

```
[Recipe image, 48×48, rounded]  [Recipe title]          [Start 45 min before]
                                 [Prep: 15m | Cook: 30m]
                                 [████████████████░░░░]   ← time bar
                                    prep ████  cook ░░░░
```

- Time bar: coloured block representing `prep_time` (accent red) + `cook_time` (soft amber)
- Recipes sorted by `total_time` descending (most time-consuming first)
- Tap a recipe row → expands to show ingredient list and first 3 steps inline
- `"Go to recipe"` link → navigates to full recipe detail

**Colour coding:**
- Use `useTheme().colors` — never hardcode hex
- Prep segment: `colors.accent` (red)
- Cook segment: `colors.accentSoft` or amber-ish secondary
- If recipe has no time data: grey bar with `"No time estimate"`

**"All prepped?"** section at the bottom:
- A checklist of all recipes with a checkbox: `"[Recipe name] — ready"`
- When all checked: shows `"You're ready to plate! 🍽"` message

---

### Step by Step view

A sequential card-based flow through ALL steps of ALL recipes in the menu, organised
by course order (`COURSE_ORDER`).

**Navigation:**
- Previous / Next buttons (bottom of screen, above safe area)
- Progress indicator: `"Step 3 of 24"` or `"Starter — Step 2 of 6"`
- Course divider cards between courses:
  - Full-width card: `"🥗 Now starting: Main Course"`

**Each step card:**
- Recipe title (small, grey, above step)
- Step number within that recipe: `"Step 2 of 5"`
- Step instruction (large text, readable)
- Timer button (if step has an implied time — look for numbers followed by "minutes",
  "hours", "seconds" in the step text and offer a one-tap timer)
- Ingredient amounts for this step (if the recipe data groups ingredients by step —
  otherwise omit)

**Swipe navigation:**
- Swipe left → next step
- Swipe right → previous step
- (Same pattern as existing recipe step-through if one exists in the codebase)

**Exit button:**
- Top left X — confirms exit with `useConfirmDialog` (`"Exit cooking mode?"`)

---

### Keep screen awake

On mobile, use `expo-keep-awake` to prevent screen sleep during Menu Mode.
Call `activateKeepAwakeAsync()` on mount, `deactivateKeepAwakeAsync()` on unmount.
Check if `expo-keep-awake` is already in `apps/mobile/package.json` before adding.

---

## Web — Menu Mode panel

On the web Menu detail page (`/dashboard/menus/[id]`), add a **"Start Cooking"** button
in the action row. Clicking it opens a full-width panel/drawer that slides in from the
right (or replaces the main content area on narrow viewports).

The web version only needs to implement the **Timeline view** for now.
Step by Step on web is deferred — note in AGENDA.md.

**Web timeline layout:**
- Two-column grid: recipes on the left, timeline bars on the right
- Same logic as mobile timeline — sorted by total_time descending
- Uses `cb-*` Tailwind tokens for colours
- Close button returns to the Menu detail view

---

## AI-generated prep summary (optional, if time allows)

If time allows in this session, add a one-tap **"Get Prep Tips"** button in the
Timeline view header. This calls Claude (Haiku — low cost) with the full menu
recipe list and asks for:

```
Given these dishes and their timings, give me 3–5 practical tips for timing
this meal efficiently. Keep it concise — one sentence per tip.
```

Display the response in a scrollable card below the timeline header.
Log to `ai_usage_log` with action `'menu_prep_tips'`.

If this would push the session scope too far, skip it and add to AGENDA.md.

---

## i18n

Add to `menus` namespace in both locale files:

```json
{
  "menus": {
    "start_cooking": "Start Cooking",
    "timeline": "Timeline",
    "step_by_step": "Step by Step",
    "serve_at": "Serve at",
    "start_before": "Start {{minutes}} min before",
    "prep_label": "Prep",
    "cook_label": "Cook",
    "no_time_estimate": "No time estimate",
    "all_prepped": "You're ready to plate!",
    "exit_cooking": "Exit cooking mode?",
    "step_of": "Step {{current}} of {{total}}",
    "now_starting_course": "Now starting: {{course}}",
    "get_prep_tips": "Get Prep Tips"
  }
}
```

---

## TypeScript

Run `npx tsc --noEmit` in both apps before wrapup. Zero errors required.

---

## Testing

### Mobile
- "Start Cooking" button visible on menu detail screen ✓
- Timeline view renders all recipes sorted by total_time descending ✓
- Recipes with no time data show grey bar + "No time estimate" ✓
- Tap recipe row → expands with ingredients + first steps ✓
- "Serve at" time picker → start labels update on bars ✓
- All prepped checklist → check all → completion message ✓
- Switch to Step by Step view ✓
- Steps render across all courses in COURSE_ORDER ✓
- Course divider cards appear between courses ✓
- Swipe navigation between steps ✓
- Timer button appears for steps with time references ✓
- Screen stays awake (expo-keep-awake active) ✓
- Exit button → confirm dialog → returns to menu detail ✓
- Safe area applied — Next/Prev buttons not hidden behind home indicator ✓

### Web
- "Start Cooking" button visible on menu detail page ✓
- Timeline panel opens ✓
- Recipes render with time bars ✓
- Close button returns to menu detail ✓

### psql verification (no schema changes in this session — verify existing data only)
```sql
SELECT r.title, r.prep_time, r.cook_time
FROM menu_items mi
JOIN recipes r ON r.id = mi.recipe_id
WHERE mi.menu_id = '<test_menu_id>'
ORDER BY (COALESCE(r.prep_time,0) + COALESCE(r.cook_time,0)) DESC;
```

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5.
Build a staging APK for mobile verification via ADB.
Run regression smoke test from `testing.md` before wrapup.

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md record:
- Menu Mode shipped on mobile (Timeline + Step by Step views)
- Menu Mode Timeline shipped on web
- `expo-keep-awake` wired in Menu Mode
- Web Step by Step deferred (if applicable)

In feature-registry.md update:
- `menu-mode-mobile` — status: COMPLETE
- `menu-mode-web-timeline` — status: COMPLETE
- `menu-mode-web-step-by-step` — status: DEFERRED (if deferred)

In AGENDA.md confirm next session is `MENU-05-menus-to-books.md`.
