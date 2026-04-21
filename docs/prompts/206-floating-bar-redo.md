# Prompt 206: Floating tab bar on recipe detail (redo with mandatory pause)

## Scope
MOBILE APP ONLY. Single issue: making the custom FloatingTabBar appear on recipe detail (and other detail screens) without breaking the primary tabs where it currently works.

Do NOT modify apps/web. Do NOT touch the camera bug, GuidedScanFlow, or splash screen.

## Context — read this carefully
Session 203 attempted this fix. It failed catastrophically: the agent moved FloatingTabBar out of `(tabs)/_layout.tsx` and into the root `_layout.tsx` with usePathname/useSegments visibility logic. The result was NO floating bar on ANY screen — a regression worse than the original bug. Session 204 reverted FIX 1 only.

Current known-good state (session 204):
- `FloatingTabBar` component is mounted inside `apps/mobile/app/(tabs)/_layout.tsx`
- Every screen inside the `(tabs)` group inherits it
- Detail screens (`recipe/[id]`, `cookbook/[id]`, `chef/[id]`, `share/[token]`, `recipe/new`) live OUTSIDE `(tabs)` at the app root, so they do NOT inherit it
- 7 detail screens have `insets.bottom + 16` padding to account for a bar that isn't there (legacy)

This prompt exists BECAUSE the previous attempt failed. The agent's single most important job is not to repeat that failure.

## SESSION START (mandatory)
Read CLAUDE.md, DONE.md (sessions 202, 203, 204 entries in full), AGENDA.md, .claude/agents/testing.md, .claude/agents/navigator.md.

Specifically review:
- `git show df43990 -- apps/mobile/app/_layout.tsx apps/mobile/app/(tabs)/_layout.tsx` — what session 203 tried
- `git show <session-204-revert-sha> -- apps/mobile/app/_layout.tsx apps/mobile/app/(tabs)/_layout.tsx` — what was reverted
- Understand WHY session 203's approach broke everything before proposing a new approach

## Global constraints
- All colors via useTheme().colors. No hardcoded hex.
- Safe-area insets honored on all new layout wrappers.
- Do NOT run `expo prebuild --clean`.
- Do NOT commit apps/mobile/android/ (gitignored).
- Do NOT introduce a second FloatingTabBar instance. There must be exactly one mounted at any time.
- Do NOT use `usePathname()` or `useSegments()` to conditionally hide/show the bar in the root layout — that's what session 203 did and it failed. If you believe this is the right approach, stop and report why.

## Phase 1 — Investigation (mandatory, pause after)

### Step 1.1 — Understand the session 203 failure
Read the session 203 diff and the session 204 revert. Answer:
- What exactly did session 203 do to the mount point?
- What was the visibility logic it introduced?
- Why did it end up showing on zero screens instead of one more screen?
- What assumption did session 203 make that turned out to be wrong?

Report findings before moving on.

### Step 1.2 — Survey the navigation architecture
Map out the current state:
- Where is FloatingTabBar imported and rendered? (Should be `(tabs)/_layout.tsx`.)
- What layout wraps the detail screens (`recipe/[id]`, `cookbook/[id]`, etc.)? Are they wrapped by anything, or just the root Stack?
- How do users navigate from a tab to a detail screen? (`router.push`? Stack navigation?)
- How does the back button work from a detail screen?
- Are there deep links that land users directly on a detail screen? (Yes — `chefsbk.app/recipe/[id]` Android App Links per DONE.md session 35.)

### Step 1.3 — Propose options, don't pick one
List at least TWO plausible fixes with pros/cons for each:

**Option A: Move detail screens into (tabs)**
- Move `recipe/[id].tsx`, `cookbook/[id].tsx`, `chef/[id].tsx`, `share/[token].tsx`, `recipe/new.tsx` into `apps/mobile/app/(tabs)/`.
- They inherit FloatingTabBar automatically.
- Risk: breaks deep links, changes back-button behavior, requires updating all `router.push('/recipe/...')` calls.

