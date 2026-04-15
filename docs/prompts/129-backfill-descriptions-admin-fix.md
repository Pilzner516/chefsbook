# ChefsBook — Session 129: Backfill Missing Descriptions + Admin supabaseAdmin Fix
# Source: Deferred items from session 127 audit fixes
# Target: apps/web + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

Two deferred items from session 127. Both are independent — complete
both fully.

---

## FIX 1 — Backfill descriptions for 15 recipes missing them

### Diagnose
```sql
-- Find recipes missing description
SELECT id, title, cuisine, source_url,
  array_agg(ri.name ORDER BY ri.sort_order) as ingredients
FROM recipes r
LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
WHERE r.description IS NULL OR r.description = ''
GROUP BY r.id, r.title, r.cuisine, r.source_url
ORDER BY r.created_at;
```

Show the list before proceeding.

### Fix — Generate descriptions via Claude Haiku

For each recipe missing a description:
- If it has a source_url: attempt to re-fetch via importFromUrl() to
  extract the original description. If successful, use it.
- If no source_url OR fetch fails: generate a 1-2 sentence description
  using Claude Haiku from the recipe title + cuisine + first 5 ingredients

Haiku prompt:
"Write a single sentence description (max 30 words) for a recipe called
'{title}' ({cuisine} cuisine) that includes {ingredients}. Be specific
and appetizing. Return only the description, no quotes."

Create a script at scripts/backfill-descriptions.js:
- Loop through all recipes missing descriptions
- Rate limit: 1 per second (avoid API rate limits)
- Log each: "✓ Recipe: {title} → {description}"
- Update recipe in DB: UPDATE recipes SET description = '...' WHERE id = '...'
- At end: report how many were backfilled successfully

Run the script on RPi5 after creating it:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
node scripts/backfill-descriptions.js
```

Verify after:
```sql
SELECT COUNT(*) FROM recipes
WHERE description IS NULL OR description = '';
-- Should be 0
```

---

## FIX 2 — Remove supabaseAdmin from 2 admin server components

The audit found 2 admin server components that still import
supabaseAdmin directly. This violates the pattern established in
session 109 where ALL admin queries go through /api/admin route.

### Find the offending files
```bash
grep -r "supabaseAdmin" apps/web/app/admin \
  --include="*.tsx" --include="*.ts" \
  | grep -v "api/" | grep -v "route.ts"
```

Show the results before fixing.

### Fix
For each file found:
1. Identify which queries use supabaseAdmin
2. Add those queries as new actions in /api/admin/route.ts
   (following the existing GET/POST pattern)
3. Replace the direct supabaseAdmin calls in the component with
   adminFetch() or adminPost() calls to the API route
4. Remove the supabaseAdmin import from the component

### Verify
```bash
# After fix — should return nothing
grep -r "supabaseAdmin" apps/web/app/admin \
  --include="*.tsx" --include="*.ts" \
  | grep -v "api/" | grep -v "route.ts"
```

---

## DEPLOYMENT

Only needed if code changes were made (Fix 2):

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Only restart PM2 if build exits with code 0.
Note: do not run this build while other sessions are building on RPi5.

---

## COMPLETION CHECKLIST

- [ ] 15 recipes with missing descriptions identified via psql
- [ ] backfill-descriptions.js script created
- [ ] Script run on RPi5 — all descriptions backfilled
- [ ] Verified: 0 recipes with NULL or empty description
- [ ] 2 admin components with direct supabaseAdmin identified
- [ ] Queries moved to /api/admin/route.ts
- [ ] Components updated to use adminFetch/adminPost
- [ ] No supabaseAdmin imports remain in admin components
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5 if code changes made
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
