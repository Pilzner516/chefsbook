# ChefsBook — Session 118: Reset Pilzner Account + Fix Login
# Source: Cannot log in — a@aol.com is a placeholder, needs real email
# Target: RPi5 database + auth

---

## CONTEXT

Read CLAUDE.md, DONE.md, and feature-registry.md before starting.

The pilzner admin account uses a@aol.com as a placeholder email.
This is not a real email address. We need to:
1. Update the account to use a real email
2. Restore login access
3. Fix the two bugs found in the verification sweep (admin DM RLS,
   reply_count trigger)

---

## STEP 1 — Diagnose current auth state

SSH to RPi5:

```bash
ssh rasp@rpi5-eth
psql -U postgres -d postgres
```

```sql
-- Check pilzner account state
SELECT id, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token,
  email_change_token_new, banned_until, deleted_at
FROM auth.users
WHERE email = 'a@aol.com';

-- Check user_profiles
SELECT id, username, plan_tier FROM user_profiles
WHERE username = 'pilzner';

-- Confirm admin status
SELECT * FROM admin_users
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'a@aol.com');
```

---

## STEP 2 — Update email to real address

Stop and ask the user: "What email address should I set for the
pilzner account?"

Wait for the response before proceeding. Do not guess or use a
placeholder.

Once confirmed, update both auth.users and any email references:

```sql
-- Update auth.users email
UPDATE auth.users
SET email = '<new_email>',
    email_confirmed_at = now(),
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token = COALESCE(reauthentication_token, '')
WHERE email = 'a@aol.com';

-- Update user_profiles if email stored there
UPDATE user_profiles
SET email = '<new_email>'
WHERE username = 'pilzner';
```

---

## STEP 3 — Set a new password

Use GoTrue admin API to set a new password directly:

```bash
# Get the user ID first
USER_ID=$(psql -U postgres -d postgres -t -c \
  "SELECT id FROM auth.users WHERE email = '<new_email>';" | tr -d ' ')

# Set new password via GoTrue admin API
curl -X PUT http://localhost:9999/admin/users/$USER_ID \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"password": "<new_password>"}'
```

If GoTrue admin API is not accessible via localhost, update the
password directly in the DB using pgcrypto:

```sql
UPDATE auth.users
SET encrypted_password = extensions.crypt('<new_password>',
  extensions.gen_salt('bf'))
WHERE email = '<new_email>';
```

---

## STEP 4 — Verify login works

```bash
curl -X POST https://api.chefsbk.app/auth/v1/token?grant_type=password \
  -H "apikey: <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"<new_email>","password":"<new_password>"}'
```

Confirm a JWT access_token is returned. Login is working.

---

## STEP 5 — Fix admin DM RLS bug (found in verification sweep)

The sendMessage() function uses supabase (anon client) for inserts.
RLS blocks the insert when called from the admin API route server-side
because there is no auth context.

Fix: update sendMessage() in packages/db to accept an optional
supabase client parameter. When called from /api/admin route, pass
supabaseAdmin. When called from client code, use the regular client.

```typescript
// packages/db/src/messages.ts
export async function sendMessage(
  senderId: string,
  recipientId: string,
  content: string,
  client = supabase  // default to regular client
) {
  return client.from('direct_messages').insert({
    sender_id: senderId,
    recipient_id: recipientId,
    content
  })
}
```

Update /api/admin/route.ts to pass supabaseAdmin when calling sendMessage.

Verify: admin sends a test DM from Users page — no RLS error.

---

## STEP 6 — Fix reply_count trigger SECURITY DEFINER

The reply_count trigger on recipe_comments is not SECURITY DEFINER,
so RLS blocks the UPDATE on the parent comment when a different user
posts a reply.

Fix:

```sql
-- Find and recreate the trigger function as SECURITY DEFINER
CREATE OR REPLACE FUNCTION increment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE recipe_comments
  SET reply_count = reply_count + 1
  WHERE id = NEW.parent_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the trigger exists
SELECT tgname, tgtype FROM pg_trigger
WHERE tgrelid = 'recipe_comments'::regclass;
```

Apply on RPi5 via psql. No migration file needed — just run the SQL.

---

## DEPLOYMENT

Only needed if code changes were made (Step 5):

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] Stopped and asked user for new email before proceeding
- [ ] pilzner account email updated in auth.users + user_profiles
- [ ] All NULL token columns set to empty string
- [ ] New password set and confirmed working
- [ ] Login verified via curl — JWT returned
- [ ] admin_users row still intact for pilzner
- [ ] sendMessage() accepts optional client param
- [ ] Admin DM uses supabaseAdmin — no RLS error
- [ ] reply_count trigger recreated as SECURITY DEFINER
- [ ] Deployed to RPi5 if code changes made
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
