# P-205 — Mobile: Floating Edit Save Bar + QA Notepad Button + Quick Logic Fixes

## SESSION START
Read agents in this order before writing a single line of code:
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md` (full)
3. `DONE.md`
4. `.claude/agents/testing.md` (MANDATORY)
5. `.claude/agents/feature-registry.md` (MANDATORY)
6. `.claude/agents/ui-guardian.md` (MANDATORY — touches screens)
7. `.claude/agents/navigator.md` (MANDATORY — touches screens and tab bar logic)
8. `.claude/agents/data-flow.md` (touches Zustand stores and recipe data)

Run ALL pre-flight checklists from every agent above before proceeding.

---

## Context
QA report from 4/20/2026. This session fixes 5 items:
- Item 1: Floating save bar during recipe edit
- Item 2: Floating "Add Item" button in QA Notepad
- Item 6: Handful/pinch quantity shows 0 — should show 1
- Item 9: Photo-generated recipes default to private even when complete — should default to public
- Item 10: No visibility toggle (private/public) on mobile recipe detail screen

Do NOT touch camera/scan code, image generation code, or cook mode. Those are separate sessions.

---

## ITEM 1 — Floating Save Bar During Recipe Edit

### Problem
When editing a recipe on mobile, the "Save" and "Save as a Copy" buttons are at the bottom of a long scrolling form. Users scroll down, edit, then scroll back to find the buttons — or hit the OS back button and lose all edits.

### Solution
Add a floating action bar that appears ONLY when the recipe edit screen is active. This bar replaces the normal FloatingTabBar during the edit flow.

### Implementation Rules
1. Locate the recipe edit screen — check `apps/mobile/app/recipe/[id].tsx` for the edit mode and any dedicated edit screen. Check `navigator.md` for the exact file path.
2. When edit mode is active (user is editing a recipe), the FloatingTabBar MUST be hidden. Do not render both.
3. Render a floating bar pinned to the bottom of the screen (above the system nav bar, respecting safe area insets) with two buttons:
   - **Save** (primary, pomodoro red `#ce2b37`, white text)
   - **Save as a Copy** (secondary, outlined, basil green `#009246`)
4. This floating bar must remain visible regardless of scroll position — it is absolutely positioned, not inside the ScrollView.
5. When the user taps Save or Save as a Copy, execute the existing save logic, then restore the FloatingTabBar (i.e. exit edit mode).
6. When the user hits the OS back button while in edit mode, show a `ChefsDialog` confirmation: "You have unsaved changes. Discard them?" — Yes discards and exits, No keeps the user in edit mode.
7. The floating bar must respect `useSafeAreaInsets().bottom` so it is not hidden by the home indicator on Android/iOS.
8. Use NativeWind classes for styling. Match Trattoria design theme (cream `#faf7f0`, pomodoro red `#ce2b37`, basil green `#009246`).
9. Do NOT invent a new state management pattern — wire into the existing edit mode state/Zustand store already present in the recipe detail/edit screen.
10. Update `navigator.md` with any new component or changed screen behaviour.

---

## ITEM 2 — Floating "Add Item" Button in QA Notepad

### Problem
In the QA Notepad screen, when a note is long, the "Add Item" / submit button scrolls off the bottom of the screen and the user cannot tap it.

### Solution
Move the Add Item button out of the ScrollView and make it a floating action button (FAB) pinned to the bottom of the screen.

### Implementation Rules
1. Locate the QA Notepad screen — search `apps/mobile/app` for the notepad/qa screen. Check `navigator.md` for path.
2. Remove the Add Item button from its current position inside the scrollable content.
3. Add a FAB using the same floating bar pattern as Item 1:
   - Positioned absolutely at the bottom of the screen, above system nav bar, respecting `useSafeAreaInsets().bottom`.
   - Style: cream background `#faf7f0`, pomodoro red icon/label, shadow for elevation.
4. The FAB triggers the same save/submit action as the original button.
5. Ensure the ScrollView has enough `contentContainerStyle` paddingBottom so the last note entry is not hidden behind the FAB.
6. NativeWind styling. Match Trattoria theme.
7. Do NOT change any data persistence logic — only the button placement.

---

## ITEM 6 — Handful / Pinch Quantity Shows 0 — Fix to Show 1

### Problem
When a recipe uses vague quantities like "a handful" or "a pinch", the quantity is parsed as 0 (or falsy) instead of 1. This is a display/parsing bug.

### Solution
If a quantity value is 0 or missing for an ingredient that has a unit like "handful", "pinch", "dash", "splash", or similar non-numeric descriptors, default the display quantity to 1.

### Implementation Rules
1. Locate quantity formatting/display logic. Per CLAUDE.md: `packages/ui/src/unitConversion.ts` is the ONLY place unit conversion logic lives. Check `packages/ui/src/` for any formatting helpers.
2. Also check the AI extraction prompt in `packages/ai/` — if Claude is being asked to output quantity and is outputting 0 for these terms, fix the prompt to output 1 for descriptive quantities.
3. Fix in two places if needed:
   a. **Extraction prompt** — instruct the model: for ingredients where quantity is a descriptor (handful, pinch, dash, splash, sprig, clove group) and no numeric quantity is stated, output quantity `1`.
   b. **Display formatting** — wherever ingredient quantity is rendered on mobile, if quantity is 0, null, or undefined and unit/descriptor is present, display `1` instead of `0` or blank.
