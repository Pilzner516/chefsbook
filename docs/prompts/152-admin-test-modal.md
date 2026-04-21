# ChefsBook — Session 152: Admin Run Tests Modal with Rating Filter
# Source: "Run all tests now" button needs filtering capability
# Target: apps/web/app/admin/import-sites

---

## CONTEXT

Read CLAUDE.md and DONE.md before starting.

The "Run all tests now" button on /admin/import-sites currently
triggers tests on ALL sites with no filtering. Replace with a
modal that lets admin choose which rating tiers to test.

---

## CHANGE — Replace button with filtered modal

### Current behaviour
"Run all tests now" button → immediately runs tests on all 218 sites

### New behaviour
"Run all tests now" button → opens a modal with filter options
→ admin selects which ratings to include
→ confirms with site count shown
→ only selected sites are tested

---

## MODAL DESIGN

```
┌─────────────────────────────────────────────┐
│  Run Site Compatibility Tests               │
│                                             │
│  Select which sites to test:                │
│                                             │
│  [● All sites]  [○ Untested]               │
│  [○ ⭐ 1 star]  [○ ⭐⭐ 2 star]            │
│  [○ ⭐⭐⭐ 3 star] [○ ⭐⭐⭐⭐ 4 star]     │
│  [○ ⭐⭐⭐⭐⭐ 5 star] [○ Extension req'd] │
│                                             │
│  23 sites selected                          │
│                                             │
│  ⚠ Tests run at 1 per 8 seconds.           │
│  23 sites will take ~3 minutes.             │
│                                             │
│  [Cancel]        [Run tests on 23 sites →] │
└─────────────────────────────────────────────┘
```

### Pill behaviour
- Pills are multi-select (can select multiple ratings)
- "All sites" is a special pill — selecting it deselects all others
  and vice versa
- Default selection when modal opens:
  "Untested" + "⭐ 1 star" + "⭐⭐ 2 star"
  (the sites most needing attention)
- Count updates live as pills are toggled
- Time estimate updates live: N sites × 8 seconds = X minutes
- "Run tests" button is disabled if 0 sites selected

### Rating filter mapping
- All sites → no filter (all domains)
- Untested → rating IS NULL
- ⭐ 1 star → rating = 1
- ⭐⭐ 2 star → rating = 2
- ⭐⭐⭐ 3 star → rating = 3
- ⭐⭐⭐⭐ 4 star → rating = 4
- ⭐⭐⭐⭐⭐ 5 star → rating = 5
- Extension required → needs_extension = true OR rating IS NULL
  AND last failure was 403/460

### API change

Update /api/admin/test-sites to accept a filter parameter:

```typescript
// POST body
{
  ratings?: (1 | 2 | 3 | 4 | 5 | null)[],  // null = untested
  includeExtensionRequired?: boolean,
  all?: boolean
}
```

Server filters import_site_tracker accordingly before running tests.

---

## IMPLEMENTATION

Use the existing ChefsDialog pattern for the modal if available,
otherwise build a simple modal with the Trattoria theme:
- White background
- Red accent for the confirm button
- Cream pill buttons with red selected state
- Basil green for the time estimate

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] Modal opens when "Run all tests now" is clicked
- [ ] 8 pill options (All, Untested, 1-5 star, Extension required)
- [ ] Multi-select pills — multiple ratings can be selected together
- [ ] "All sites" pill deselects others when chosen
- [ ] Default selection: Untested + 1★ + 2★
- [ ] Live count: "N sites selected"
- [ ] Live time estimate: "~N minutes"
- [ ] Run button disabled when 0 sites selected
- [ ] /api/admin/test-sites accepts ratings filter in POST body
- [ ] Only selected rating tiers are tested
- [ ] Cancel closes modal with no action
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end confirm modal works and filter is applied correctly
