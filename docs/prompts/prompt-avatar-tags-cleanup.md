# Prompt: Avatar Sidebar Fix + Source Domain Tags Cleanup
# Launch: Read docs/prompts/prompt-avatar-tags-cleanup.md and execute it fully.

## OBJECTIVE
Two independent web fixes to run in the same session.

---

## FIX 1 — Avatar not showing in sidebar

### Symptom
The sidebar displays the user's email initial (letter avatar) instead of their profile photo.
The avatar image IS correctly stored in the Supabase `avatars` bucket and IS visible on the
Settings page — the sidebar just isn't loading it.

### Pre-flight
Read `.claude/agents/ui-guardian.md` before touching any component.

### What to do
1. Find the sidebar user display component (likely `components/Sidebar.tsx` or similar)
2. Find how the Settings page loads the avatar URL — replicate that pattern in the sidebar
3. The avatar URL pattern for self-hosted Supabase storage requires the `apikey` header
   (Kong gateway returns 401 without it). Check how `RecipeImage` or `EditImageGallery`
   loads images and follow the same pattern.
4. The avatar should appear as a small circle in the sidebar bottom section next to the
   user's display name
5. If avatar URL is null/empty, fall back to the letter initial (current behaviour) — no regressions

### Regression check
- Settings page avatar still shows correctly ✓
- Sidebar shows avatar image when one exists ✓
- Sidebar falls back to initial when no avatar ✓

---

## FIX 2 — Source domain tags appearing on recipe cards

### Symptom
Imported recipes have source domain names (`bonappetit.com`, `loveandlemons.com`,
`seriouseats.com`, etc.) stored in the `tags` array. These appear as clickable tag pills
on recipe cards and in search. They are import attribution artifacts — not real user tags.

### Root cause (likely)
The import pipeline is storing the source domain in both `source_url` AND `tags`.
Source attribution should live in `source_url` only.

### What to do

**PART A — Fix the import pipeline (prevent new occurrences)**

1. Read `import-pipeline.md` agent fully before touching any import code
2. Find where tags are assembled during URL import, scan import, and extension import
3. Identify the code that adds domain-like strings to tags (anything matching `*.com`, `*.org`, etc.)
4. Remove domain extraction from tag assembly — source URL is already stored separately
5. Also check `cookbookTOC` and extension import paths

**PART B — Clean up existing domain tags (root cause fix)**

Write and run a migration that removes domain-pattern tags from existing recipes:

```sql
-- Preview first (show count before changing anything)
SELECT COUNT(*) FROM recipes
WHERE EXISTS (
  SELECT 1 FROM unnest(tags) t
  WHERE t ~ '^[a-zA-Z0-9-]+\.(com|org|net|io|co|uk|fr|de|app)$'
);

-- Then clean (remove domain-pattern tags, preserve all other tags)
UPDATE recipes
SET tags = ARRAY(
  SELECT t FROM unnest(tags) t
  WHERE t !~ '^[a-zA-Z0-9-]+\.(com|org|net|io|co|uk|fr|de|app)$'
)
WHERE EXISTS (
  SELECT 1 FROM unnest(tags) t
  WHERE t ~ '^[a-zA-Z0-9-]+\.(com|org|net|io|co|uk|fr|de|app)$'
);
```

Show the preview count to the user before running the UPDATE.
Show the final count (should be 0) after running.

**PART C — Verify**
1. Import a new recipe from bonappetit.com
2. Check its tags — domain should NOT appear
3. Check source_url — should contain the bonappetit.com URL
4. Search for "bonappetit.com" in tags — should return 0 results

---

## GUARDRAILS
- Never remove legitimate user-added tags (e.g. "sourdough", "weeknight", "italian")
- The domain regex must only match strings that look like domains (dot + TLD), not words
- Show the SQL preview BEFORE running any UPDATE
- Do not change how source_url is populated — only tags

## TYPESCRIPT + DEPLOYMENT
1. `cd apps/web && npx tsc --noEmit` — must be clean
2. Deploy per `deployment.md`

## WRAPUP REQUIREMENT
DONE.md entry must include:
- How many recipes had domain tags removed (the preview count)
- Which import paths were fixed
- Avatar fix confirmed working (describe what you saw)
- tsc clean confirmed
- Deploy confirmed