4. Do NOT change the DB schema — this is a prompt + display fix only.
5. If touching `@chefsbook/ai`: read `.claude/agents/ai-cost.md` first. Only change the prompt string — do NOT add new Claude API calls.
6. Verify with a test case mentally: "a pinch of salt" → quantity: 1, unit: "pinch", name: "salt". "a handful of spinach" → quantity: 1, unit: "handful", name: "spinach".

---

## ITEM 9 — Photo-Generated Recipes Default to Private Even When Complete

### Problem
When a recipe is created from a photo (camera scan flow), it is saved as `private` even if it passes the completeness gate (title, description, 2+ ingredients with quantities, 1+ step, 1+ tag). The completeness gate is already defined — the recipe is just not being set to `public` visibility when it passes.

### Solution
After the photo-scan recipe generation, run the completeness check. If the recipe passes, set `visibility = 'public'`. If it fails, keep `visibility = 'private'` and mark it `_incomplete`.

### Implementation Rules
1. Locate the scan flow completion code — in `apps/mobile/app/(tabs)/scan.tsx` and the guided scan flow in `apps/mobile/components/GuidedScanFlow.tsx` (added session 203).
2. Find where the recipe is saved after generation. Locate the `visibility` field being set on insert.
3. After the AI generates the recipe data, apply the same completeness gate used in the import pipeline:
   - Has title (not null, not URL-slug fallback)
   - Has description (not null, not empty)
   - Has 2+ ingredients with quantities > 0
   - Has 1+ step
   - Has 1+ tag
4. If ALL conditions pass → set `visibility = 'public'`.
5. If ANY condition fails → set `visibility = 'private'`, add `_incomplete` tag.
6. Do NOT change the completeness gate logic itself — reuse whatever already exists in the codebase. If it lives in `packages/db` or `packages/ai`, import it. Do NOT duplicate the logic.
7. This logic must apply to BOTH the standard scan path and the GuidedScanFlow path.

---

## ITEM 10 — No Visibility Toggle on Mobile Recipe Detail

### Problem
On the recipe detail screen (`apps/mobile/app/recipe/[id].tsx`), there is no way for the recipe owner to change the recipe from private to public or back. The web app has this — mobile does not.

### Solution
Add a visibility toggle on the recipe detail screen, visible only to the recipe owner.

### Implementation Rules
1. Locate `apps/mobile/app/recipe/[id].tsx`. Check `navigator.md` for screen structure.
2. Determine where the recipe owner controls are already shown (e.g. edit button, delete button). Add the visibility toggle nearby — do NOT add it to a place that non-owners can see.
3. Show the current visibility state clearly:
   - Private: lock icon + "Private" label in pomodoro red `#ce2b37`
   - Public: globe/unlock icon + "Public" label in basil green `#009246`
4. Tapping the control opens a `ChefsDialog` with two choices: "Make Public" or "Make Private" (contextual — only show the relevant option).
5. On confirmation, update the `visibility` column in the `recipes` table via Supabase. Optimistic UI update — update local state immediately, revert on error.
6. Only show this control when `recipe.user_id === currentUser.id` (owner check).
7. The visibility values in DB are `'private'`, `'shared_link'`, `'public'` — per CLAUDE.md. The toggle should only switch between `'private'` and `'public'`. Do not alter `shared_link` status.
8. Wire into the existing Zustand recipe store if one exists — do NOT create redundant fetch calls.
9. Update `navigator.md` with the new control.

---

## Testing Requirements (from testing.md)
Before wrapping up, prove EVERY item is working with evidence:

**Item 1:**
- ADB screenshot showing floating save bar visible while recipe form is scrolled down
- ADB screenshot showing FloatingTabBar is gone during edit mode
- ADB screenshot showing ChefsDialog when back button pressed

**Item 2:**
- ADB screenshot showing FAB visible on QA Notepad screen with a long note entered

**Item 6:**
- `psql` query: find a recipe with a pinch/handful ingredient and confirm quantity = 1 in DB for newly generated ones
- OR ADB screenshot of a recipe ingredient showing "1 pinch" not "0 pinch"

**Item 9:**
- Generate a recipe from camera scan
- `psql` query: `SELECT title, visibility, tags FROM recipes WHERE created_at > now() - interval '10 minutes' ORDER BY created_at DESC LIMIT 5;`
- Confirm complete recipes show `visibility = 'public'`

**Item 10:**
- ADB screenshot of recipe detail showing the visibility toggle for an owned recipe
- ADB screenshot of ChefsDialog visibility confirmation prompt
- `psql` query confirming visibility column updated after toggle

Build a signed release APK after all items verified:
```bash
cd apps/mobile
del android\app\build\generated\assets\createBundleReleaseJsAndAssets\index.android.bundle 2>nul
./gradlew assembleRelease --no-daemon
```
Verify APK signing: `apksigner verify --print-certs apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

---

## Guardrails
- Do NOT touch scan.tsx camera capture logic (separate session P-208)
- Do NOT touch image generation or image display (separate session P-207)
- Do NOT touch QA Notepad data sending/admin flow (separate session P-206)
- Do NOT touch web app files
- Do NOT change completeness gate logic — only call it from scan save flow
- Do NOT add new Claude API calls — Item 6 is a prompt string edit + display fix only
- One commit per item. Do not bundle unrelated items into one commit.
