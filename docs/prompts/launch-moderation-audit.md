This is a DIAGNOSTIC ONLY session. No code changes. Report findings in DONE.md only.

## AGENTS TO READ FIRST
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/import-pipeline.md`
7. `.claude/agents/import-quality.md`
8. `.claude/agents/ai-cost.md`

---

## OBJECTIVE

Audit the entire AI moderation system to understand exactly what is and is not
currently being moderated. We need a complete picture before writing any new
moderation code.

---

## INVESTIGATION QUESTIONS

### Q1 — How does current moderation work?
- Find the moderation code. Search for: moderateRecipe, moderateComment,
  ai_recipe_verdict, moderation_status, copyright_review_pending
- For each moderation function found, document:
  - What triggers it (import? publish? edit? scheduled?)
  - What content it checks (which fields exactly)
  - What model it uses (Haiku / Sonnet)
  - What happens on a failed verdict (flagged? blocked? queued for proctor review?)
  - Where the result is stored (which table/column)

### Q2 — What user-generated content is currently NOT moderated?
Check each of the following and report YES (moderated) or NO (not moderated):

- Recipe title (user edits after import)
- Recipe description (user edits after import)
- Recipe tags (user-created, free text)
- Recipe notes (user-edited)
- Recipe ingredients (user-edited)
- Recipe steps (user-edited)
- Comments (user-written)
- Cookbook name (user-created)
- Cookbook description (user-created)
- Chef profile bio (user-written)
- Chef profile display name (user-written)

For each unmoderated field, also note:
- Is it publicly visible? (yes/no)
- Can it be edited after the recipe/profile is already public? (yes/no)

### Q3 — Tags specifically
- Is there any tag validation or filtering at the point of tag creation?
- Are tags stored in a separate table or as a JSONB array on recipes?
  Run: `\d recipes` and `\d tags` (if exists)
- Can a user create a tag with any text content, including offensive terms?
- Do tags appear on public recipe pages visible to all members?

### Q4 — Moderation trigger timing
- Does moderation run BEFORE a recipe goes public, or AFTER?
- If a user edits a field after the recipe is already public, does moderation
  re-run on the edited content?
- Is there any re-moderation on edit?

### Q5 — Comment moderation
- Find the comment moderation code
- Does it run on every comment or only on flagged ones?
- What fields does it check (comment text only, or also username/metadata)?
- Is it blocking (comment held until approved) or non-blocking (comment posts,
  then gets reviewed)?

### Q6 — Current moderation gaps summary
Based on your findings, list every publicly visible user-input field that has
NO moderation, in priority order (most visible/risky first).

---

## SQL QUERIES TO RUN

```sql
-- Check recipes table moderation columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'recipes'
AND column_name IN (
  'ai_recipe_verdict', 'moderation_status', 'copyright_review_pending',
  'flagged', 'tags'
);

-- Check comments table structure
\d recipe_comments

-- Check if tags table exists separately
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'tags'
);

-- Check user_profiles for moderation columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name LIKE '%moderat%'
   OR column_name LIKE '%flag%'
   OR column_name LIKE '%review%';

-- Sample some user-created tags to see what's in there
SELECT DISTINCT jsonb_array_elements_text(tags) as tag
FROM recipes
WHERE tags IS NOT NULL
ORDER BY tag
LIMIT 50;
```

---

## DELIVERABLE

A findings report in DONE.md covering all 6 questions above, structured as:

1. How current moderation works (trigger, fields checked, model, outcome, storage)
2. Full table: each user-input field → moderated YES/NO → publicly visible YES/NO
   → re-moderated on edit YES/NO
3. Tags: storage, validation, public visibility
4. Moderation trigger timing
5. Comment moderation details
6. Prioritised list of moderation gaps

No code changes. Diagnosis only.
