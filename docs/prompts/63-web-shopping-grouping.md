# ChefsBook — Session 63: Web Shopping List — Store Grouping + Logos
# Source: Feature parity with mobile 2026-04-11
# Target: apps/web (dashboard/shop page only)

---

## CONTEXT

The mobile shopping list already groups lists by store with store logos.
The web version shows a flat list with no grouping. This session brings the
web shopping overview to full parity with mobile.

Read .claude/agents/ui-guardian.md, .claude/agents/image-system.md, and
.claude/agents/deployment.md before starting.

---

## TARGET LAYOUT

```
Shopping Lists

┌─────────────────────────────────────────┐
│  [WF logo]  Whole Foods          2 lists │  ← store group header
├─────────────────────────────────────────┤
│  📋 All Whole Foods  (combined)          │  ← concatenated view, shown first
│  📋 Whole Foods — Weekly                │
│  📋 Whole Foods — Pantry                │
├─────────────────────────────────────────┤
│  [SR logo]  ShopRite             1 list  │  ← store group header
├─────────────────────────────────────────┤
│  📋 ShopRite                            │
├─────────────────────────────────────────┤
│  [No store]  Other               2 lists │  ← lists with no store
├─────────────────────────────────────────┤
│  📋 Sunday meals                        │
│  📋 List3                               │
└─────────────────────────────────────────┘
                              [+ New List] │
```

---

## GROUPING LOGIC

```ts
// Group lists by store_name (or 'Other' if null/empty):
const grouped = lists.reduce((acc, list) => {
  const key = list.store_name ?? 'Other';
  if (!acc[key]) acc[key] = [];
  acc[key].push(list);
  return acc;
}, {} as Record<string, ShoppingList[]>);

// Sort: stores with logos first, 'Other' last
const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
  if (a === 'Other') return 1;
  if (b === 'Other') return -1;
  return a.localeCompare(b);
});
```

---

## STORE GROUP HEADER

Each store group has a header row:
```tsx
<div className="store-group-header">
  <StoreAvatar store={storeForThisGroup} size={36} />
  <span className="store-name">{storeName}</span>
  <span className="list-count">{lists.length} list{lists.length > 1 ? 's' : ''}</span>
</div>
```

Reuse the existing `StoreAvatar` component from session 48.
For the "Other" group: show a generic shopping bag icon instead of StoreAvatar.

---

## CONCATENATED "ALL [STORE]" VIEW

When a store has more than 1 list, show a combined entry at the top of that
store's group:

```tsx
{lists.length > 1 && (
  <div
    className="list-row concatenated"
    onClick={() => openConcatenatedView(storeName, lists)}
  >
    <span>📋 All {storeName}</span>
    <span className="badge">Combined</span>
  </div>
)}
```

The concatenated view merges all items across the store's lists:
- Same quantity merging as `addItemsWithPipeline()` (sum quantities for same ingredient)
- Department grouping applied
- Read-only — no editing in concatenated view
- Clearly labelled "Combined view — all [store] lists"
- A banner at the top: "Showing combined items from [N] lists"

---

## STORE AVATAR ON WEB

The `StoreAvatar` component was built for mobile. Check if a web version exists.
If not, create a simple web equivalent in `apps/web/components/StoreAvatar.tsx`:

```tsx
export function StoreAvatar({ store, size = 36 }: {
  store: Store | null | undefined;
  size?: number;
}) {
  const [logoError, setLogoError] = useState(false);

  if (!store || logoError || !store.logo_url) {
    // Initials fallback
    const initials = store?.initials ?? store?.name?.slice(0, 2).toUpperCase() ?? '?';
    const bg = stringToColor(store?.name ?? '');
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: bg, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 600, flexShrink: 0
      }}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={store.logo_url}
      alt={store.name}
      width={size}
      height={size}
      style={{ borderRadius: '50%', objectFit: 'contain', flexShrink: 0 }}
      onError={() => setLogoError(true)}
    />
  );
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#ce2b37', '#009246', '#1a73e8', '#f4a01c', '#7c3aed', '#0891b2'];
  return colors[Math.abs(hash) % colors.length];
}
```

Note: Store logo URLs are from logo.dev and do NOT go through the Supabase
image proxy. They are external URLs and load directly.

---

## "NEW LIST" BUTTON

Move the "+ New List" button to a fixed position at the bottom-right of the
shopping page (or keep it in the header — match wherever it currently is).
Ensure it is always visible regardless of how many lists are shown.

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

Verify on chefsbk.app:
- Shopping page shows store groups with logos
- Each group has a header with StoreAvatar + store name + list count
- Stores with 2+ lists show "All [Store]" concatenated entry
- Lists with no store appear under "Other"
- Clicking a regular list opens it as before
- Clicking "All [Store]" opens the combined view

---

## COMPLETION CHECKLIST

- [ ] Lists grouped by store_name on web shopping overview
- [ ] Store group header: StoreAvatar + name + list count
- [ ] StoreAvatar web component created (logo + initials fallback)
- [ ] Stores sorted: named stores first, Other last
- [ ] Concatenated "All [Store]" entry for stores with 2+ lists
- [ ] Concatenated view shows merged items with department grouping
- [ ] "Combined view" banner in concatenated view header
- [ ] Lists with no store grouped under "Other" with generic icon
- [ ] Clicking individual list opens as before
- [ ] "+ New List" button visible and accessible
- [ ] No regressions in list creation or item display
- [ ] Deployed to RPi5 and verified live on chefsbk.app
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
