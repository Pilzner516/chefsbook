# ChefsBook — Session 106: Rename Help Requests + Fix Admin Loading States
# Source: Live review — wrong label in admin, 3 admin pages stuck on loading
# Target: apps/web + admin pages

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

Two fixes. The loading bug on admin pages is likely a data fetch or
auth issue — diagnose before fixing.

---

## FIX 1 — Rename "Help Requests" to "User Ideas" throughout

Find every place "Help Requests" or "help_requests" appears in the UI
(not the DB table name — keep the DB table as-is):

- Admin sidebar nav label
- Admin page heading/title
- Any tab or section header
- The feedback card modal title ("Got an Idea for Us?" is fine — keep that)
- Any toast or confirmation message referencing "help request"

Change all UI labels from "Help Requests" → "User Ideas".
Do NOT rename the DB table or column names — only UI text changes.

---

## FIX 2 — Admin pages stuck on "Loading": messages, recipes, users

Three admin pages show "Loading" indefinitely and never render data:
- /admin/messages
- /admin/recipes  
- /admin/users (or whichever page shows the user list)

### Diagnose first — do not guess:

1. Open the browser network tab (or check PM2 logs) and identify what
   request is failing on each page
2. Check if the pages use supabaseAdmin (service role) or the anon client
   — admin pages MUST use supabaseAdmin or RLS will block all reads
3. Check if there is an infinite loading state caused by:
   - A failed fetch that never sets loading = false
   - A missing error handler that leaves loading = true on error
   - An auth check that never resolves
4. SSH to RPi5 and test the queries directly:

```sql
-- Test messages query
SELECT * FROM direct_messages LIMIT 5;

-- Test flagged messages
SELECT * FROM direct_messages WHERE is_hidden = true LIMIT 5;

-- Test recipes moderation queue
SELECT id, title, moderation_status FROM recipes
WHERE moderation_status IN ('mild', 'serious') LIMIT 5;

-- Test users list
SELECT id, username, plan_tier FROM user_profiles LIMIT 5;
```

5. For each broken page: fix the root cause — ensure supabaseAdmin is
   used, ensure loading = false is always called in both success and
   error paths, ensure error state is shown to the admin if fetch fails

### Loading state rule:
Every data fetch must have three states handled:
- loading = true → show spinner
- data loaded → show content
- error → show error message, set loading = false

Never leave loading = true indefinitely. Always catch errors and
set loading = false in the catch block.

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

- [ ] Admin nav + page titles show "User Ideas" not "Help Requests"
- [ ] DB table name unchanged (help_requests)
- [ ] /admin/messages loads and shows data (or empty state if no messages)
- [ ] /admin/recipes loads and shows moderation queue
- [ ] /admin/users loads and shows user list
- [ ] All three pages show a proper error state if fetch fails (not infinite loading)
- [ ] All admin fetches confirmed using supabaseAdmin (service role)
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from this
      prompt, what was left incomplete, and why.
