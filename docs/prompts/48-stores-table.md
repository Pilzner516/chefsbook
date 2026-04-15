# ChefsBook — Session 48: Stores Table + Store Dropdown for Shopping Lists
# Source: Feature request 2026-04-10
# Target: apps/mobile + apps/web + packages/db

---

## CROSS-PLATFORM REQUIREMENT — READ FIRST

This feature MUST be implemented on BOTH platforms:
- `apps/mobile` — React Native / Expo
- `apps/web` — Next.js

Both must be fully working before /wrapup.
Read .claude/agents/ui-guardian.md and .claude/agents/data-flow.md before starting.
Run both pre-flight checklists before writing any code.

---

## CONTEXT

Currently when creating a new shopping list, the store name is a free-text input.
This session replaces it with a dropdown of previously saved stores (with logos)
plus a "New store..." option. Stores are saved in a dedicated `stores` table so
logos are fetched once and reused.

---

## DB CHANGES

Migration `024_stores_table.sql`:

```sql
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,              -- e.g. "wholefoodsmarket.com" for logo lookup
  logo_url TEXT,            -- cached from logo.dev
  initials TEXT,            -- e.g. "WF", "SR" — computed fallback
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lower(name))
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own stores"
  ON stores FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add store_id FK to shopping_lists
ALTER TABLE shopping_lists
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- Backfill: create store records from existing shopping_lists.store_name
-- (agent should run this after creating the table)
INSERT INTO stores (user_id, name, initials)
SELECT DISTINCT
  user_id,
  store_name,
  upper(regexp_replace(
    array_to_string(
      ARRAY(SELECT left(word, 1) FROM unnest(string_to_array(store_name, ' ')) AS word
            WHERE length(word) > 2 LIMIT 3),
    '')),
  'WF')  -- fallback
FROM shopping_lists
WHERE store_name IS NOT NULL AND store_name != ''
ON CONFLICT (user_id, lower(name)) DO NOTHING;
```

Apply migration to RPi5.

---

## DB QUERIES — packages/db

Add to `@chefsbook/db`:

```ts
// Get all stores for the current user, ordered by most recently used
export async function getUserStores(userId: string): Promise<Store[]>

// Create a new store, fetching logo from logo.dev
export async function createStore(params: {
  userId: string;
  name: string;
}): Promise<Store>

// Update store with fetched logo URL
export async function updateStoreLogo(storeId: string, logoUrl: string): Promise<void>
```

### Logo fetching
When a new store is created, attempt to fetch its logo:

```ts
// Compute domain from store name (best-effort):
const KNOWN_DOMAINS: Record<string, string> = {
  'whole foods': 'wholefoodsmarket.com',
  'shoprite': 'shoprite.com',
  'trader joes': 'traderjoes.com',
  'stop and shop': 'stopandshop.com',
  'costco': 'costco.com',
  'target': 'target.com',
  'walmart': 'walmart.com',
  'kroger': 'kroger.com',
  'publix': 'publix.com',
  'wegmans': 'wegmans.com',
  'aldi': 'aldi.us',
  'deciccos': 'diciccos.com',
};

const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
const domain = KNOWN_DOMAINS[key] ?? `${key}.com`; // fallback guess

const logoUrl = `https://img.logo.dev/${domain}?token=pk_EXpCeGY3QxS0VKVRKTr_pw`;
// Test if logo loads — if 200, save it. If not, leave logo_url null (use initials)
```

Initials computation:
```ts
function computeInitials(name: string): string {
  return name
    .split(' ')
    .filter(w => w.length > 2)
    .slice(0, 3)
    .map(w => w[0].toUpperCase())
    .join('');
}
// "Whole Foods" → "WF", "ShopRite" → "SR", "Trader Joe's" → "TJ"
```

---

## THE STORE PICKER UI

Replace the current store text input in the new shopping list flow with a store
picker dropdown/sheet.

### Layout

```
┌─────────────────────────────────────────┐
│  New Shopping List                      │
│─────────────────────────────────────────│
│  Select a store                         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  [WF logo] Whole Foods          │    │
│  ├─────────────────────────────────┤    │
│  │  [SR logo] ShopRite             │    │
│  ├─────────────────────────────────┤    │
│  │  [TJ logo] Trader Joe's         │    │
│  ├─────────────────────────────────┤    │
│  │  [+]       New store...         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  List name (optional)                   │
│  ┌─────────────────────────────────┐    │
│  │  Whole Foods                    │    │  ← auto-filled from store selection
│  └─────────────────────────────────┘    │
│                                         │
│  [Cancel]              [Create List]    │
└─────────────────────────────────────────┘
```

### Behaviour
- Load user's stores from `getUserStores()` on mount
- Each store row shows: `StoreAvatar` (logo or initials badge) + store name
- Tapping a store selects it and auto-fills the list name with the store name
  (user can still edit the list name)
- "New store..." row at the bottom opens an inline text input:
  ```
  ┌─────────────────────────────────┐
  │  Store name: [________________] │
  │  [Cancel]          [Add Store]  │
  └─────────────────────────────────┘
  ```
  On "Add Store": call `createStore()`, fetch logo in background, add to the
  dropdown list, and select it automatically
- If user has no stores yet: show "New store..." as the only option and open
  the text input immediately

### StoreAvatar component
Already built in session 03. Reuse it exactly:
- Shows logo if `logo_url` is available and loads successfully
- Falls back to initials badge (coloured circle, white initials text)
- Size: 36px in the dropdown rows

---

## LINKING LISTS TO STORES

When creating a shopping list, save `store_id` alongside `store_name`:

```ts
await createShoppingList({
  name: listName,
  store_name: selectedStore.name,  // keep for backwards compat
  store_id: selectedStore.id,       // new FK
  user_id: currentUser.id
});
```

---

## APPLY TO BOTH CONTEXTS

This store picker must appear in ALL places where a new shopping list is created:
1. Shopping list screen → "New list" button (mobile + web)
2. Meal plan day → "Add to cart" → "New list" option (mobile + web)
3. Recipe detail → "Add to shopping list" → "New list" option (mobile + web)

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

- [ ] Migration 024 applied to RPi5
- [ ] Backfill run — existing store names from shopping_lists migrated to stores table
- [ ] `getUserStores()`, `createStore()`, `updateStoreLogo()` in packages/db
- [ ] `StoreAvatar` reused correctly (logo + initials fallback)
- [ ] Store picker dropdown shown in new list creation flow
- [ ] Existing stores load with logos/initials
- [ ] "New store..." option adds to stores table and selects automatically
- [ ] Logo fetched from logo.dev on store creation (initials fallback if not found)
- [ ] List name auto-filled from selected store name (editable)
- [ ] `store_id` saved on shopping_lists alongside `store_name`
- [ ] Store picker appears in all 3 new list creation contexts (shopping, meal plan, recipe)
- [ ] Mobile + web both working
- [ ] Safe area insets on mobile sheet
- [ ] i18n keys for all new strings
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
