# ChefsBook — Session 182: Fix Import Zero Ingredients / PDF Fallback
# Target: apps/web/app/api/import/url/route.ts, packages/ai/src/importFromUrl.ts
# packages/ai/src/pdfFallback.ts (or equivalent)

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, .claude/agents/deployment.md,
.claude/agents/ai-cost.md, .claude/agents/import-pipeline.md, and
.claude/agents/import-quality.md before starting.
Run all pre-flight checklists.

## PROBLEM

A Sicilian Pizza Recipe was imported with zero ingredients. The recipe detail
page shows the banner: "This recipe is missing ingredients (minimum 2) — We can
re-fetch it from the original source and fill in the gaps."

This means:
1. The primary import extracted 0 or 1 ingredients from the source page
2. The PDF/fallback pipeline that should catch this and re-fetch did NOT run,
   OR ran and still returned 0 ingredients
3. The recipe was saved in an incomplete state and shown to the user

This is a recurring failure. Previous sessions (141, 145, 150) have addressed
parts of this — the same root cause keeps escaping. This session must find and
fix the actual break point, not patch over it.

---

## PART 1 — Diagnose the actual failure before touching any code

### Step 1 — Find the pizza recipe in the DB
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT id, title, source_url, is_complete, completeness_verdict,
         jsonb_array_length(ingredients) as ingredient_count,
         created_at
  FROM recipes
  WHERE title ILIKE '%sicilian%'
  ORDER BY created_at DESC
  LIMIT 5;
"
```

### Step 2 — Check import_attempts for this recipe
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT method, success, error_code, metadata, created_at
  FROM import_attempts
  WHERE recipe_id = '<id from step 1>'
  ORDER BY created_at ASC;
"
```
This shows exactly which import methods were tried and what failed.
If import_attempts is empty for this recipe, the logging itself is broken.

### Step 3 — Check what the source URL returns
```bash
curl -s -L "<source_url from step 1>" | grep -i "ingredient" | head -20
```
Confirm the source page actually has ingredients in its HTML.
If it does, the extractor is broken. If it doesn't (JS-rendered), PDF
fallback should have caught it.

Report all findings before writing any code.

---

## PART 2 — Trace the import pipeline for URL imports

Read apps/web/app/api/import/url/route.ts in full.

Map the actual flow:
1. Where does it attempt JSON-LD / structured data extraction?
2. Where does it call Claude (importFromUrl)?
3. Where is the completeness check (isActuallyARecipe / ingredient count)?
4. Where does the PDF fallback trigger?
5. Where does it give up and save an incomplete recipe?

Specifically look for:
- Is there an early return that saves the recipe before the fallback runs?
- Is the PDF fallback gated behind a condition that isn't being met?
- Is the 25,000 character content limit truncating the ingredients section?
- Is importFromUrl() returning a partial result that passes the completeness
  check with 0 ingredients?

Document the exact line numbers where each step happens.

---

## PART 3 — Fix the pipeline break

Based on Part 1 findings, fix the specific break. The most likely causes
based on history (do not assume — verify first):

### Cause A: PDF fallback not triggering
The condition to trigger PDF fallback may require ingredient_count < 2 but
the check may be running AFTER the recipe is already saved. Fix: run
completeness check BEFORE saving. If incomplete, run fallback BEFORE saving.
Only save once — with complete data or with explicit incomplete flag.

### Cause B: importFromUrl() returns empty ingredients silently
If Claude returns a valid JSON structure but with an empty ingredients array,
the pipeline may treat it as a success. Fix: add explicit validation that
ingredients.length >= 2 before treating an import as successful. If not met,
treat as a failed extraction and trigger fallback.

### Cause C: Content truncation cutting off ingredients
If the page content is truncated at 25,000 chars and ingredients appear after
that point, Claude never sees them. Fix: for truncated pages, prioritise
extracting the ingredients section before truncating. Look for structured
markers (schema.org, "Ingredients" heading) and ensure they are within the
sent content window.

### Cause D: isActuallyARecipe() passing but ingredients empty
The AI gate may be approving the recipe as a valid recipe even with 0
ingredients (because the page is clearly a recipe page). Fix: isActuallyARecipe()
must also verify ingredients.length >= 2 as part of its verdict, not just
whether the content looks like a recipe.

Apply whichever fix(es) the diagnosis in Parts 1-2 identifies.
Do not apply all four — only fix what is confirmed broken.

---

## PART 4 — Ensure import_attempts logging covers all paths

Check that every exit point from the import pipeline calls logImportAttempt().
Specifically:
- Successful import with complete data: logged ✓
- Successful import but incomplete (< 2 ingredients): logged with error_code
- PDF fallback triggered: logged as separate attempt
- PDF fallback succeeded: logged ✓
- PDF fallback failed: logged with error_code
- Total failure / exception: logged with error_code

If any path exits without logging, add it. This is how we diagnose future
failures without guessing.

---

## PART 5 — Regression test

After deploying, import the same Sicilian pizza URL (or a similar recipe-heavy
page that previously failed) and confirm:

```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT title,
         jsonb_array_length(ingredients) as ingredient_count,
         is_complete,
         completeness_verdict
  FROM recipes
  ORDER BY created_at DESC
  LIMIT 3;
"
```

ingredient_count must be >= 2. is_complete must be true.
If still failing, check import_attempts to see which step failed and why.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
rm -rf apps/web/.next
cd apps/web
NODE_OPTIONS=--max-old-space-size=1024 npx next build --no-lint 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] Diagnosed: import_attempts records found for the failed pizza recipe
- [ ] Diagnosed: source URL confirmed to have ingredients in HTML
- [ ] Diagnosed: exact break point in pipeline identified (which step failed)
- [ ] Fix applied to the confirmed root cause only
- [ ] import_attempts logging covers all exit paths
- [ ] Regression test: new import of same/similar URL returns >= 2 ingredients
- [ ] is_complete = true on the test import
- [ ] tsc --noEmit passes clean
- [ ] Deployed to RPi5 — chefsbk.app HTTP 200
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
