# ChefsBook — Session 73: Consolidated Store List View
# Source: Repeated feature request — finally implementing correctly
# Target: apps/web + apps/mobile

---

## CROSS-PLATFORM REQUIREMENT
This MUST be implemented on BOTH platforms and TESTED before /wrapup.
This feature has been requested multiple times and partially implemented.
It must be fully working this session. Read .claude/agents/data-flow.md,
.claude/agents/ui-guardian.md, .claude/agents/deployment.md before starting.
Run ALL pre-flight checklists.

---

## CONTEXT

The shopping list overview groups lists by store correctly. However stores with
multiple lists are MISSING the "All [Store]" consolidated entry that should
appear as the FIRST item in each store group. This has been specified in
sessions 03, 63, and the store grouping prompt — it has never been fully built.

This session implements it completely and verifies it works end-to-end.

---

## TARGET LAYOUT

```
Shopping Lists

┌─────────────────────────────────────────┐
│  [WF logo]  Whole Foods          2 lists│  ← store group header
├─────────────────────────────────────────┤
│  📋 All Whole Foods    [COMBINED]       │  ← ALWAYS FIRST for stores with 2+ lists
├─────────────────────────────────────────┤
│  📋 list wf                             │
│     Updated Apr 11                      │
├─────────────────────────────────────────┤
│  📋 test3                               │
│     Updated Apr 10                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [SR logo]  ShopRite             1 list │  ← single list: no combined entry
├─────────────────────────────────────────┤
│  📋 ShopRite                            │
└─────────────────────────────────────────┘
```

**Rule:** Combined entry only appears when the store has 2 or more lists.
Single-list stores show only the one list — no combined entry.

---

## COMBINED ENTRY STYLING

```tsx
// Combined entry row:
<div className="list-row combined" onClick={() => openCombinedView(storeName, lists)}>
  <span className="list-icon">📋</span>
  <div className="list-info">
    <span className="list-name">All {storeName}</span>
  </div>
  <span className="combined-badge">COMBINED</span>
</div>
```

Badge style:
- Background: `#009246` (basil green)
- Text: white, 11px, font-weight 600
- Border-radius: 12px
- Padding: 2px 8px

---

## COMBINED VIEW — when tapped/clicked

Opens a full-screen view (or navigates to a new route `/dashboard/shop/combined/[storeId]`):

### Header
```
┌─────────────────────────────────────────┐
│  ← Back    All Whole Foods              │
│            Combined view — 2 lists      │  ← subtitle
└─────────────────────────────────────────┘
```

### Banner below header
```
┌─────────────────────────────────────────┐
│  📋 Showing combined items from         │
│     2 lists: "list wf" and "test3"     │
│     [View individual lists →]           │
└─────────────────────────────────────────┘
```
Background: light cream `#faf7f0`, border-bottom.

### Items display
Merge ALL items from ALL lists for this store:

```ts
// Merging logic:
function mergeListItems(allItems: ShoppingListItem[]): MergedItem[] {
  const merged = new Map<string, MergedItem>();

  for (const item of allItems) {
    // Key: ingredient name + unit (case-insensitive)
    const key = `${item.name.toLowerCase()}|${item.unit?.toLowerCase() ?? ''}`;

    if (merged.has(key)) {
      const existing = merged.get(key)!;
      existing.quantity = (parseFloat(existing.quantity) +
        parseFloat(item.quantity)).toString();
      existing.sourceLists.push(item.listName);
    } else {
      merged.set(key, {
        ...item,
        sourceLists: [item.listName]
      });
    }
  }

  return Array.from(merged.values());
}
```

Display merged items grouped by department (same as individual list view).
Show item quantity + unit + name. If item came from multiple lists, show
a small grey note: `from 2 lists`.

### Read-only — no editing
No checkboxes, no delete buttons, no add item button.
Combined view is purely for reference — shopping from a merged list.

A clear label at the top: "Read-only combined view"

---

## MOBILE — same feature

In the mobile shopping tab, apply the same logic:
- Store groups with 2+ lists show "All [Store]" as first entry with COMBINED badge
- Tapping opens a read-only merged item list
- Back button returns to shopping overview

---

## STEP-BY-STEP IMPLEMENTATION

1. In the shopping overview data layer — when fetching lists, group by store AND
   flag stores with 2+ lists for the combined entry

2. Render the combined entry FIRST in each multi-list store group

3. Build the combined view screen/route:
   - Fetch all items from all lists for the selected store
   - Run the merge function
   - Display grouped by department

4. Wire navigation: tap combined entry → combined view, back → overview

---

## TESTING — MANDATORY before /wrapup

```bash
# Verify stores and lists on RPi5:
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT sl.name, sl.store_name, s.name as store
   FROM shopping_lists sl
   LEFT JOIN stores s ON s.id = sl.store_id
   ORDER BY sl.store_name;"
```

On chefsbk.app:
- [ ] Whole Foods group shows "All Whole Foods" as FIRST entry with COMBINED badge
- [ ] Tapping "All Whole Foods" opens combined view
- [ ] Combined view shows items from BOTH "list wf" AND "test3" merged
- [ ] Same ingredient from both lists has quantities summed
- [ ] Department grouping applied in combined view
- [ ] "View individual lists →" link works
- [ ] Back button returns to shopping overview
- [ ] Single-list stores (ShopRite) do NOT show a combined entry

On mobile:
- [ ] Same combined entry visible in shopping tab
- [ ] Tapping opens read-only merged view

---

## EXPLICITLY REQUIRED IN DONE.md

The session wrapup MUST include this statement:
"Consolidated store list view implemented and tested — stores with 2+ lists
show 'All [Store]' combined entry as first item; combined view merges items
by ingredient+unit with department grouping; verified on both web and mobile."

If this statement cannot be written honestly, the feature is not done.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] Combined entry appears for all stores with 2+ lists (web + mobile)
- [ ] Single-list stores show no combined entry
- [ ] COMBINED badge in basil green
- [ ] Combined view opens on tap/click
- [ ] Combined view header shows store name + list count
- [ ] Banner shows which lists are included with "View individual lists" link
- [ ] Items merged: same ingredient+unit → quantities summed
- [ ] Department grouping in combined view
- [ ] Combined view is read-only (no edit/delete/add controls)
- [ ] Back navigation works correctly
- [ ] Tested with 2 real lists for Whole Foods — confirmed merged view
- [ ] Deployed to RPi5 — HTTP 200 on shopping page
- [ ] Required DONE.md statement written
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
