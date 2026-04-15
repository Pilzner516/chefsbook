# ChefsBook — Session 105: Fix Feedback Min-Chars UX + Cuisine Dropdown
# Source: Live review — feedback button disabled with no explanation, cuisine still broken
# Target: apps/web

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, ui-guardian.md, and ALL
mandatory agents per SESSION START sequence before touching anything.

Two fixes. Both were attempted in previous sessions and are still broken.
Do NOT repeat the same approach — diagnose first, then fix properly.
Do not mark either item complete until you have personally verified it
works by testing it yourself in the code/browser.

---

## FIX 1 — Feedback card: silent disabled button

### Problem
The Send Feedback button is disabled when the message is under 10
characters, but shows no explanation. The button just appears faded.
Users cannot understand why they cannot submit.

### Fix
Below the textarea, add a visible helper line that:
- Shows "Minimum 10 characters" in muted grey when the field is empty
  or the user has not started typing
- Changes to red text when the user HAS typed something but is still
  under 10 characters (e.g. "6/10 characters minimum")
- Disappears or turns green once the 10-character threshold is met
- The button remains disabled under 10 chars but the reason is always
  visible

Do not change the minimum threshold — keep it at 10 characters.
Do not change the 500 character maximum.
Style using Trattoria theme colors — never hardcode hex.

---

## FIX 2 — Cuisine dropdown: still only shows current value on click

### Problem
Clicking the cuisine field still only shows the currently selected
cuisine (e.g. "American") in the dropdown. The full list does not
appear until the user clears the field. Session 103 attempted a fix
but it did not work.

### How to fix it correctly

Step 1 — Read the daypart dropdown component fully before writing
any code. Find the exact prop or state variable that controls whether
the dropdown shows ALL options vs filtered options on open. The daypart
component works correctly — replicate its exact mechanism.

Step 2 — The key difference to look for:
- Daypart likely uses an "open" state that shows all options regardless
  of the current input value when first opened
- Cuisine likely filters options based on the input value immediately,
  so when inputValue = "American" only "American" shows

Step 3 — The correct behaviour:
- On click/focus: set isOpen = true, set filterValue = '' (empty string
  for filtering purposes, NOT the current saved value)
- The dropdown renders ALL options when filterValue is empty
- Current saved cuisine is highlighted/selected in the list
- When user starts typing: filterValue updates and list filters
- When user selects an option: save it, close dropdown, show in input
- When user clears input manually: filterValue = '', show all options

Step 4 — Test it yourself before marking complete:
1. Click the cuisine field
2. Confirm MORE THAN ONE option appears immediately (full list)
3. Confirm the current cuisine is highlighted
4. Type a letter — confirm list filters
5. Select a different cuisine — confirm it saves

Do not mark FIX 2 complete unless you have confirmed step 4 yourself.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Only restart PM2 if build exits with code 0.

---

## COMPLETION CHECKLIST

- [ ] Feedback textarea shows "Minimum 10 characters" helper below field
- [ ] Helper turns red with count when user types fewer than 10 chars
- [ ] Helper disappears/turns green at 10+ chars
- [ ] Button disabled state reason is always visible to user
- [ ] Cuisine field opens FULL list immediately on click (not just current value)
- [ ] Current cuisine highlighted in the open list
- [ ] Typing filters the list correctly
- [ ] Selecting an option saves and closes correctly
- [ ] Agent has personally tested the cuisine dropdown before marking done
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from this
      prompt, what was left incomplete, and why.
