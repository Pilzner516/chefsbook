# ChefsBook — Session 108: Fix Savers Modal + Duplicate in My Recipes
# Source: Live review — savers modal stuck on loading, duplicate recipe still showing
# Target: apps/web + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

Two bugs. Diagnose with real DB data before touching any code.

---

## BUG 1 — Savers modal stuck on "Loading..."

Clicking the bookmark/save count opens a modal that says
"1 people saved this" but the list of savers never loads — stuck on
"Loading...".

### Diagnose:
1. Find the getSavers() function in packages/db
2. Run the underlying query directly on RPi5:
```sql
-- Check recipe_saves for Homemade Biscuits
SELECT rs.recipe_id, rs.user_id, up.username, up.id
FROM recipe_saves rs
JOIN user_profiles up ON up.id = rs.user_id
WHERE rs.recipe_id = (SELECT id FROM recipes WHERE title ILIKE '%Biscuit%' LIMIT 1);
```
3. Check if getSavers() uses supabaseAdmin or anon client
4. Check if the modal component has a missing error handler leaving
   it in loading state on failure

### Fix:
- Ensure getSavers() uses supabaseAdmin (service role) to bypass RLS
- Add error handling — if fetch fails, show "Could not load savers"
  instead of spinning forever
- Fix the loading state: always set loading = false in both success
  and catch paths

### Grammar fix:
"1 people saved this" → "1 person saved this"
Use proper pluralization: "N people saved this" when N ≠ 1,
"1 person saved this" when N = 1.

---

## BUG 2 — Duplicate Homemade Biscuits in My Recipes

Session 104 reported converting the clone to a recipe_saves row and
deleting the duplicate. But two Homemade Biscuits still show in My
Recipes — one with 0 saves and one with 1 save (the bookmark).

### Diagnose:
```sql
-- Find all Homemade Biscuits recipes
SELECT id, title, user_id, original_submitter_id, save_count,
       created_at, visibility
FROM recipes
WHERE title ILIKE '%Biscuit%'
ORDER BY created_at;

-- Check recipe_saves for biscuits
SELECT * FROM recipe_saves
WHERE recipe_id IN (
  SELECT id FROM recipes WHERE title ILIKE '%Biscuit%'
);

-- Check which user owns what
SELECT r.id, r.title, r.user_id, up.username, r.save_count
FROM recipes r
JOIN user_profiles up ON up.id = r.user_id
WHERE r.title ILIKE '%Biscuit%';
```

### Expected correct state:
- ONE recipe row for Homemade Biscuits (owned by pilzner)
- ONE recipe_saves row (linking seblux to that recipe)
- My Recipes for seblux shows both:
  - Recipes owned by seblux (user_id = seblux)
  - Recipes saved by seblux (id IN recipe_saves WHERE user_id = seblux)
- My Recipes must NOT show the same recipe twice even if the user
  both owns a version AND has saved the original

### Fix:
1. If a duplicate recipe row still exists — delete it and create the
   correct recipe_saves row instead
2. Update listRecipes() and search_recipes RPC to deduplicate:
   use UNION or DISTINCT to ensure a recipe never appears twice
   even if it matches both the "owned" and "saved" criteria
3. Verify: My Recipes for seblux shows Homemade Biscuits exactly once

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Only restart PM2 if build exits with code 0.

---

## COMPLETION CHECKLIST

- [ ] Savers modal loads the list correctly (not stuck on Loading)
- [ ] getSavers() uses supabaseAdmin
- [ ] Error state shown if savers fetch fails
- [ ] "1 person saved this" / "N people saved this" correct pluralization
- [ ] Only ONE Homemade Biscuits in My Recipes for both pilzner and seblux
- [ ] Duplicate recipe row deleted from DB if still present
- [ ] listRecipes() and search_recipes deduplicate owned + saved recipes
- [ ] recipe_saves row for seblux → Homemade Biscuits confirmed in DB
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
