# ChefsBook — Session 104: Fix Default Visibility + Duplicate Recipes in All List
# Source: Live review — imported recipes default to private, saved recipes show twice
# Target: apps/web + apps/mobile + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

Two distinct bugs to fix. Fix both completely. Do not mark complete until
both are verified with real data on RPi5.

---

## BUG 1 — Recipe default visibility is private, must be public

When a user imports, scans, or saves a recipe it defaults to 'private'.
It must default to 'shared_link' (visible to anyone with the link) or
'public' (visible to everyone).

Correct default: 'public'

### Fix:
1. Find every place a recipe is created in the codebase:
   - importFromUrl() API route
   - scanRecipe() flow
   - speakRecipe() flow
   - cloneRecipe() (saving someone else's recipe)
   - Manual recipe creation form
   - Any other addRecipe() call

2. For each: ensure the visibility field defaults to 'public' if not
   explicitly set

3. Check the DB schema — does the recipes table have a DEFAULT for
   the visibility column? If it defaults to 'private', change it:

```sql
ALTER TABLE recipes
  ALTER COLUMN visibility SET DEFAULT 'public';
```

4. Verify: import a new test recipe and confirm it appears as public
   without the PRIVATE badge

---

## BUG 2 — Saving a public recipe duplicates it in the All Recipes list

When User B saves/clones a public recipe from User A, it creates a new
recipe row owned by User B. The All Recipes search then shows BOTH:
- The original recipe (owned by User A)
- The clone (owned by User B)

This must never happen. Each unique recipe should appear ONCE in any
list or search results, regardless of how many users have saved it.

### The correct model:
- User A's recipe is the CANONICAL record
- User B saving it adds a row to recipe_saves (already exists) — it does
  NOT create a duplicate recipe row
- User B's "My Recipes" shows saved recipes via recipe_saves, not clones
- The All Recipes list shows only canonical recipes (original owners)

### Fix strategy:

**Option A — Preferred: use recipe_saves instead of cloneRecipe()**

Instead of cloning when a user saves a public recipe:
1. Insert a row into recipe_saves (recipe_id, user_id) — already exists
2. The saved recipe appears in the user's My Recipes via a JOIN on
   recipe_saves, not as a new recipe row
3. cloneRecipe() is only used for "Save a Copy" (where the user wants
   to edit their own version) — not for simply bookmarking

**Option B — If Option A requires too many changes:**
Update the All Recipes query to deduplicate by original recipe:
- Add a `canonical_id` column: for clones, points to the original recipe_id;
  for originals, is NULL
- All Recipes filter: WHERE canonical_id IS NULL (show only originals)
- My Recipes for User B: shows recipes WHERE user_id = B OR id IN
  (SELECT recipe_id FROM recipe_saves WHERE user_id = B)

### Implementation steps:

1. SSH to RPi5 — check how many duplicate recipes exist:
```sql
-- Find recipes that are clones of other recipes
SELECT r.id, r.title, r.user_id, r.original_submitter_id,
       r.original_submitter_username, r.created_at
FROM recipes r
WHERE r.user_id != r.original_submitter_id
ORDER BY r.created_at DESC;
```

2. Review what cloneRecipe() currently does in packages/db

3. Review what the "Save to My Recipes" sticky bar does when clicked —
   does it call cloneRecipe() or insert into recipe_saves?

4. Decide on Option A or B based on current code structure

5. Fix the save flow so it does NOT create duplicate recipe rows

6. Fix the All Recipes query to never show the same recipe content twice

7. Fix My Recipes to show both owned recipes AND saved (bookmarked) recipes

8. Update recipe_saves to properly track which recipes a user has saved

9. The bookmark/save count icon on recipe detail must still work correctly
   (shows how many users have saved/bookmarked this recipe)

### Edge cases to handle:
- User B saves Recipe A → appears in User B's My Recipes, NOT duplicated in All
- User B does "Save a Copy" (explicit copy intent) → creates a new recipe,
  visible in All Recipes as a distinct recipe with User B as owner
- Version recipes: each version is a distinct recipe with its own row —
  versions DO appear separately but are linked via parent_recipe_id
- Deleting a saved (bookmarked) recipe removes it from My Recipes only,
  does not affect the original

---

## STEP 3 — Update feature-registry.md

- Update "Add to My Recipes" entry: clarify save = recipe_saves row,
  not a clone
- Update "Save a Copy" entry: clarify this is the explicit clone path
- Add note on default visibility: 'public'

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

- [ ] recipes table: visibility DEFAULT changed to 'public' in DB
- [ ] All recipe creation paths default to 'public'
- [ ] New imported recipe does not show PRIVATE badge
- [ ] Saving a public recipe does NOT create a duplicate recipe row
- [ ] All Recipes list shows each unique recipe exactly once
- [ ] My Recipes shows both owned + saved (bookmarked) recipes
- [ ] "Save a Copy" still works as explicit clone (distinct new recipe)
- [ ] Bookmark/save count still accurate
- [ ] Duplicate recipe rows from previous saves identified and cleaned up
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
