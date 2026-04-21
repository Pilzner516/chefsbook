# ChefsBook — Session 191: Paste Text Import Fallback
# Target: packages/ai, apps/web (import flow, recipe detail banner), apps/mobile (scan tab)

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, .claude/agents/deployment.md,
.claude/agents/import-pipeline.md, .claude/agents/import-quality.md,
.claude/agents/ai-cost.md, .claude/agents/ui-guardian.md, and
.claude/agents/feature-registry.md before starting.
Run all pre-flight checklists.

---

## FEATURE OVERVIEW

When a site blocks import or a recipe imports with missing fields, users
currently have no recovery path except "Refresh from source" (which fails
for the same reason). This session adds a paste-text fallback so users can
copy raw recipe text from any source and have AI parse it into a structured
recipe — the same way a URL import or scan works.

---

## PART 1 — New AI function: importFromText()

In packages/ai, create a new function `importFromText()`.

It accepts a raw text string (anything the user pastes — ingredients list,
full recipe page text, partial recipe, etc.) and returns the same structured
recipe JSON that importFromUrl() returns.

Use Sonnet. The prompt should instruct Claude to extract whatever recipe
information is present and return it in the standard recipe schema. If only
ingredients are present, return only ingredients. If the full recipe is
present, return everything. Partial results are acceptable — better than nothing.

Run the result through the existing completeness gate and auto-tag pipeline,
same as every other import path.

Log via logAiCall() with action: 'import_text', model: 'sonnet'.

Export from @chefsbook/ai.

---

## PART 2 — Web: new "Paste recipe text" import option

On the web import flow, add a third tab/option alongside "From URL" and any
other existing options: **"Paste text"**.

UI: a simple textarea (large, ~8 rows) with placeholder text:
"Paste recipe text here — ingredients, steps, or the full recipe. AI will
extract and structure it for you."

A single "Import" button below it. On submit, call importFromText() and
follow the same flow as a URL import — show loading state, redirect to the
new recipe on success, show error on failure.

Keep the UI consistent with existing import UI patterns and Trattoria theme.

---

## PART 3 — Web: paste fallback on missing-fields banner

The "This recipe is missing ingredients" banner on the recipe detail page
currently only offers "Refresh from source". Add a second option:
**"Paste ingredients"**.

Tapping it expands a textarea inline (below the banner, not a modal).
Placeholder: "Paste the ingredients list here."
A "Save" button below calls importFromText() with just the pasted text,
then merges the returned ingredients into the existing recipe without
overwriting title, steps, description, or other fields.

Same pattern for any other missing-field banner (missing steps, etc.) —
the paste area should be contextual to what is missing.

---

## PART 4 — Mobile: "Paste text" option in Scan tab

The Scan tab currently has: Scan / URL / Speak.
Add a fourth option: **Paste**.

Tapping it shows a large TextInput (multiline) with the same placeholder as
web. A "Parse Recipe" button submits it to importFromText().

Follow existing mobile import patterns — loading state, navigation to the
new recipe on success, error handling on failure.

Use NativeWind for styling, consistent with other Scan tab options.
Respect safe area insets on the bottom button.

---

## PART 5 — Plan gates

Paste import uses AI (Sonnet) so it must respect the same plan gates as
URL import (canImport). Free users cannot use it. Show the upgrade prompt
if a Free user tries.

---

## VERIFICATION

### Web paste import
- Navigate to the import page
- Paste a recipe's ingredients and steps (copy from any recipe site)
- Submit — recipe should be created with structured ingredients and steps
- Check DB: ingredients array populated, is_complete = true (if enough data)
- Check ai_usage_log: action = 'import_text' logged with non-zero cost

### Web missing-fields banner
- Find a recipe with missing ingredients
- Click "Paste ingredients", paste an ingredients list
- Ingredients should merge into the recipe without overwriting other fields

### Mobile paste tab
- Open Scan tab, tap Paste option
- Paste recipe text, tap Parse Recipe
- Recipe created and navigated to correctly

---

## DEPLOYMENT

Web:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
rm -rf apps/web/.next
cd apps/web
NODE_OPTIONS=--max-old-space-size=1024 npx next build --no-lint 2>&1 | tail -20
pm2 restart chefsbook-web
```

Mobile: tsc check only this session — full APK build in a separate session.

---

## COMPLETION CHECKLIST

- [ ] importFromText() in packages/ai — accepts raw text, returns recipe schema
- [ ] importFromText() logs via logAiCall (action: import_text)
- [ ] importFromText() exported from @chefsbook/ai
- [ ] Web: Paste text tab on import flow
- [ ] Web: Paste ingredients option on missing-fields banner
- [ ] Mobile: Paste option in Scan tab
- [ ] Plan gate: Free users cannot use paste import
- [ ] Completeness gate and auto-tag run on paste imports
- [ ] Web tsc --noEmit passes clean
- [ ] Mobile tsc --noEmit passes clean
- [ ] Deployed to RPi5 — chefsbk.app HTTP 200
- [ ] TYPE: CODE FIX — new feature, no data patches
- [ ] Run /wrapup
