# ChefsBook — Session 67: Fix Meal Plan Dialog Button Overflow
# Source: QA screenshot 2026-04-11
# Target: apps/web

---

## CONTEXT

The "Change meal type" ChefsDialog is too narrow — the 4 meal type pill buttons
(Breakfast, Lunch, Dinner, Snack) overflow outside the dialog container margins.

Read .claude/agents/ui-guardian.md and .claude/agents/deployment.md before starting.

---

## FIX

Find the meal type picker ChefsDialog in the web meal plan page.

The 4 buttons need to fit inside the dialog. Two options:

**Option A — Wider dialog (preferred):**
Increase the dialog max-width from the current value to at least 380px.
The 4 pills at ~85px each + 3 gaps at 8px = ~367px minimum content width.
Set dialog `min-width: 380px` or `max-width: 420px`.

**Option B — 2×2 grid layout:**
If the dialog width can't be increased (e.g. mobile viewport constraints),
arrange the 4 buttons in a 2×2 grid:
```
[Breakfast]  [Lunch  ]
[Dinner   ]  [Snack  ]
```
Each button takes 50% width minus gap. This always fits regardless of
dialog width.

Implement Option A for web (desktop has space). If the same dialog is used
on mobile, use Option B for mobile breakpoint.

### Button sizing
Each meal type pill button:
- Min-width: 80px
- Padding: 8px 16px
- No text wrapping (`white-space: nowrap`)
- Current selected: `#ce2b37` background, white text
- Others: white background, `#ce2b37` border and text

### Dialog layout after fix
```
┌────────────────────────────────────────────┐
│  Change meal type                    [✕]   │
│  "Fried Chicken Ramen"                     │
│────────────────────────────────────────────│
│                                            │
│  [Breakfast]  [Lunch]  [Dinner]  [Snack]  │
│                                            │
│                          [Cancel]          │
└────────────────────────────────────────────┘
```

All 4 buttons on one row with adequate spacing, fully within dialog bounds.

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

Verify on chefsbk.app: tap a daypart pill on the meal plan → dialog opens →
all 4 meal type buttons fully visible within dialog bounds, no overflow.

---

## COMPLETION CHECKLIST

- [ ] All 4 meal type buttons fit within dialog container
- [ ] No button text wrapping or overflow outside dialog
- [ ] Selected meal type highlighted correctly
- [ ] Dialog width appropriate for desktop (Option A)
- [ ] Mobile uses 2×2 grid if needed (Option B)
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
