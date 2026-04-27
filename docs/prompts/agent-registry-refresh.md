# Prompt: Agent & Feature Registry Refresh — Phase 2 Readiness Audit

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/agent-registry-refresh.md fully and autonomously. This session produces NO production code changes. Its only output is updated agent files. Work through every section in order. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: MAINTENANCE — NO CODE CHANGES TO PRODUCTION FILES

This session touches ONLY files inside `.claude/agents/`. No changes to `apps/`, `packages/`, or `supabase/`.

---

## Purpose

ChefsBook has completed 200+ development sessions. The codebase is feature-complete for Phase 1. Agent files were written early and have not kept pace with what was actually built. The result is agents making wrong assumptions, skipping tests, and breaking working features (see: NUTRITION-FIX regression).

This session audits every agent file against the current codebase reality and rewrites them to reflect what actually exists today.

---

## Ground rules for this session

- Do NOT change any production files
- Do NOT run deployments
- Do NOT run builds
- Read DONE.md fully before touching any agent file — it is the source of truth for what was built
- Read the actual source files in apps/ and packages/ to verify current reality
- Where DONE.md and source files conflict, trust the source files
- Every agent update must be based on what the code actually does, not what you expect it to do

---

## Step 1 — Read context files

Read all of these before writing anything:

1. `CLAUDE.md` — full file
2. `DONE.md` — full file (5000+ lines — read it all; it contains every session's output)
3. `AGENDA.md` — understand what is coming next
4. All current agent files in `.claude/agents/` — read every one before editing any

---

## Step 2 — Feature Registry Audit (`feature-registry.md`)

This is the most important file to update. It must be a complete, accurate map of every feature in the app.

For each feature, verify and record:
- **Status**: Live / Partial / Stubbed
- **Web file paths**: exact paths to the component, page, and API route(s)
- **Mobile file paths**: exact paths to the component and screen(s)
- **DB tables/columns**: what tables it reads/writes, key column names
- **Data shape**: what the DB returns, what the component expects (especially for JSONB fields like `nutrition`)
- **Plan gate**: which subscription tier is required (Free/Chef/Family/Pro)
- **DO NOT TOUCH notes**: fields, sections, or patterns that must not be removed or restructured

Features to audit and document (minimum — add any found in DONE.md not listed here):

### Core Recipe
- Recipe create / edit / delete
- Recipe detail page (web + mobile)
- Recipe import: URL, scan photo, choose photo, YouTube, paste text, manual entry, browser extension
- Recipe re-import (preserves user edits)
- PDF export (Pro plan)
- Recipe conversion: recipe ↔ technique

### Nutrition
- NutritionCard component — web (`apps/web/components/NutritionCard.tsx`) and mobile (`apps/mobile/components/NutritionCard.tsx`)
  - **CRITICAL**: Document exactly what fields the `nutrition` JSONB contains (`per_serving`, `per_100g`, `confidence`, `notes`)
  - **CRITICAL**: Document the Per Serving / Per 100g toggle — how it works, what state controls it, where preference is persisted (SecureStore on mobile)
  - **CRITICAL**: Document what the disclaimer footer must say and must NOT include
- Nutrition generation (single recipe)
- Nutrition bulk generation (admin + user banner)
- Nutrition search filters (web + mobile)
- Nutrition in meal plan wizard

### Search & Discovery
- Recipe search with filters (web + mobile)
- Filter categories: Cuisine, Course, Cook Time, Ingredients, Source, Tags, Dietary, Nutrition
- Drag-and-drop filter reordering (web, localStorage)
- What's New feed
- Following feed

### Social
- Like / save counts
- Follow system (`user_follows` table)
- Verified Chef badge (web + mobile, all surfaces)
- Comments (threaded, Chef+ plan, AI moderation)
- Messaging

### Meal Planning
- MealPlanWizard (web + mobile)
- Nutritional goals step
- Daily nutrition summaries

### User & Auth
- Auth flow (sign in, sign up, password recovery)
- User profiles
- Plan/subscription gating (Free/Chef/Family/Pro)
- Stripe integration (web/Android)

### Admin
- Admin dashboard
- Admin users page
- Admin nutrition bulk generation page
- Admin feedback page
- Recipe moderation

### Mobile-specific
- FloatingTabBar (root `_layout.tsx` — NOT in tabs layout)
- ChefsBookHeader with logo tap → feedback modal
- FeedbackModal
- Offline shopping list (FileSystem cache)
- SecureStore auth persistence

### Infrastructure / Cross-cutting
- i18n (react-i18next, 5 locales: en/fr/es/it/de)
- AI cost tracking (`ai_usage_log` table, `logAiCall`)
- User throttling (`user_throttle` table)
- Web image proxy (`/api/image?url=`)
- Cloudflare Tunnel
- Browser extension (v1.1.1)

---

## Step 3 — UI Guardian Audit (`ui-guardian.md`)

Update to reflect:

- All current shared components on web (check `apps/web/components/`)
- All current shared components on mobile (check `apps/mobile/components/`)
- Current design tokens (cream `#faf7f0`, pomodoro red `#ce2b37`, basil green `#009246`)
- `ChefsDialog` / `useConfirmDialog` — unified dialog system (no raw `alert()`)
- `useAlertDialog` — web alert replacement
- Known raw `alert()` instances still to be cleaned up (~40 remaining in `apps/web`)
- NativeWind v4 patterns for mobile
- Tailwind CSS 3 patterns for web
- Any component that must NOT be restructured (add a DO NOT REFACTOR note)

---

## Step 4 — Data Flow Audit (`data-flow.md`)

Update to reflect:

- Current Zustand store structure (check `apps/web/store/` and `apps/mobile/store/`)
- Current fetch patterns for recipe data (what fields are selected, what shape arrives)
- The `nutrition` JSONB field shape — document `per_serving`, `per_100g`, `confidence`, `notes` keys
- SecureStore usage on mobile (auth + nutrition toggle preference)
- localStorage keys in use on web (filter order: `cb-search-filter-order`, nutrition banner dismiss)
- Any data flow gotchas discovered across sessions (document them here)

---

## Step 5 — Testing Agent Audit (`testing.md`)

Add a **Regression Smoke Test Checklist** that EVERY session must run before wrapup, regardless of what was changed:

```
REGRESSION SMOKE TEST — run before every wrapup:
[ ] Recipe detail page loads (web + mobile)
[ ] NutritionCard renders with values (not blank) on a recipe that has nutrition data
[ ] Per Serving / Per 100g toggle is visible and switches values
[ ] Nutrition disclaimer shows single line only (no AI reasoning paragraph)
[ ] Recipe import page loads (/dashboard/scan)
[ ] Auth flow: sign in page loads
[ ] Admin panel loads (/admin)
[ ] FloatingTabBar visible on mobile recipe detail screen
[ ] No new TypeScript errors introduced (tsc --noEmit on changed workspaces)
```

Also update:
- Correct emulator AVD name — confirm against `emulator -list-avds` output in DONE.md (currently `CB_API_34` = Pixel 5, API 34, google_apis_playstore)
- Known ADB limitation: `adb shell input tap` is unreliable on React Native touchable components — document workarounds
- Known pre-existing TypeScript error: `expo-file-system/src/legacy/FileSystem.ts` cannot find `react-native` types — this is NOT introduced by session changes, do not treat as a blocker
- Emulator instability pattern: if "System UI not responding" appears, cold boot with `-wipe-data` before retrying

---

## Step 6 — Navigator Audit (`navigator.md`)

Verify all routes are listed and accurate. Cross-reference against:
- `apps/web/app/` directory structure
- `apps/mobile/app/` directory structure

Add any routes added since the file was last updated. Remove any that no longer exist.
Confirm ADB navigation commands and screen coordinates are still accurate for current builds.

---

## Step 7 — Deployment Agent Audit (`deployment.md`)

Verify the following are still accurate:
- RPi5 deploy script path: `/mnt/chefsbook/deploy-staging.sh`
- PM2 process name
- `NODE_OPTIONS=--max-old-space-size=1536` requirement on Pi builds
- The pre-build clean sequence: `rm -rf apps/web/node_modules/react apps/web/node_modules/react-dom .next`
- Do NOT `npm install` in apps/web or repo root on Pi (EOVERRIDE conflict)
- SWC lockfile warning on arm64 is NON-FATAL — document this explicitly

---

## Step 8 — Add Recurring Failure Patterns

Based on DONE.md, add these to the relevant agent files as explicit **KNOWN FAILURE PATTERNS — DO NOT REPEAT**:

Add to `testing.md`:
- "ADB tap unreliable on React Native touchable components — use visual screenshot + code review instead"
- "Emulator System UI crash on launch — cold boot with -wipe-data before retrying, do not give up after one failure"
- "Pre-existing expo-file-system TypeScript error is NOT a session regression — do not flag or block on it"
- "'Code looks correct' is not valid proof for any checklist item — visual screenshot or psql/curl required"

Add to `feature-registry.md`:
- "NutritionCard: removing the `notes` section MUST NOT affect the nutrient grid JSX — these are separate render blocks. Always `git diff` before wrapup to confirm only the intended lines changed."
- "FloatingTabBar lives in root `_layout.tsx` NOT in `(tabs)/_layout.tsx` — do not move it"

Add to `ui-guardian.md`:
- "NutritionCard on both web and mobile has three distinct sections: (1) nutrient grid, (2) Per Serving/Per 100g toggle, (3) disclaimer footer. These are INDEPENDENT render blocks. Editing one must never affect the others."

---

## Step 9 — Wrapup

This session has no deployment. Wrapup consists of:

1. List every agent file that was updated with a one-line summary of what changed
2. Confirm NO production files were modified (`git diff --name-only` — only `.claude/agents/` files should appear)
3. Update DONE.md with session entry tagged `TYPE: MAINTENANCE`
4. Note any features found in the codebase that were NOT in DONE.md (undocumented changes)
5. Note any AGENDA.md items that appear already complete based on source inspection
