# P-210 — Mobile: Native Dialog Audit/Fix + AI Image Modal Layout

## WAVE: Standalone — safe to run immediately, no dependencies

---

## SESSION START

```bash
git pull origin main
```

Read agents in this order:
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md` (full)
3. `DONE.md` — confirm P-207 entries are present
4. `.claude/agents/testing.md` (MANDATORY)
5. `.claude/agents/feature-registry.md` (MANDATORY)
6. `.claude/agents/ui-guardian.md` (MANDATORY)
7. `.claude/agents/navigator.md` (MANDATORY)

Run ALL pre-flight checklists before proceeding.

---

## Context
Two QA screenshots revealed three issues in the P-207 image management feature:
1. The "Change Image" action sheet is a native Android system dialog — wrong format
2. The "Generate AI Image" modal has a massive dead space gap between the creativity
   slider and the Generate button
3. The theme picker row clips the last card with no scroll affordance

This session also audits the entire mobile codebase for any other native system dialogs
that need to be converted to ChefsDialog.

---

## PART A — Native Dialog Audit (do this first, before any fixes)

### Step 1 — Grep the entire codebase

Run from repo root and capture all output:

```bash
grep -rn "Alert.alert\|Alert\.prompt" apps/mobile --include="*.tsx" --include="*.ts"
grep -rn "ActionSheetIOS\|showActionSheetWithOptions" apps/mobile --include="*.tsx" --include="*.ts"
grep -rn "window\.confirm\|window\.alert" apps/mobile --include="*.tsx" --include="*.ts"
```

### Step 2 — Classify every result

For each hit, classify as:
- **A) Must convert to ChefsDialog** — any user-facing action confirmation, option
  picker, or destructive prompt (delete, discard, change)
- **B) Acceptable as Alert** — genuine error surfacing in a catch block with no access
  to UI context. Rare — be strict. Justify every B explicitly.
- **C) False positive** — already using ChefsDialog or not a dialog at all

Produce this table and **present it to Bob before writing any fix code**:

| File | Line | Pattern | Text/Title | Classification | Reason |
|------|------|---------|------------|----------------|--------|

Wait for Bob's confirmation before proceeding to Part B.

---

## PART B — Fix All Category A Dialog Violations

### ChefsDialog Rules (apply to every fix)
1. Read an existing ChefsDialog usage in the codebase before writing anything.
   Do not guess at the component API.
2. Option pickers (like Change Image) use **pill-style buttons**, stacked vertically,
   full-width:
   - Primary action — pomodoro red `#ce2b37`, white text
   - Secondary actions — basil green `#009246`, white text
   - Destructive action — outline pill, red border, red text
   - Cancel — plain text link below pills, no border, no background
3. Confirmation dialogs (yes/no) use ChefsDialog with two pills — confirm (red) and
   cancel (grey outline).
4. Dialog title: ChefsBook serif style, centered.
5. Background: cream `#faf7f0`. NativeWind throughout. Trattoria theme only.
6. Do NOT change any logic triggered by each option — UI presentation only.

### Change Image dialog (the specific QA-reported violation)
- Find the native action sheet added in P-207, near `apps/mobile/app/recipe/[id].tsx`
  or a component it imports
- Replace with ChefsDialog
- Four pill options:
  - Generate AI Image — red primary pill
  - Choose from Library — green secondary pill
  - Take a Photo — green secondary pill
  - Remove Image — destructive outline pill (red border, red text)
  - Cancel — plain text link below
- Do NOT touch camera, library picker, AI generation, or remove logic

---

## PART C — AI Image Generation Modal Layout Fixes

The Generate AI Image modal (added in P-207) has three problems visible in QA
screenshots:

### Fix 0 — Remove the Creativity slider entirely from the modal
The creativity level (1–5) is an **admin-controlled global setting**. Admin sets
one value that applies to ALL users. Users never see or touch it.

**How it must work:**
- There is (or must be) a single admin-controlled value stored in the database
  (e.g. an `app_settings` or `admin_config` table, or a column on an existing
  settings table — check what already exists before creating anything new)
- Run on RPi5 to check what exists:
  ```bash
  ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres \
    -c '\dt' | grep -E 'setting|config|admin'"
  ```
  Then `\d` any relevant table. If a suitable table already exists, add a
  `image_creativity_level` column (integer, default 3). If nothing suitable
  exists, create a minimal `app_settings` table:
  ```sql
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  INSERT INTO app_settings (key, value)
  VALUES ('image_creativity_level', '3')
  ON CONFLICT (key) DO NOTHING;
  ```
  Apply via psql on RPi5, then `docker restart supabase-rest`.

