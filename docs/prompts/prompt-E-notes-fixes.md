# Prompt E — Notes Section: Copyright Fix + Edit UX + Housekeeping
## Scope: apps/web (import pipeline, recipe detail page, AGENDA.md, dashboard banner)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ui-guardian.md`
8. `.claude/agents/import-pipeline.md`
9. `.claude/agents/ai-cost.md` (AI call being modified)

Run ALL pre-flight checklists before writing a single line of code.
Inspect the recipes table schema before writing any queries: `\d recipes`

---

## FIX 1 — Notes copyright: paraphrase at import time

### Problem
The notes field is being scraped and stored verbatim from the source page. This is a
copyright violation — notes are the most personally authored part of a recipe writer's
content.

Every other field (description, ingredients, steps) is already structured/rewritten by
the AI extraction pipeline. Notes must receive the same treatment.

### Fix
In the import pipeline (`packages/ai/src/importFromUrl.ts` or wherever notes are
extracted), update the AI prompt to instruct the model to:

- Extract the SUBSTANCE of any notes (storage tips, scaling advice, timing notes,
  serving suggestions, substitution hints) from the source
- Rewrite them as clean prose paragraphs in Chefsbook's own voice
- Do NOT copy the source site's formatting, label prefixes (e.g. "MULTIPLE:",
  "TOTAL TIME:", "STORAGE:"), or sentence structure
- Do NOT copy verbatim phrases — paraphrase entirely
- If there are no meaningful notes, return null/empty

Example of what NOT to do (verbatim scrape):
"MULTIPLE: This recipe makes 1 Sicilian pizza. I typically make 6 pizza pies at once..."

Example of correct output (paraphrased, Chefsbook voice):
"This recipe makes one Sicilian pizza but scales easily using separate bowls and baking
sheets for each additional pie. The total time includes dough rising. Leftovers keep in
the fridge for up to 4 days, or freeze in an airtight container for up to 2 months.
Reheat at 375°F for about 5 minutes."

This fix applies to:
- Initial URL import
- Re-import / refresh from source (same pipeline)
- PDF/extension import if notes are extracted there too

Use the same model already used for that extraction step (do not upgrade to a more
expensive model just for notes).

### Existing verbatim notes sweep
After fixing the pipeline, run a one-time SQL update to clear notes on recipes where
the notes field looks like a verbatim scrape. A safe heuristic: notes that contain
any of these label patterns are almost certainly verbatim:

```sql
UPDATE recipes
SET notes = NULL
WHERE notes IS NOT NULL
  AND (
    notes LIKE '%MULTIPLE:%'
    OR notes LIKE '%TOTAL TIME:%'
    OR notes LIKE '%STORAGE:%'
    OR notes LIKE '%NOTE:%'
    OR notes LIKE '%NOTES:%'
    OR notes LIKE '%TIP:%'
    OR notes LIKE '%TIPS:%'
  )
  AND deleted_at IS NULL;
```

Report how many rows were updated.
Do NOT delete the recipes — only null out the notes field.

---

## FIX 2 — Notes section: Add Edit button matching other sections

### Problem
The Notes section on the recipe detail page has no Edit button. The user must click
directly into the notes text to edit it, which is inconsistent with Ingredients and
Steps which both have an "Edit" button top-right of the section header.

### Fix
In `apps/web/app/recipe/[id]/page.tsx` (or the Notes component if extracted):

1. Study exactly how the Ingredients and Steps sections implement their Edit button —
   position, style, label, behaviour. Match it exactly.

2. Add an "Edit" button to the top-right of the Notes section header, using the
   identical pattern.

3. Clicking "Edit" should switch the notes area into an editable state:
   - The notes text becomes a textarea (same as the current click-to-edit behaviour)
   - Save and Cancel buttons appear (same pattern as other sections)
   - "Save" commits the change, "Cancel" discards it

4. The existing click-on-text-to-edit behaviour should be REMOVED or disabled —
   there should be one consistent entry point (the Edit button), not two.

5. The Edit button should only be visible to the recipe owner (same gate as
   Ingredients/Steps Edit buttons).

---

## FIX 3 — AGENDA.md: Remove Tier 1 #6 (false positive)

The import pipeline diagnostic (session just completed) confirmed that the pipeline
is working correctly. There are zero incomplete recipes with source URLs. The Tier 1
#6 item was based on a misunderstanding.

Remove item #6 from AGENDA.md Tier 1. Renumber or reformat as needed to keep the
table clean.

---

## FIX 4 — Incomplete recipes banner copy

The banner on the My Recipes dashboard currently reads:
"You have X recipes that need attention. They're saved as private until you complete them."

This implies a system failure or import problem. In reality these are draft recipes
from speak/scan features that the user started but didn't finish.

Update the banner body text to:
"These are draft recipes — add ingredients and steps to complete and publish them."

Keep the "Review now →" link and its behaviour unchanged (already fixed in Prompt D).
Only the body text changes.

Find the banner component in `apps/web/app/dashboard/page.tsx` or wherever it lives.
Also update the corresponding i18n key in `apps/web/locales/en.json` and all 4 other
locales (fr, es, it, de) with appropriate translations.

---

## IMPLEMENTATION ORDER
1. FIX 3 — AGENDA.md cleanup (no deploy needed, do this first)
2. FIX 1 — Import pipeline notes paraphrase prompt update
3. FIX 1 — SQL sweep to null out verbatim notes
4. FIX 2 — Notes Edit button on recipe detail page
5. FIX 4 — Banner copy update + i18n
6. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
7. Deploy per `deployment.md`

---

## GUARDRAILS
- Do NOT change how ingredients or steps are edited — only Notes gets the Edit button treatment
- Do NOT delete any recipes — only null out the notes field in the SQL sweep
- Do NOT change the "Review now →" link behaviour (already working from Prompt D)
- The notes paraphrase must use the same model already in use for that extraction step
- Update ai-cost.md only if the notes extraction now uses a different model than before

---

## TESTING REQUIREMENTS
1. Import a recipe with notes from a live URL — verify notes come back paraphrased, not verbatim
2. Open a recipe detail page — confirm Edit button appears top-right of Notes section header
3. Click Edit — notes area becomes editable textarea with Save/Cancel buttons
4. Confirm click-on-text no longer triggers edit mode directly
5. SQL sweep: report row count updated
6. Banner copy: verify updated text appears on dashboard

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- The old notes extraction prompt text and the new text
- SQL sweep row count
- Which file the banner copy was in
- All i18n locales updated (list them)
- tsc clean confirmed
- Deploy confirmed
