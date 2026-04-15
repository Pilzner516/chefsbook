# ChefsBook — Session 99: Fix Attribution Display + Backfill original_submitter
# Source: Session 95 incorrectly marked attribution as "no fix needed" — it is broken
# Target: apps/web + apps/mobile + database backfill

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

Session 95 claimed attribution was working but never tested it with a real recipe.
The Homemade Biscuits recipe only shows the source URL pill — the submitter pill
is missing. Root cause is likely NULL original_submitter_id on imported recipes.

Do NOT assume anything is working — verify every step with real data on RPi5.

---

## STEP 1 — Diagnose the data

SSH to RPi5 and run:

```sql
-- Check a specific recipe
SELECT id, title, original_submitter_id, original_submitter_username, source_url, user_id
FROM recipes
WHERE title ILIKE '%Biscuit%';

-- Check how many recipes are missing original_submitter
SELECT
  COUNT(*) as total,
  COUNT(original_submitter_id) as has_submitter,
  COUNT(source_url) as has_source_url,
  COUNT(*) - COUNT(original_submitter_id) as missing_submitter
FROM recipes;

-- Check pilzner's user_id and username
SELECT id, raw_user_meta_data->>'username' as username
FROM auth.users
WHERE email = 'a@aol.com';
```

Show the output before proceeding.

---

## STEP 2 — Backfill original_submitter for existing recipes

For all recipes where original_submitter_id IS NULL, the recipe was imported
before the attribution system existed. Backfill using the recipe owner:

```sql
-- Backfill original_submitter_id and original_submitter_username
-- for all recipes that are missing it, using the recipe owner's profile
UPDATE recipes r
SET
  original_submitter_id = r.user_id,
  original_submitter_username = up.username
FROM user_profiles up
WHERE r.user_id = up.id
  AND r.original_submitter_id IS NULL
  AND up.username IS NOT NULL;

-- Verify backfill
SELECT COUNT(*) as still_missing
FROM recipes
WHERE original_submitter_id IS NULL;
```

---

## STEP 3 — Verify the attribution component code

Find the attribution row component on both web and mobile recipe detail.
Confirm it:

1. Reads BOTH original_submitter_username AND source_url from the recipe
2. Shows the submitter pill when original_submitter_username is not null
3. Shows the source URL pill when source_url is not null
4. Shows BOTH side by side when both exist
5. The submitter pill displays @username and is non-interactive (locked)
6. The source URL pill displays the domain name and opens the URL in a new tab

If the component has any logic that shows only one OR the other, fix it to
show both simultaneously.

---

## STEP 4 — Live verification

After the backfill and any code fixes, verify on a real recipe:

1. Open chefsbk.app/recipe/[homemade-biscuits-id] as a logged-in user
2. Confirm BOTH pills appear: @pilzner pill AND preppykitchen.com pill
3. Confirm the source URL pill opens preppykitchen.com in a new tab
4. Confirm the submitter pill is not clickable/editable
5. Test on mobile emulator as well if possible

Do not mark this complete until you have visually confirmed both pills
appear together on a real recipe.

---

## STEP 5 — Update feature-registry.md

Change attribution status to reflect the actual state:
- If both pills now show correctly: mark LIVE with note "backfill applied session 99"
- Add note: "original_submitter must be backfilled for pre-session-31 recipes"

---

## DEPLOYMENT

Only needed if code changes were made to the attribution component:

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

- [ ] Diagnosed: confirmed original_submitter_id was NULL on imported recipes
- [ ] Backfill applied: all recipes now have original_submitter_id set from owner
- [ ] Zero recipes remaining with NULL original_submitter_id (where username exists)
- [ ] Attribution component verified: shows BOTH submitter pill AND source URL pill
- [ ] Homemade Biscuits recipe shows @pilzner pill + preppykitchen.com pill together
- [ ] Source URL pill opens original URL in new tab
- [ ] Submitter pill is locked/non-editable
- [ ] Same verified on mobile
- [ ] feature-registry.md updated
- [ ] Deployed to RPi5 if code changes were made
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from this prompt,
      what was left incomplete, and why.