- The mobile app reads this value at generation time via a Supabase query —
  NOT hardcoded, NOT stored in the app bundle. If the query fails, fall back
  to `3` silently.

- The admin panel on web must have a control to update this value. Check if
  one already exists. If not, add a simple numeric input (1–5) to the admin
  settings page that updates the DB row. This is a small web-side addition —
  one input field, one save button.

**UI fix:**
- Remove the Creativity section (label, description text, slider, − / + buttons,
  and numeric value display) from the modal UI completely
- Do NOT expose any creativity control to the end user anywhere in the modal
- This removal will also collapse most of the dead space — Fix 1 below becomes
  simpler as a result

**Migration file:**
Write any new SQL to `supabase/migrations/` with the next sequential filename.
Apply via psql. Restart supabase-rest after.

### Fix 1 — Dead space between theme picker and Generate button
The modal shows a large empty gap between the creativity slider and the Generate button
at the bottom. The content does not fill the available space naturally.

**Root cause to investigate:** The modal container likely has a fixed height or uses
`flex: 1` incorrectly, causing the content to not distribute space. The Generate button
is probably positioned absolutely at the bottom rather than being in the natural flow,
OR the ScrollView/container is not using `justifyContent: 'space-between'` or similar.

**Fix:**
- The content area (theme picker + creativity slider) should sit naturally at the top
- The Generate button should sit at the bottom with a reasonable fixed margin
  (`marginBottom: safeArea.bottom + 16` or similar)
- There should be NO large empty gap — if the content is short, the button still sits
  at the bottom but the gap is proportional, not excessive
- Do NOT use a fixed pixel height for the modal — it must adapt to different screen sizes
- Use `flex: 1` on the content container and `justifyContent: 'space-between'` at the
  modal level, OR use a ScrollView for content with the button outside/below it

### Fix 2 — Theme picker cards clipped on right edge
The theme picker horizontal scroll cuts off the last visible card ("Edit..." visible in
screenshot) with no visual indicator that more themes exist.

**Fix:**
- Add a fade gradient on the right edge of the theme picker to indicate scrollability
  (a common React Native pattern — use a `LinearGradient` overlay or a simple View
  with a right-edge shadow)
- OR ensure the last card is never clipped — add enough `paddingRight` to the
  ScrollView `contentContainerStyle` so the last card is fully visible before the
  fade/edge
- The horizontal scroll behaviour itself is correct — only the affordance needs fixing
- If `expo-linear-gradient` is not already installed, check first:
  ```bash
  cat apps/mobile/package.json | grep linear-gradient
  ```
  If missing: `cd apps/mobile && npx expo install expo-linear-gradient`

---

## PART D — Emulator Verification

### Ask Bob for navigation help when needed
Do not spend more than 2 attempts navigating to any screen alone. Instead ask Bob:
- "I need to verify [dialog name] on [screen]. Can you navigate there and confirm
  when you're ready?"
- "Can you log in on the emulator? I'll wait."
- "Can you tap [action] so the dialog opens? I'll screenshot it."

Bob will handle the navigation. You take the ADB screenshot to verify.

### Required screenshots
1. Change Image — ChefsDialog with Trattoria pill buttons (cream bg, correct colors)
2. Generate AI Image modal — no dead space gap, Generate button naturally positioned
3. Generate AI Image modal — theme picker showing fade/scroll affordance on right edge
4. Confirm NO native system dialog appears anywhere in the Change Image flow

---

## Testing Evidence Required for /wrapup
1. Phase A audit table (all classifications)
2. Screenshots 1–4 above
3. Confirmation no Category A `Alert.alert` or `ActionSheetIOS` remain
4. APK size + signing SHA

---

## Build
After all fixes verified:
```bash
cd apps/mobile
del android\app\build\generated\assets\createBundleReleaseJsAndAssets\index.android.bundle 2>nul
./gradlew assembleRelease --no-daemon
apksigner verify --print-certs apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

---

## Session Close
```
/wrapup
```

---

## Guardrails
- Present audit table to Bob before writing ANY fix code
- UI and layout changes only — do not touch camera, picker, AI generation, or remove logic
- Do NOT use ActionSheetIOS, Alert.alert, or any native dialog for Category A items
- Do NOT touch web files
- Do NOT touch any screen outside the Change Image / Generate AI Image flow (unless
  fixing a Category A audit violation)
- Ask Bob for emulator help rather than getting stuck navigating alone
- One commit per part (Part B, Part C Fix 1, Part C Fix 2)
