# ChefsBook — Session 198: Duplicate Detection + Canonical Recipe System
# Target: packages/db, packages/ai, apps/web (import flow, recipe detail, admin)

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, .claude/agents/deployment.md,
.claude/agents/import-pipeline.md, .claude/agents/import-quality.md,
.claude/agents/ai-cost.md, .claude/agents/ui-guardian.md, and
.claude/agents/feature-registry.md before starting.
Run all pre-flight checklists.

This is an overnight session. Work through all 6 parts in order.
Complete and verify each part before moving to the next.
Do not skip verification steps to save time.

---

## PART 1 — Database schema

### Migration 048

```sql
-- Duplicate detection fields on recipes
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_url_normalized TEXT;

-- Index for fast URL-based duplicate lookup
CREATE INDEX IF NOT EXISTS recipes_source_url_normalized_idx
  ON recipes (source_url_normalized)
  WHERE source_url_normalized IS NOT NULL;

-- Index for finding all duplicates of a canonical recipe
CREATE INDEX IF NOT EXISTS recipes_duplicate_of_idx
  ON recipes (duplicate_of)
  WHERE duplicate_of IS NOT NULL;

-- pg_trgm extension for fuzzy title matching (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index for fuzzy title similarity search
CREATE INDEX IF NOT EXISTS recipes_title_trgm_idx
  ON recipes USING gin (title gin_trgm_ops);
```

Apply on RPi5:
```bash
docker exec -it supabase-db psql -U postgres -f /path/to/migration
docker restart supabase-rest
```

Verify all columns exist before proceeding to Part 2.

---

## PART 2 — URL normalisation + duplicate detection function

### In packages/db/src/queries/duplicates.ts

Create the following functions:

**normalizeSourceUrl(url: string): string**
Strips UTM params, trailing slashes, normalizes www vs non-www, lowercases,
strips query strings that are tracking-only. Returns a clean comparable URL.
Examples:
- `https://www.seriouseats.com/recipe?utm_source=google` → `seriouseats.com/recipe`
- `https://seriouseats.com/recipe/` → `seriouseats.com/recipe`

**findDuplicateByUrl(normalizedUrl: string, excludeRecipeId?: string)**
Queries recipes where source_url_normalized = normalizedUrl AND visibility = 'public'.
Returns the matching recipe (id, title, image_url, user_id) or null.
Excludes the recipe being checked (for re-checks on existing recipes).

**findDuplicateByTitle(title: string, excludeRecipeId?: string)**
Uses pg_trgm similarity to find public recipes with title similarity > 0.85.
Returns up to 3 matches ordered by similarity descending.
Only checks public recipes.

**markAsDuplicate(recipeId: string, canonicalId: string)**
Sets duplicate_of = canonicalId, is_canonical = false, duplicate_checked_at = now()
on the given recipe.

**markAsCanonical(recipeId: string)**
Sets is_canonical = true, duplicate_of = null, duplicate_checked_at = now().

**checkAndMarkDuplicate(recipeId: string): { isDuplicate: boolean, canonicalId?: string }**
Runs both URL and title checks. If a match is found, calls markAsDuplicate()
and returns the canonical recipe ID. If no match, marks duplicate_checked_at
and returns { isDuplicate: false }.

Export all from packages/db.

---

## PART 3 — Duplicate check on import (before AI fires)

### In apps/web/app/api/import/url/route.ts

Before calling importFromUrl() (before any Sonnet/AI call):

1. Normalize the incoming URL via normalizeSourceUrl()
2. Call findDuplicateByUrl() against public recipes
3. If a match is found:
   - Return a 200 response with `{ duplicate: true, recipe: { id, title, image_url } }`
   - Do NOT proceed with import — no AI call, no image generation, no cost
4. If no match, proceed with import as normal
5. After import completes, save source_url_normalized to the new recipe row

### Duplicate interstitial UI

In the web import flow, handle the `duplicate: true` response by showing
an interstitial instead of redirecting to the new recipe:

```
┌────────────────────────────────────────────────┐
│  📖 This recipe is already in ChefsBook        │
│                                                │
│  [recipe thumbnail]  [recipe title]            │
│                      Already imported          │
│                                                │
│  [Add to My Recipes]      [Import anyway]      │
└────────────────────────────────────────────────┘
```

**"Add to My Recipes"** — creates a row in a new `saved_recipes` table
(recipe_id, user_id, saved_at) so the recipe appears in the user's
collection without creating a duplicate record. If saved_recipes table
already exists under a different name, use that.

**"Import anyway"** — proceeds with full import, skipping the duplicate check.
Add a flag to the request body so the route knows to skip the check.

Apply same duplicate check to apps/web/app/api/extension/import/route.ts.

---

## PART 4 — Canonical recipe system (when recipe goes public)

### Trigger: visibility change to public

In the route that handles recipe visibility changes
(wherever `visibility` is updated on a recipe), after saving:

