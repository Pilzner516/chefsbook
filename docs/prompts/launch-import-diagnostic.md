Read AGENDA.md and find the import pipeline diagnostic item (Tier 1 #6).

This is a DIAGNOSTIC ONLY session. No code changes. No file edits except DONE.md at the end.

Your job is to investigate and report findings only. Follow these steps in order:

## AGENTS TO READ FIRST
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/import-pipeline.md`
6. `.claude/agents/import-quality.md`

---

## INVESTIGATION STEPS

### Step 1 — Query import_attempts for the affected recipe
Find all import_attempts rows for thekellykitchen.com (search by source_url LIKE
'%thekellykitchen%'). Report:
- The failure_reason for each attempt
- The scraped_content length (char count)
- Whether the word "ingredient" appears in the scraped_content
- The created_at timestamp of each attempt

```sql
SELECT id, source_url, failure_reason, length(scraped_content) as content_length,
       scraped_content LIKE '%ingredient%' as has_ingredient_text,
       created_at
FROM import_attempts
WHERE source_url LIKE '%thekellykitchen%'
ORDER BY created_at DESC;
```

If the table or columns have different names, inspect first: `\d import_attempts`

### Step 2 — Live fetch comparison
Make a plain GET request to the thekellykitchen.com Sicilian Pizza Dough URL right now
from the RPi5 and measure:
- HTTP status code
- Response content length
- Whether "bread flour" (a known ingredient) appears in the response body
- Whether JSON-LD (`application/ld+json`) is present in the response

```bash
curl -s -o /tmp/kelly_test.html -w "%{http_code} %{size_download}" \
  -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1)" \
  "https://www.thekellykitchen.com/sicilian-pizza/"

grep -c "bread flour" /tmp/kelly_test.html
grep -c "ld+json" /tmp/kelly_test.html
wc -c /tmp/kelly_test.html
```

Use the actual recipe URL from the import_attempts table.

### Step 3 — Check truncation boundary
The import pipeline has a 25,000 char limit. If the scraped content in import_attempts
is close to 25,000 chars, truncation is the likely culprit.
- Report the exact char count from Step 1
- If count is between 24,000–25,000: truncation confirmed
- Check where in the page the ingredients section appears relative to the 25,000 char boundary

### Step 4 — Check JSON-LD extraction
The pipeline uses JSON-LD-first extraction. Report:
- Does the thekellykitchen.com page have a JSON-LD recipe block?
- If yes: does it include ingredients? (Check the live fetch from Step 2)
- If JSON-LD has ingredients but they weren't imported, the bug is in the JSON-LD
  parser, not the scraper

### Step 5 — Scale check
Query how many recipes are currently marked incomplete (missing ingredients) and
have a source_url that is not null:

```sql
SELECT COUNT(*) as incomplete_with_source
FROM recipes
WHERE source_url IS NOT NULL
  AND (ingredients IS NULL OR jsonb_array_length(ingredients) < 2)
  AND deleted_at IS NULL;
```

Also get a sample of 10 affected source domains:
```sql
SELECT regexp_replace(source_url, '^https?://([^/]+).*', '\1') as domain,
       COUNT(*) as count
FROM recipes
WHERE source_url IS NOT NULL
  AND (ingredients IS NULL OR jsonb_array_length(ingredients) < 2)
  AND deleted_at IS NULL
GROUP BY domain
ORDER BY count DESC
LIMIT 10;
```

---

## DELIVERABLE

Write a findings report in DONE.md covering:
1. What the import_attempts table shows for this recipe (truncation? failure_reason?)
2. Whether the live fetch returns ingredients (is the page accessible right now?)
3. Whether JSON-LD is present and contains ingredients
4. The scale — how many recipes are affected
5. Your diagnosis: which of the three hypotheses (rate limiting, JS rendering, truncation)
   best fits the evidence
6. A recommended fix approach (one sentence) — but DO NOT implement it

No code changes. Diagnosis and report only.
