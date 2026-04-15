# ChefsBook — Session 54: Fix Shopping Cart Crash
# Source: QA 2026-04-10 — opening any shopping list crashes the web app
# Target: apps/web

---

## CONTEXT

Opening any shopping list on the web app throws a client-side exception and shows
the Next.js error screen. No list can be opened.

Read .claude/agents/testing.md and .claude/agents/deployment.md before starting.

---

## STEP 1 — Get the actual error

Before touching any code, get the exact error from the browser console:

Option A — Check browser console on chefsbk.app:
Open a shopping list → error screen appears → open DevTools (F12) → Console tab.
Read the full error message and stack trace.

Option B — Check PM2 logs on RPi5:
```bash
ssh rasp@rpi5-eth
pm2 logs chefsbook-web --lines 50
```

Option C — Check Next.js error details:
The error screen says "see the browser console" — the console will have the
specific JavaScript error that caused the crash. It will be one of:
- A TypeError (undefined property access)
- A missing field on the shopping list or store object
- A failed Supabase query returning unexpected data
- A type mismatch from the new stores table join

Paste the exact error into DONE.md before fixing anything.

---

## STEP 2 — Likely causes (check in order)

### Cause A — New stores table join failing
Session 48 added `store_id` FK and `StorePickerDialog`. The shopping list query
likely now tries to join `stores` but the join syntax or column name is wrong,
causing a runtime crash when the component tries to read `list.store?.name`.

Check the shopping list fetch query in `@chefsbook/db`. If it joins stores:
```ts
// Verify this doesn't crash when store_id is null:
const { data } = await supabase
  .from('shopping_lists')
  .select('*, stores(*)')  // ← this fails if store_id is NULL for old lists
  .eq('user_id', userId);
```

Fix: make the join safe for null store_id:
```ts
.select('*, store:stores(id, name, logo_url, initials)')
// Handle null store gracefully in the component:
const storeName = list.store?.name ?? list.store_name ?? 'Shopping List';
```

### Cause B — StoreAvatar component crashing
The `StoreAvatar` component may be crashing when `logo_url` is null or when
the store object itself is null/undefined.

Check `StoreAvatar` — ensure it handles all null cases:
```tsx
function StoreAvatar({ store }: { store: Store | null }) {
  if (!store) return <DefaultAvatar />;
  if (!store.logo_url) return <InitialsAvatar initials={store.initials ?? '?'} />;
  return <img src={store.logo_url} onError={() => showInitials()} />;
}
```

### Cause C — New columns missing from TypeScript types
Sessions 48-50 added `store_id`, `store_name` changes etc. If the TypeScript
`ShoppingList` type doesn't include these, accessing them throws at runtime
in strict mode.

Check `packages/db/src/types.ts` or wherever `ShoppingList` is defined.
Add any missing fields.

### Cause D — Migration not applied / column doesn't exist
If migration 024 wasn't fully applied to the Pi's DB, queries referencing
`store_id` or the `stores` table will fail.

Verify:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c "\d shopping_lists"
docker compose exec db psql -U postgres -d postgres -c "\d stores"
```

Both tables must exist with the expected columns. If `stores` is missing,
apply migration 024 manually.

---

## STEP 3 — Fix and verify

After identifying and fixing the root cause:

1. Confirm TypeScript compiles: `tsc --noEmit` in apps/web
2. Deploy to RPi5:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

3. Test live:
- Open chefsbk.app → Shopping → tap any list → list opens without crash
- Confirm list items are visible
- Confirm store name/logo shows correctly (or graceful fallback)

4. Verify DB state:
```bash
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT id, name, store_name, store_id FROM shopping_lists LIMIT 5;"
```

---

## COMPLETION CHECKLIST

- [ ] Exact error from browser console documented in DONE.md
- [ ] Root cause identified (not guessed)
- [ ] Shopping list query handles null store_id gracefully
- [ ] StoreAvatar handles null store/logo_url without crashing
- [ ] TypeScript types include all new columns
- [ ] Migration 024 confirmed applied (stores table exists on RPi5)
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5 — build succeeded
- [ ] Opening any shopping list works without crash
- [ ] Store name/logo shows or falls back gracefully
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
