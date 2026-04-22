# Prompt I — YouTube: Classification Confirmation Dialog + Tags Gate Audit
## Scope: apps/web (YouTube import flow, completeness gate, recipe detail page)

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

Run ALL pre-flight checklists before writing a single line of code.

---

## FEATURE 1 — YouTube classification confirmation dialog

### Context
When a YouTube URL is imported, the AI classifies the content as either a recipe
or a technique. This classification is not always correct — a technique video
may be imported as a recipe (confirmed in testing).

We need to give the user a quick confirmation step before the record is saved,
so they can correct the classification if needed.

### Where this happens
Find the YouTube import flow in the web app (Import & Scan page) and in the
extension import route. The confirmation dialog is WEB ONLY for now — the
extension import can continue to save immediately (no modal possible in extension
context), but should include the content type in the redirect URL as a hint so
the user can correct it on the detail page if needed.

### The flow

#### Web (Import & Scan page)
After the YouTube import API call completes but BEFORE saving/redirecting:

1. Show a ChefsDialog with:
   - Title: "Your Sous Chef's best guess"
   - Message: "This looks like a [Recipe / Technique] to us. Does that look right?"
     (bold the content type in the message)
   - Two pill buttons:
     - Primary: "Yes, it's a [Recipe/Technique]"
     - Secondary: "No, it's a [the other type]"

2. If user confirms: save as the AI-suggested type, redirect to detail page
3. If user corrects: save as the corrected type, redirect to correct detail page

#### Extension
No dialog possible. After import, redirect to the detail page as normal.
On the detail page, show a one-time dismissible notice (banner or toast):
"Your Sous Chef imported this as a Recipe. If that's not right, you can convert
it using the Re-import button."
This notice only appears if the content was imported via the extension AND it's
the user's first view of this record. Use a query param ?new=1 to detect this.
After the page loads and the notice is shown once, it should not appear again
(do not store any state for this, the ?new=1 param disappears on next navigation).

### API changes
The YouTube import endpoint needs to return the AI classification before saving,
so the web UI can show the confirmation dialog.

Two options, choose whichever fits the existing code better:

Option A (preferred): Add a ?classify_only=true query param to the import
endpoint. When set, the endpoint classifies the content and returns
{ contentType: 'recipe' | 'technique', title, description } without saving.
The web UI then calls the endpoint again (without the param) to actually save,
passing the user-confirmed contentType in the request body.

Option B: Keep the current flow (classify + save in one call) but add a new
/api/youtube/classify endpoint that only classifies without saving. The web UI
calls classify first, shows the dialog, then calls the full import with the
confirmed type.

Implement whichever option requires fewer changes to the existing code.

### Saving with corrected type
If the user corrects the type, the import must create the right record:
- recipe: creates a recipes row, redirects to /recipe/[id]
- technique: creates a techniques row, redirects to /technique/[id]

The import endpoint must accept a contentType override in the request body
and use it instead of the AI classification when provided.

---

## AUDIT 1 — Tags completeness gate: intentional or false positive?

### Context
A YouTube-imported recipe shows a banner: "This recipe is missing tags"
This suggests tags are part of the completeness gate. This was NOT in the
original completeness gate spec and was NOT in lib/recipeCompleteness.ts
as written in Prompt G.

### Investigation steps

1. Open lib/recipeCompleteness.ts and check whether tags are included in
   the completeness check. If yes, was this intentional or did the agent add
   it without being asked?

2. Check the RefreshFromSourceBanner component, what conditions trigger
   the "missing tags" message? Is there a separate banner for tags, or is tags
   part of the completeness helper?

3. Query the affected recipe to see its actual tag state:
```sql
SELECT id, title, tags, cuisine
FROM recipes
WHERE title LIKE '%Michelin Stock%'
LIMIT 1;
```

### Decision
Tags are NOT part of the completeness gate for the purposes of blocking
a recipe from being made public. Tags are helpful but not required.

If tags are in the completeness helper: Remove them. The gate is:
- title
- description
- 2+ ingredients with quantities
- 1+ steps

Tags do not block publishing.

If tags are in a separate banner (not the completeness helper): The banner
can stay as a helpful nudge, but:
- Tags missing should NOT show the red pill on the recipe card
- Tags missing should NOT block the recipe from being made public
- Update the pill logic to only trigger on the real completeness gate items above

Report what you find and apply the appropriate fix.

---

## IMPLEMENTATION ORDER
1. Audit tags gate, query DB, inspect recipeCompleteness.ts and banner component
2. Fix tags gate if needed (remove from completeness helper or decouple from pill/enforcement)
3. Implement YouTube classification confirmation dialog (web Import & Scan page)
4. Add API classify-first endpoint or param (whichever option chosen)
5. Add extension redirect notice (?new=1 one-time banner)
6. TypeScript check: cd apps/web && npx tsc --noEmit, must be clean
7. Deploy per deployment.md

---

## GUARDRAILS
- Use ChefsDialog for the confirmation dialog, never native browser confirm/alert
- Do NOT change how non-YouTube imports work
- Do NOT add the confirmation dialog to the extension (web only)
- Tags must NOT block publishing or trigger the status pill
- The corrected content type must flow through to the correct DB table
  (recipe to recipes table, technique to techniques table), never save to the wrong table

---

## TESTING REQUIREMENTS
1. Import a YouTube technique URL via web Import & Scan, confirmation dialog appears,
   AI suggests "Technique", user confirms, redirects to technique detail
2. Import a YouTube recipe URL, AI suggests "Recipe", user selects "No, it's a Technique",
   saved as technique, redirects to technique detail
3. Import via extension, redirects to detail page with ?new=1, one-time notice appears,
   navigate away and back, notice does NOT appear again
4. A recipe with no tags but complete ingredients/steps shows NO pill and can be made public
5. A recipe with no ingredients still shows the pill and cannot be made public

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Which API option was chosen (A or B) and why
- What the tags audit found (was tags in the helper? separate banner?)
- Confirmation tags no longer block publishing or trigger pill
- tsc clean + deploy confirmed
