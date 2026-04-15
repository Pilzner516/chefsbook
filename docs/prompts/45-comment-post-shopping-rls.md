# ChefsBook — Session 45: Fix Comment Post + Shopping List RLS
# Source: Live web QA 2026-04-10
# Target: apps/web

---

## CRITICAL INSTRUCTION

This session fixes two broken features on the live web app. Before touching any code,
reproduce each bug yourself to understand exactly what is failing. Do NOT declare
a fix done by reading source — you must confirm the fix works by testing it.

For each fix, after making the code change:
1. Deploy to RPi5
2. Test the specific action that was failing
3. Confirm it works before moving to the next fix

Read .claude/agents/data-flow.md before starting.

---

## FIX 1 — Comment post button does nothing

### Reproduce first
On chefsbk.app, open a public recipe, type a comment, click Post. Confirm nothing
happens — no error shown, no comment appears.

### Investigation
1. Open browser console on chefsbk.app while clicking Post. What error appears?
2. Find the `RecipeComments` component in `apps/web/components/` or wherever it lives.
3. Find the Post button's onClick/onSubmit handler.
4. Check:
   - Is the handler calling `postComment()` from `@chefsbook/db`?
   - Is `postComment()` calling `moderateComment()` from `@chefsbook/ai`?
   - Is there a try/catch swallowing the error silently?
   - Is the Supabase client authenticated when the insert runs?
   - Is `user_id` being passed in the insert payload?

### Common causes
- The submit handler is `async` but not being awaited properly
- `moderateComment()` is throwing because the Claude API key is not set in
  the web environment — check `apps/web/.env.local` for `ANTHROPIC_API_KEY`
- The comment INSERT is failing RLS because `user_id` is not passed
- The handler is calling `e.preventDefault()` incorrectly or missing it

### Fix
Find the root cause from the browser console error and fix it. Ensure:
- Post button calls the submit handler correctly
- `user_id` is included in the comment insert
- Errors are caught and shown to the user (not silently swallowed)
- After posting, the comment appears in the list immediately

### Verify
Type a comment on a public recipe → click Post → comment appears in the list.
Check the DB on RPi5:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT id, content, status, created_at FROM recipe_comments ORDER BY created_at DESC LIMIT 3;"
```
Confirm the comment row exists with `status = 'visible'`.

---

## FIX 2 — Shopping list RLS error when adding meal plan day to cart

### Reproduce first
On chefsbk.app, go to meal plan, click the cart icon on a day card to add that
day's recipes to a shopping list. Confirm the error:
"new row violates row-level security policy for table shopping_list_items"

### Investigation
1. Open browser console — get the full error stack trace
2. Find the "add day to cart" handler in the web meal plan code
3. Find where `shopping_list_items` rows are inserted
4. Check the INSERT payload — is `user_id` included?
5. Check the RLS policy on `shopping_list_items`:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c \
  "\d+ shopping_list_items"
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'shopping_list_items';"
```

### Common causes
- INSERT policy requires `user_id = auth.uid()` but `user_id` is not in the payload
- The insert is going through a function/RPC that doesn't set the session user correctly
- The web Supabase client loses auth context in the server action

### Fix
Ensure every `shopping_list_items` insert includes `user_id: currentUser.id` in
the payload. The RLS policy checks this — without it the insert is rejected.

If the policy itself is wrong, fix it:
```sql
-- Correct INSERT policy for shopping_list_items:
CREATE POLICY "Users can insert own list items"
  ON shopping_list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shopping_lists sl
      WHERE sl.id = shopping_list_items.list_id
      AND sl.user_id = auth.uid()
    )
  );
```

The policy should check that the list belongs to the current user, not require
`user_id` on the items table directly (items may not have a `user_id` column —
ownership is through the parent list).

### Verify
Add a meal plan day to a shopping list → no error → items appear in the list.
Check the DB:
```bash
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT id, list_id, name, created_at FROM shopping_list_items ORDER BY created_at DESC LIMIT 5;"
```
Confirm rows were inserted.

---

## ALSO CHECK — Shopping list creation on web

While investigating Fix 2, also check the web shopping list creation flow:
- Does it ask for a store (store-first design from session 03)?
- If not, is `store_name` defaulting correctly so the insert doesn't fail?
- Can a new list be created without errors?

If there are additional failures here, fix them in the same session.

---

## DEPLOYMENT

After EACH fix, deploy and test before moving to the next:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Test the fix live on chefsbk.app before declaring it done.

---

## COMPLETION CHECKLIST

- [ ] Browser console checked for comment post error — root cause identified
- [ ] Comment posts successfully — appears in list immediately
- [ ] Comment row confirmed in DB via psql query
- [ ] Browser console checked for shopping list RLS error — root cause identified
- [ ] RLS policy on shopping_list_items verified and fixed if needed
- [ ] user_id / list ownership correctly passed on all shopping_list_items inserts
- [ ] Adding meal plan day to cart works — items appear in shopping list
- [ ] Items confirmed in DB via psql query
- [ ] Shopping list creation on web verified working
- [ ] Both fixes deployed and tested live on chefsbk.app
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