**Option B: Extract FloatingTabBar to a reusable layout component**
- Create a wrapper component `<WithFloatingTabBar>` that renders children + the bar.
- Keep the bar mounted in `(tabs)/_layout.tsx` as today.
- Wrap each detail screen in `<WithFloatingTabBar>` manually at the screen level.
- Risk: two mount points (duplication), have to remember to wrap every new detail screen.

**Option C: (your suggestion based on what the code actually looks like)**
- Describe it.
- Risks.

### Step 1.4 — Report and PAUSE
Post to the user:
- Session 203 failure analysis from 1.1
- Navigation architecture survey from 1.2
- At least 2 option proposals from 1.3
- Your recommendation with reasoning
- Estimated blast radius of each option (files changed, deep-link risk, back-button risk)

**DO NOT WRITE THE FIX YET. WAIT FOR USER APPROVAL OF THE OPTION.**

This pause is NOT optional. If you skip it, you will repeat session 203's failure. The user will explicitly name which option to implement (A, B, C, or some variation). Do not start typing code until they do.

## Phase 2 — Implementation (only after approval)

Implement the approved option. If the option involves moving files:
- Update every `router.push`, `router.replace`, `router.navigate`, and `<Link>` that references the old paths
- Update `navigator.md` with the new routes
- Verify Expo Router's absolute URL resolution still works for deep links (grep for `chefsbk.app` in app.json intent filters)

If the option involves wrapping screens:
- Keep the wrap consistent across every detail screen
- Add a comment at the FloatingTabBar component definition explaining why there are N mount points

Remove the `insets.bottom + 16` legacy padding from detail screens now that they'll have a real bar — OR keep it if the bar's height requires it. Decide deliberately, don't leave it by accident.

## Phase 3 — Verification (mandatory, device required)

Build + sideload the APK. Then verify on device or emulator:

**Floating bar presence:**
1. Each of the 5 tabs (My Recipes, Search, Scan, Plan, Cart) — bar visible ✓
2. Recipe detail — bar visible ✓
3. Cookbook detail — bar visible ✓
4. Chef profile — bar visible ✓
5. Recipe new/edit — bar visible ✓
6. Settings modal — bar NOT visible ✓ (regression check)
7. Sign-in / sign-up / landing — bar NOT visible ✓ (regression check)

**Navigation works:**
8. Tap each floating bar button from recipe detail — lands on the right tab
9. Back button from recipe detail returns to previous screen, not to root
10. Deep link test: `adb shell am start -a android.intent.action.VIEW -d "https://chefsbk.app/recipe/<some-real-id>"` — lands on recipe detail WITH the floating bar visible

**Scroll behavior:**
11. Open a long recipe, scroll to the bottom — Like/Save/Share action row is reachable (not hidden under the bar)

Capture ADB screencaps for at least #1, #2, #6, #10. If screencaps aren't practical, provide explicit visual confirmation per screen.

Do NOT declare "done" unless all 11 items pass. Any failure → stop, report, do not patch over it.

## Phase 4 — Rebuild + wrap

Rebuild release APK per prompt 200. Verify apksigner cert identity matches session 142 fingerprint.

Report APK path + size.

Run /wrapup. DONE.md entry must include:
- Which option was implemented (A/B/C)
- All 11 verification items with pass/fail
- Screencap paths
- TYPE: CODE FIX

Commit message: `fix(mobile): session <N> - floating tab bar on detail screens (option <X>)`

Push both chefsbook and bob-hq repos.

## Absolute prohibitions
- Do NOT skip Phase 1's pause. Session 203 did. Do not repeat.
- Do NOT ship without Phase 3's 11-item verification. Session 203 did. Do not repeat.
- Do NOT implement Option A if it breaks deep links without a deep link verification step passing.
- Do NOT add usePathname/useSegments-based visibility to the root layout. Session 203's approach is off the table.
