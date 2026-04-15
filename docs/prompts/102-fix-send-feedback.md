# ChefsBook — Session 102: Fix Send Feedback Button
# Source: Live review — feedback modal renders but submit does nothing
# Target: apps/web + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

The "Got an Idea?" feedback card opens correctly and the modal renders.
The user can type a message but clicking "Send Feedback" does nothing —
no success state, no error, no DB insert. Fix the root cause.

Do NOT patch around the problem — find and fix the actual cause.

---

## STEP 1 — Diagnose the DB table

SSH to RPi5 and run:

```sql
-- Confirm table structure
\d help_requests;

-- Check if any rows exist
SELECT * FROM help_requests ORDER BY created_at DESC LIMIT 5;

-- Check RLS policies on help_requests
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'help_requests';
```

Show all output before proceeding.

---

## STEP 2 — Diagnose the submit handler

Find the FeedbackCard component in apps/web.
Read the submit handler fully. Check:

1. Is there a try/catch? Is the catch block swallowing the error silently?
2. What API route does it POST to? Does that route exist?
3. Add temporary console.error logging inside the catch block and
   inside the API route handler to surface the real error
4. What does the API route do with the data — does it use supabaseAdmin
   (service role) or the anon client? Anon client will fail due to RLS.

---

## STEP 3 — Fix the root cause

Based on diagnosis, fix whichever layer is broken:

Option A — API route missing or wrong path:
- Create or fix the API route at the correct path
- Use supabaseAdmin for the insert to bypass RLS

Option B — RLS blocking the insert:
- Add an INSERT policy to help_requests:
  `FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)`
- Or use supabaseAdmin in the API route

Option C — Silent error in submit handler:
- Fix the catch block to show an error message to the user
- Never fail silently — always show success or error state

Option D — Wrong column names in insert:
- Match exactly what \d help_requests showed in Step 1
- Common mismatch: user_email vs email, username vs user_name, message vs content

---

## STEP 4 — Verify end-to-end

After fixing:
1. Submit a test message via the feedback modal on chefsbk.app
2. Confirm the success state ("Thank you!") shows after submit
3. SSH to RPi5 and confirm the row exists in help_requests:
   `SELECT * FROM help_requests ORDER BY created_at DESC LIMIT 3;`
4. Confirm the row has the correct user_email, username, and message values

Do not mark complete until the row is confirmed in the DB.

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

- [ ] help_requests table structure confirmed on RPi5
- [ ] Root cause identified (silent error / wrong route / RLS / column mismatch)
- [ ] Fix applied — not patched around
- [ ] Success state shows after submit
- [ ] Test row confirmed in help_requests table on RPi5
- [ ] feature-registry.md updated: Got an Idea feedback card → LIVE
- [ ] Deployed to RPi5 if code changes made
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from this
      prompt, what was left incomplete, and why.
