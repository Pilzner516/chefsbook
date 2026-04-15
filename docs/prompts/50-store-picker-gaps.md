# ChefsBook — Session 50: Store Picker — Mobile + All Contexts + Button Colour
# Source: QA review 2026-04-10 — session 48 gaps
# Target: apps/mobile + apps/web

---

## CROSS-PLATFORM REQUIREMENT — READ FIRST

The store picker must work on BOTH platforms in ALL three shopping list creation
contexts. Read .claude/agents/ui-guardian.md and .claude/agents/data-flow.md before
starting. Run both pre-flight checklists before writing any code.

---

## CONTEXT

Session 48 built the `StorePickerDialog` on web and wired it to the shopping screen
"New List" button only. Three gaps remain:

1. Mobile has no store picker at all — still uses old text input
2. Web recipe detail "Add to shopping list → new list" still shows old text input
3. Web meal plan "add day to cart → new list" not confirmed wired
4. "Create & Add" button in recipe detail shopping modal is green (wrong colour)

---

## FIX 1 — Mobile store picker

Create `StorePicker` component for mobile (bottom sheet, same logic as web):

```
┌─────────────────────────────────────────┐
│  Select a store                 [✕]    │
│─────────────────────────────────────────│
│  [WF logo]  Whole Foods                 │
│  [SR logo]  ShopRite                    │
│  [TJ logo]  Trader Joe's                │
│  ─────────────────────────────────────  │
│  [+]        New store...                │
│─────────────────────────────────────────│
│  List name (optional)                   │
│  [________________________________]     │
│                                         │
│  [         Create List          ]       │  ← pomodoro red
└─────────────────────────────────────────┘
```

- Load stores from `getUserStores()` — already in packages/db
- Each row: `StoreAvatar` + store name
- Tapping existing store → auto-fills list name, proceeds to create
- "New store..." → shows inline text input to type store name
  → on confirm: calls `createStore()`, fetches logo, adds to list, selects it
- Uses `ChefsDialog` / bottom sheet pattern consistent with other mobile sheets
- Apply `useSafeAreaInsets()` to bottom of sheet

Wire into ALL mobile shopping list creation points:
- Shopping tab → "New list" button
- Recipe detail → "Add to Shopping List" → "New list" option
- Meal plan day → cart icon → "New list" option

---

## FIX 2 — Wire StorePickerDialog to recipe detail (web)

In the web recipe detail page, find the "Add to shopping list" flow.
When the user selects "New list", show `StorePickerDialog` instead of the
old text input.

The current modal shows:
- List name text input
- Store name text input (plain text)
- Green "Create & Add" button ← wrong colour

Replace with `StorePickerDialog` exactly as used on the shopping screen.

---

## FIX 3 — Wire StorePickerDialog to meal plan (web)

In the web meal plan day card, find the "add to cart → new list" flow.
Confirm whether `StorePickerDialog` is already wired. If not, wire it the
same way as Fix 2.

---

## FIX 4 — Button colour

Any "Create & Add", "Create List", or "Add to List" button in the shopping
list creation flow must use pomodoro red `#ce2b37` with white text — NOT green.

Green (`#009246` basil green) is reserved for positive/save actions and the
"Save 20%" annual badge. It should never appear on primary action buttons in
the shopping list flow.

Audit all buttons in the shopping list creation modals (web + mobile) and
correct any that are the wrong colour.

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

- [ ] Mobile `StorePicker` bottom sheet component created
- [ ] Mobile: store picker shown when creating new list from shopping tab
- [ ] Mobile: store picker shown when creating new list from recipe detail
- [ ] Mobile: store picker shown when creating new list from meal plan
- [ ] Web: StorePickerDialog wired to recipe detail "Add to shopping list → new list"
- [ ] Web: StorePickerDialog wired to meal plan "add to cart → new list"
- [ ] All "Create" buttons in shopping flows are pomodoro red (not green)
- [ ] Safe area insets on mobile bottom sheet
- [ ] Existing stores load with logos/initials on both platforms
- [ ] "New store..." adds to stores table and selects automatically
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