If the new visibility is 'public':
1. Run checkAndMarkDuplicate() on the recipe
2. If a duplicate is found:
   - Keep the recipe as private (revert visibility change silently)
   - Return a response telling the UI to show the notice below
   - Do NOT show it in public feeds

### UI notice to recipe owner

When a recipe is reverted to private due to duplication, show a banner
on the recipe detail page (visible to owner only):

```
A similar public recipe already exists in ChefsBook.
Your recipe has been kept private in your collection.
[View the public version]   [Edit to make it unique]
```

"Edit to make it unique" — dismisses the banner and lets them edit.
After editing, they can try making it public again (re-runs the check).

### Canonical election rule

The canonical version is the public recipe that was published first.
When a new public recipe matches an existing one, the existing one is
always canonical — the new one is the duplicate.

If two private recipes both go public at the same time (race condition),
the one with the lower created_at wins canonical status.

---

## PART 5 — Public feed + search exclusion

Wherever public recipes are fetched for discovery, search, or public
chef profiles, add a filter:

```sql
AND (duplicate_of IS NULL OR is_canonical = true)
```

This ensures duplicates never appear in:
- Public discovery/search feeds
- Public chef profile recipe lists
- Any shared recipe views

The recipe still appears in the owner's private My Recipes collection.

Apply this filter to all relevant DB query functions in packages/db.
Check every public-facing query — do not miss any.

---

## PART 6 — Admin UI

### /admin/recipes — add Duplicates filter tab

Add a "Duplicates" tab/filter to the existing /admin/recipes page showing:
- All recipes with duplicate_of IS NOT NULL
- Each row shows: duplicate recipe title + owner, → canonical recipe title + owner
- Actions: Override (make this one canonical instead), Dismiss (clear duplicate flag)
- KPI card at top: total duplicate count

### /admin/recipes — canonical badge

On the main recipe list, show a small "Canonical" badge on recipes where
is_canonical = true, and a "Duplicate" badge (red) on recipes where
duplicate_of IS NOT NULL.

---

## VERIFICATION

### Part 1
```bash
docker exec -it supabase-db psql -U postgres -c "\d recipes" | grep -E "duplicate|canonical|normalized"
# Must show all 4 new columns
```

### Part 2
```bash
# Test URL normalization (unit test in the function itself or via tsx)
# Test similarity search directly in psql:
docker exec -it supabase-db psql -U postgres -c "
  SELECT title, similarity(title, 'Sicilian Pizza') as sim
  FROM recipes
  WHERE similarity(title, 'Sicilian Pizza') > 0.5
  ORDER BY sim DESC LIMIT 5;
"
```

### Part 3
Import a URL that already exists in the DB.
The response must be the duplicate interstitial — not a new recipe created.
Check no new recipe row was created:
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT COUNT(*) FROM recipes WHERE created_at > NOW() - INTERVAL '5 minutes';
"
# Must be 0 after a duplicate import attempt
```

### Part 4
Set a recipe to public that has the same source_url_normalized as an
existing public recipe. Confirm it stays private and the owner sees the notice.

### Part 5
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT title, duplicate_of, is_canonical
  FROM recipes
  WHERE visibility = 'public'
  AND duplicate_of IS NOT NULL;
"
# Should return 0 rows — no duplicates visible in public feed
```

### Part 6
Navigate to /admin/recipes — Duplicates tab must show any flagged recipes.

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

Build must exit 0 before restarting PM2.
Verify after restart:
```bash
curl -o /dev/null -s -w "%{http_code}" https://chefsbk.app
curl -o /dev/null -s -w "%{http_code}" https://chefsbk.app/admin/recipes
# Both must return 200
```

---

## COMPLETION CHECKLIST

- [ ] Migration 048 applied — all 4 columns + 3 indexes exist
- [ ] normalizeSourceUrl() implemented and tested
- [ ] findDuplicateByUrl() queries public recipes by normalized URL
- [ ] findDuplicateByTitle() uses pg_trgm similarity > 0.85
- [ ] checkAndMarkDuplicate() runs both checks and marks result
- [ ] All functions exported from packages/db
- [ ] URL import route checks for duplicates before any AI call
- [ ] Extension import route checks for duplicates before any AI call
- [ ] Duplicate interstitial shown on web with Add/Import options
- [ ] "Add to My Recipes" saves reference without creating duplicate record
- [ ] source_url_normalized saved on all new imports
- [ ] Visibility change to public triggers duplicate check
- [ ] Duplicate recipes reverted to private with owner notice
- [ ] Owner notice shows "View public version" and "Edit to make unique" options
- [ ] Public feed queries exclude duplicate_of IS NOT NULL recipes
- [ ] Search results exclude duplicates
- [ ] /admin/recipes Duplicates tab shows flagged recipes with override/dismiss
- [ ] Canonical badge shown on admin recipe list
- [ ] tsc --noEmit passes clean on apps/web
- [ ] Deployed to RPi5 — chefsbk.app + /admin/recipes HTTP 200
- [ ] TYPE: CODE FIX — no data-only patches
- [ ] Run /wrapup
