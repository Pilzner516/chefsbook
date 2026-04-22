# FIX — Search Page: Recipe Images Not Displaying
## Scope: apps/web search page and search query only

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/deployment.md`
6. `.claude/agents/ui-guardian.md` — MANDATORY
7. `.claude/agents/image-system.md` — MANDATORY
8. `.claude/agents/data-flow.md`

Run ALL pre-flight checklists before writing a single line of code.

---

## BUG

The search results page shows placeholder chef hat images instead of
actual recipe images. This is a regression — it started today.
My Recipes grid shows images correctly. Recipe detail pages show images
correctly. Only the search results page is affected.

---

## INVESTIGATION (do this before touching any code)

### Step 1 — Find the search page and its query
Locate:
- The search page component (likely `apps/web/app/search/page.tsx` or similar)
- The query it uses to fetch recipes (likely in `packages/db/src/queries/`)
- The recipe card component it uses to render results

### Step 2 — Compare with My Recipes (which works)
Find the My Recipes dashboard query (`listRecipes` or equivalent).
Compare side by side:
- Does the search query SELECT `image_url`? If not — that's the bug.
- Does the search card component pass the image through `proxyIfNeeded()`
  or `/api/image?url=` proxy? (REQUIRED for Supabase storage URLs per CLAUDE.md)
- Does the search card use the same `<RecipeImage>` or image component
  as the dashboard card?

### Step 3 — Check git log for today's changes
```bash
git log --since="2026-04-22 00:00" --oneline
```
Identify which of today's commits touched the search query or search
card component. That commit introduced the regression.

---

## FIX

Apply whichever fix the investigation reveals:

**If `image_url` missing from SELECT:** Add it to the search query.

**If proxy not applied:** Wrap image URL with `proxyIfNeeded()` or
pass through `/api/image?url=` — same as the dashboard card.

**If wrong image component:** Replace with the same image component
used by the working dashboard cards.

Do NOT rewrite the search page — surgical fix only.

---

## REGRESSION CHECKS — MANDATORY BEFORE DEPLOYING

After the fix, verify ALL of the following in the browser:
1. Search results show recipe images ✓
2. My Recipes grid still shows images ✓
3. Recipe detail page still shows images ✓
4. Search results show placeholder correctly for recipes with NO image ✓
5. Incomplete recipe pills still show on cards ✓

If ANY of these fail, do not deploy — fix first.

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Which commit introduced the regression (from git log)
- Exactly what was missing/wrong (field name, proxy, component)
- Confirmation all 5 regression checks passed
- tsc clean + deploy confirmed
