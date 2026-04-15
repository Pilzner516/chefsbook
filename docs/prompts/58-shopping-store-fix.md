# ChefsBook — Session 58: Fix Shopping List store_id + Null Store Join
# Source: DB investigation 2026-04-10
# Target: RPi5 DB + packages/db + apps/web + apps/mobile

---

## CONTEXT

Shopping lists have store_name populated but store_id is NULL for all existing
lists. The stores table was backfilled with store names but the FK link back to
shopping_lists was never set. Additionally the shopping list query likely uses
an INNER JOIN on stores which crashes when store_id is NULL.

Read .claude/agents/testing.md, .claude/agents/data-flow.md, and
.claude/agents/deployment.md before starting.

---

## STEP 1 — Verify current state

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase

# Check shopping lists:
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT id, name, store_name, store_id FROM shopping_lists LIMIT 10;"

# Check stores table:
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT id, name FROM stores LIMIT 10;"
```

Confirm store_id is NULL on existing lists and stores table has rows.

---

## STEP 2 — Backfill store_id on existing shopping lists

```bash
docker compose exec db psql -U postgres -d postgres -c "
UPDATE shopping_lists sl
SET store_id = s.id
FROM stores s
WHERE lower(trim(sl.store_name)) = lower(trim(s.name))
AND sl.store_id IS NULL
AND sl.store_name IS NOT NULL
AND sl.store_name != '';
"
```

Verify the backfill worked:
```bash
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT id, name, store_name, store_id FROM shopping_lists LIMIT 10;"
```

Lists with a matching store_name should now have store_id populated.
Lists with no store_name (e.g. 'Sunday meals') will remain with NULL store_id
— that is correct and expected.

---

## STEP 3 — Fix the shopping list query to use LEFT JOIN

In `packages/db`, find the function that fetches shopping lists
(likely `getShoppingLists()` or `getUserShoppingLists()`).

The store join MUST be a LEFT JOIN so lists with NULL store_id still load:

```ts
// Supabase JS client — correct pattern:
const { data } = await supabase
  .from('shopping_lists')
  .select(`
    *,
    store:stores(id, name, logo_url, initials)
  `)
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

In Supabase JS, `stores(...)` on a nullable FK automatically does a LEFT JOIN.
The `store` field will be `null` for lists with no store_id — this is correct.

---

## STEP 4 — Fix components to handle null store gracefully

### Web shopping list
In the shopping list overview, where store logo/name is displayed:

```tsx
// WRONG — crashes when store is null:
<StoreAvatar store={list.store} />
<span>{list.store.name}</span>

// CORRECT — graceful fallback:
<StoreAvatar store={list.store ?? null} />
<span>{list.store?.name ?? list.store_name ?? list.name}</span>
```

### Mobile shopping list
Same pattern — any component that reads `list.store.name` or
`list.store.logo_url` must use optional chaining.

### StoreAvatar component
Ensure it handles `store === null` without crashing:
```tsx
function StoreAvatar({ store }: { store: Store | null | undefined }) {
  if (!store) {
    // Show a generic shopping cart icon or blank avatar
    return <DefaultShoppingIcon size={36} />;
  }
  // ... rest of component
}
```

---

## STEP 5 — Also fix: opening individual list items

When a user taps a shopping list to open it, the list detail query also
needs to handle null store. Find `getShoppingListById()` or similar and
apply the same LEFT JOIN pattern.

Verify by opening:
1. A list WITH a store (ShopRite, Whole Foods) → opens correctly, shows logo
2. A list WITHOUT a store (Sunday meals, List3) → opens correctly, shows name only

---

## STEP 6 — TypeScript types

Update the `ShoppingList` type in `packages/db/src/types.ts`:

```ts
interface ShoppingList {
  id: string;
  name: string;
  store_name: string | null;
  store_id: string | null;
  store?: Store | null;  // ← nullable, not required
  // ... other fields
}
```

Any code using `list.store.name` (non-optional) will now show a TypeScript
error — fix each one with optional chaining `list.store?.name`.

---

## TESTING

```bash
# Verify backfill:
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT name, store_name, store_id FROM shopping_lists;"

# Verify stores table:
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT * FROM stores;"
```

On the live site:
- Open chefsbk.app → Shopping → tap "ShopRite" list → opens without crash
- Open "Sunday meals" list (no store) → opens without crash
- Both show items correctly

On mobile:
- Open shopping tab → tap any list → opens without crash

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] store_id backfilled for all lists that have matching store_name in stores table
- [ ] Lists with no store_name remain with NULL store_id (correct)
- [ ] Shopping list query uses LEFT JOIN (nullable store)
- [ ] StoreAvatar handles null store without crashing
- [ ] All list name displays use optional chaining (store?.name ?? fallback)
- [ ] TypeScript type has store as nullable
- [ ] tsc --noEmit passes both apps
- [ ] List WITH store opens correctly on web and mobile
- [ ] List WITHOUT store opens correctly on web and mobile
- [ ] Deployed to RPi5 and verified live on chefsbk.app
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
