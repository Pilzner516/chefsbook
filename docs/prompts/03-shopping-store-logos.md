# ChefsBook — Session: Shopping List — Store System & Logos
# Source: QA Report 2026-04-07 · Items 3, 4
# Target: apps/mobile (primary), apps/web (parity — flag changes needed)

---

## CONTEXT

The shopping list system needs two interconnected upgrades:
1. **Store-first list creation** — lists belong to a specific store, not just a name; multiple lists per store are allowed; a concatenated "all items" list is auto-generated per store.
2. **Store logos** — each store displays its logo when available, falling back to an initials badge.

Read CLAUDE.md before starting. All DB changes must be applied via a new numbered migration in `packages/db/migrations/`.

---

## FEATURE 1 — Store-first list creation (Item 3)

### Current behaviour
"Add new shopping list" prompts only for a name. No store association.

### Target behaviour
Creating a new list asks the user to:
1. **Select or create a store** — show a scrollable list of existing stores with their logos/initials. Include a "New store…" option at the bottom that lets the user type a store name.
2. **Name the list** (optional) — defaults to the store name if left blank (e.g. "Whole Foods"). Useful when the user has multiple lists for the same store (e.g. "Whole Foods — Weekly", "Whole Foods — Pantry").

### DB schema changes

Add `store_name` column to `shopping_lists` if not already present (check existing migration 009). If it exists, ensure it's correctly wired. Add `store_id` FK if a separate `stores` table makes sense — but keep it simple: a `store_name` string on `shopping_lists` is sufficient for this session. A proper stores table can come later.

### Concatenated list

When a store has more than one list:
- Auto-generate a read-only virtual "All [Store Name]" entry at the top of that store's list group.
- This concatenated view merges all items across the store's lists.
- Quantity merging rules (same ingredient, same unit → sum quantities) already exist in `addItemsWithPipeline()` — reuse that logic for the concatenated view.
- The concatenated list is not saved to DB — it is computed on render from the existing lists.
- Unit conversion and recipe-count multiplication apply exactly as they do in the individual lists (same shared utility functions).
- Mark concatenated entries visually (e.g. subtle "Combined" pill or different row style) so the user knows this is a merged view.

### UI layout — Store grouping

In the shopping list overview screen:
- Group lists by store name.
- Each store group has a header row: store logo/initials badge + store name + list count.
- If the store has >1 list, show the concatenated "All [Store]" entry first in the group, then the individual named lists below it.
- Tapping a list opens the standard list detail view.
- Tapping the concatenated entry opens a read-only merged view with a clear "Combined view" label.

---

## FEATURE 2 — Store logos (Item 4)

### Behaviour

- When a store is created or first referenced, attempt to find and store a logo for that store.
- Logo lookup: search for `[store name] logo transparent PNG` using a Pexels or DuckDuckGo image search, **or** use a known CDN — see known logos list below.
- Store the logo URL (or downloaded asset) in `SecureStore` / `AsyncStorage` keyed by normalized store name (lowercase, no spaces).
- On subsequent uses, load from cache — no re-fetch needed.
- If no logo is found or the user is offline: show an initials badge — first letter of each word in the store name, uppercased (e.g. "Whole Foods" → `WF`, "ShopRite" → `SR`, "Trader Joe's" → `TJ`).
- Initials badge: circular or rounded-square, background color derived from the store name (consistent hash → color from palette), white initials text.

### Known store logos (hardcode these as a fallback map to avoid unnecessary network calls)

```ts
const KNOWN_STORE_LOGOS: Record<string, string> = {
  'whole foods': 'https://logo.clearbit.com/wholefoodsmarket.com',
  'shoprite': 'https://logo.clearbit.com/shoprite.com',
  'trader joes': 'https://logo.clearbit.com/traderjoes.com',
  'stop and shop': 'https://logo.clearbit.com/stopandshop.com',
  'costco': 'https://logo.clearbit.com/costco.com',
  'target': 'https://logo.clearbit.com/target.com',
  'walmart': 'https://logo.clearbit.com/walmart.com',
  'kroger': 'https://logo.clearbit.com/kroger.com',
  'publix': 'https://logo.clearbit.com/publix.com',
  'wegmans': 'https://logo.clearbit.com/wegmans.com',
  'aldi': 'https://logo.clearbit.com/aldi.us',
  'deciccos': 'https://logo.clearbit.com/diciccos.com',
};
```

Normalize the store name before lookup (lowercase, remove punctuation/apostrophes/`&`).

### Logo component

Create a reusable `StoreAvatar` component:
```
StoreAvatar({ storeName: string, size?: number })
```
- Tries the known logo map first, then cached URL, then renders initials badge.
- Uses `expo-image` (or `Image` from React Native) with error fallback to initials.
- Default size: 36px (list row), 48px (group header).

---

## WEB PARITY NOTE

Flag in a `// TODO(web):` comment anywhere the mobile shopping list store grouping logic is added, so the web parity session can replicate the same grouping and logo display in `apps/web/dashboard/shopping`.

---

## MIGRATION

Create `packages/db/migrations/012_shopping_store_system.sql` with:
- Any new columns on `shopping_lists` not already present (e.g. `store_name TEXT`, `store_display_name TEXT`)
- No breaking changes to existing columns
- RLS policies unchanged unless new columns need protection

Apply migration: `ssh rasp@rpi5-eth` → `cd /mnt/chefsbook/supabase` → `docker compose exec db psql -U postgres -d postgres -f /path/to/migration.sql`

---

## COMPLETION CHECKLIST

Before wrapping:
- [ ] Store selection step added to new list creation flow
- [ ] Lists grouped by store in overview screen
- [ ] Concatenated "All [Store]" view renders correctly for stores with multiple lists
- [ ] `StoreAvatar` component created with logo + initials fallback
- [ ] Known logo map hardcoded
- [ ] Logo cached in AsyncStorage on first load
- [ ] Migration file created and applied to RPi5 DB
- [ ] No regressions in existing list creation, item add, or shopping list detail
- [ ] Web parity TODOs commented where applicable
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
