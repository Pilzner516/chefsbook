# ChefsBook — Session 75: Deduplicate Stores + Normalise Store Names
# Source: QA screenshot 2026-04-11 — "whole foods" and "Whole Foods" showing as separate groups
# Target: RPi5 DB + packages/db + apps/web + apps/mobile

---

## CONTEXT

The shopping list shows duplicate store groups for the same store because store
names are stored with different capitalisation ("whole foods" vs "Whole Foods").
This session deduplicates existing stores and prevents it happening again.

Read .claude/agents/data-flow.md and .claude/agents/deployment.md before starting.

---

## STEP 1 — Audit duplicate stores on RPi5

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase

# Show all stores:
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT id, name, logo_url, initials FROM stores ORDER BY lower(name);"

# Show shopping lists and their store references:
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT sl.name, sl.store_name, sl.store_id, s.name as store_record
   FROM shopping_lists sl
   LEFT JOIN stores s ON s.id = sl.store_id
   ORDER BY lower(sl.store_name);"
```

Identify all cases where the same store exists with different capitalisation
(e.g. "whole foods" and "Whole Foods").

---

## STEP 2 — Merge duplicate stores

For each duplicate pair, keep the one WITH a logo_url and delete the other.
Update shopping_lists to point to the surviving store record.

Example for "whole foods" / "Whole Foods":
```sql
-- Find the IDs:
SELECT id, name, logo_url FROM stores WHERE lower(name) = 'whole foods';

-- Keep the one with logo_url, get its ID (call it KEEP_ID)
-- Get the ID to delete (call it DELETE_ID)

-- Update shopping_lists to use the surviving store:
UPDATE shopping_lists
SET store_id = 'KEEP_ID', store_name = 'Whole Foods'
WHERE store_id = 'DELETE_ID' OR lower(store_name) = 'whole foods';

-- Update the surviving store name to title case:
UPDATE stores SET name = 'Whole Foods' WHERE id = 'KEEP_ID';

-- Delete the duplicate:
DELETE FROM stores WHERE id = 'DELETE_ID';
```

Run this for each duplicate pair found in Step 1.

---

## STEP 3 — Add deduplication constraint to stores table

```sql
-- Drop the existing unique constraint (case-sensitive):
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_user_id_name_key;
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_user_id_lower_name_key;

-- Add case-insensitive unique constraint:
CREATE UNIQUE INDEX IF NOT EXISTS stores_user_id_lower_name_unique
  ON stores (user_id, lower(name));
```

This prevents the same store name from being created twice regardless of
capitalisation.

---

## STEP 4 — Normalise store names to Title Case on creation

In `packages/db`, update `createStore()` to normalise the name:

```ts
function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function createStore(params: { userId: string; name: string }) {
  const normalisedName = toTitleCase(params.name.trim());
  // ... rest of function uses normalisedName
}
```

Also normalise in the store picker when the user types a new store name —
show a preview of how the name will be stored:
"This will be saved as: **Whole Foods**"

---

## STEP 5 — Normalise store_name on shopping_lists

The `store_name` text field on `shopping_lists` should also be normalised:

```sql
-- Update all existing store_name values to title case:
UPDATE shopping_lists
SET store_name = initcap(store_name)
WHERE store_name IS NOT NULL AND store_name != '';
```

And in `createShoppingList()` in packages/db, normalise the store_name:
```ts
store_name: toTitleCase(storeName.trim())
```

---

## STEP 6 — Update store grouping to use case-insensitive grouping

In the shopping list overview (web + mobile), group by `lower(store_name)`
to prevent visual duplicates even if normalisation missed something:

```ts
// Group key: normalised store name
const key = (list.store_name ?? '').toLowerCase().trim() || 'other';

// Display name: title case
const displayName = toTitleCase(list.store_name ?? '') || 'Other';
```

---

## TESTING

```bash
# Verify no duplicate stores remain:
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT lower(name), count(*) FROM stores GROUP BY lower(name) HAVING count(*) > 1;"
# Should return 0 rows

# Verify shopping lists use correct store:
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT sl.name, sl.store_name, s.name as store_record, s.logo_url IS NOT NULL as has_logo
   FROM shopping_lists sl
   LEFT JOIN stores s ON s.id = sl.store_id
   ORDER BY sl.store_name;"
```

On chefsbk.app:
- [ ] Shopping overview shows ONE "Whole Foods" group (not two)
- [ ] The surviving group has the Whole Foods logo (not ? initials)
- [ ] All lists appear under the single store group

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm dedupe
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] Duplicate stores identified via psql query
- [ ] Duplicate stores merged — surviving record has logo_url
- [ ] All shopping_lists updated to point to surviving store record
- [ ] Case-insensitive unique index added to stores table
- [ ] `createStore()` normalises name to Title Case
- [ ] `store_name` on shopping_lists normalised to Title Case
- [ ] Store grouping uses case-insensitive key
- [ ] No duplicate store groups visible on web or mobile
- [ ] Whole Foods shows logo (not ? initials)
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
