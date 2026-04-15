# ChefsBook — Session 40: Shopping List Crash + Username Fixes
# Source: QA review 2026-04-10
# Target: apps/web + apps/mobile

---

## CROSS-PLATFORM REQUIREMENT
Both platforms must be fixed and verified before /wrapup.
Read .claude/agents/ui-guardian.md and .claude/agents/data-flow.md before starting.

---

## FIX 1 — Shopping list create crashes on web

### Symptom
"Application error: a client-side exception has occurred" when typing a list name
and clicking Create on the web shopping list page.

### Investigation steps
1. Open browser console on chefsbk.app when the crash occurs — read the full error
   stack trace. The error message in the console will identify the exact line.
2. Common causes for this type of crash:
   - A required field being passed as `undefined` to a Supabase insert
   - A store action throwing an uncaught exception
   - A missing field in the new store-first shopping list flow (store_name required
     but not provided in the web flow)
   - A type mismatch on the `plan` field or new columns added in migrations 017-021

3. Check the web shopping list create flow specifically:
   - Does the web create flow include the store selection step added in session 03?
   - If the web flow only asks for a name and no store, `store_name` may be undefined
     which could cause the crash
   - Fix: make `store_name` optional in the web create flow — default to the list name
     if not provided

4. Wrap the create action in a try/catch and log the full error before it crashes:
   ```ts
   try {
     await createShoppingList({ name, store_name: storeName ?? name });
   } catch (error) {
     console.error('Shopping list create error:', error);
     // Show user-friendly error message instead of crashing
     setError('Failed to create list. Please try again.');
   }
   ```

5. Also check if the crash happens in mobile — if so, fix both.

---

## FIX 2 — Username: clarify vs Display Name in UI

### Current confusion
The settings page shows both "Username" and "Display Name" without clear explanation
of the difference.

### Fix
Update the settings page labels and helper text:

**Display Name field:**
- Label: "Display Name"
- Helper text: "Your name as shown to others. Can be changed anytime."
- Example: "Bob Lux"

**Username field:**
- Label: "Username"  
- Helper text: "Your unique @handle used in recipe credits and search. Cannot be changed."
- Show with @ prefix: `@ pilzner`
- Show a lock icon 🔒 next to the field
- Field is read-only (already implemented, just needs clearer labelling)

Apply this clarification on both:
- Mobile Settings screen
- Web Settings page

---

## FIX 3 — Username family-friendly check at signup

### Current behaviour
Username is validated for format (lowercase, letters/numbers/underscores, 3-20 chars)
but not for family-friendly content.

### Fix
Add a profanity/family-friendly check on username at signup:

```ts
// In @chefsbook/ai, add:
export async function isUsernameFamilyFriendly(username: string): Promise<boolean>
```

Claude prompt:
```
Is the following username family-friendly and appropriate for a cooking app used by all ages?
Username: "${username}"

Rules:
- No profanity or swear words (any language)
- No hate speech or discriminatory terms
- No sexual references
- No violent references
- Common cooking/food terms are always acceptable
- Names, numbers, and common words are acceptable

Return JSON only: { "acceptable": true/false, "reason": "brief reason if false" }
```

Integrate into signup flow (mobile + web):
- Run after format validation passes
- If not acceptable: show error "Please choose a different username — this one isn't
  allowed on ChefsBook"
- Do not reveal the specific reason to the user
- This runs client-side before the Supabase availability check

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

- [ ] Shopping list create crash identified (check browser console for exact error)
- [ ] Root cause fixed — no crash on list create
- [ ] Error handled gracefully if create fails (user-friendly message, no app crash)
- [ ] Mobile shopping list create also verified (fix if same issue)
- [ ] Display Name vs Username clearly labelled in settings (mobile + web)
- [ ] Username field shows lock icon and "Cannot be changed" helper text
- [ ] Family-friendly username check added to signup (mobile + web)
- [ ] Unacceptable usernames show friendly error without revealing reason
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
