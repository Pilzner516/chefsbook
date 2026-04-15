# ChefsBook — Session 107: User Ideas — Show Sender with Profile Link
# Source: Live review — feedback messages in admin show no user info
# Target: apps/web admin User Ideas page

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

The User Ideas page in admin (/admin/help or equivalent) shows feedback
messages but does not identify who sent them. Every message must show
the sender with a clickable link to their profile.

---

## STEP 1 — Check the help_requests table structure

SSH to RPi5:

```sql
\d help_requests;

-- See what user data is already stored
SELECT id, user_id, username, user_email, message, created_at
FROM help_requests
ORDER BY created_at DESC LIMIT 10;
```

The table should already have user_id, username, and user_email columns
from migration in session 69/73. Confirm which columns exist.

---

## STEP 2 — Update the admin User Ideas page

Find the admin User Ideas page component in apps/web/app/admin/.

For each feedback row, display:

```
┌─────────────────────────────────────────────┐
│  [Avatar] @username · user@email.com        │  ← clickable → /admin/users?id=user_id
│  "The message text here..."                 │
│  2 hours ago                                │
└─────────────────────────────────────────────┘
```

- Avatar: use the existing UserAvatar or initials component
- @username: clickable link that navigates to /u/[username] (public
  profile) OR to /admin/users filtered to that user
- Email shown in muted text next to username
- Message text below in normal weight
- Timestamp: relative time (e.g. "2 hours ago", "3 days ago")
- If username is null: show email only
- If both are null: show "Anonymous"

Use supabaseAdmin to fetch help_requests — anon client may be blocked
by RLS.

---

## STEP 3 — Make the username a clickable profile link

Clicking the username/avatar should open that user's profile.
Use Next.js Link component — navigate to /u/[username] if username
exists, otherwise /admin/users with a search filter for that email.

This must open in the same tab (not a new tab) since admins are
already in the admin context.

---

## STEP 4 — Verify

1. Confirm the User Ideas page loads (not stuck on loading)
2. Confirm each message shows avatar + @username + email + message + time
3. Click a username — confirm it navigates to the correct profile
4. Confirm the test message from seblux100@gmail.com shows correctly

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

- [ ] User Ideas page shows sender avatar + @username + email per message
- [ ] Username is a clickable link to the user's profile
- [ ] Relative timestamp shown per message
- [ ] Graceful fallback when username or email is null
- [ ] Fetch uses supabaseAdmin (service role)
- [ ] Verified: seblux100 message shows correctly with profile link
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from this
      prompt, what was left incomplete, and why.
