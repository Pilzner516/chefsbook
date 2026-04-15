# ChefsBook — Session 87: Fix Admin Access for seblux Account
# Source: Live review — seblux100@gmail.com logs in but cannot access /admin
# Target: apps/web + database (admin_users table)

---

## CONTEXT

Read CLAUDE.md and DONE.md before starting.
The seblux100@gmail.com account (username: seblux) exists in auth.users and user_profiles
but navigating to /admin redirects to the dashboard — it is not being recognised as an admin.

Two possible root causes:
1. The admin_users row for seblux has the wrong user_id UUID
2. The /admin route protection logic is not querying admin_users correctly

Fix both the data and verify the code path. Deploy when done.

---

## STEP 1 — Verify the database state

SSH to RPi5 and check:

```bash
ssh rasp@rpi5-eth
psql -U postgres -d postgres
```

Run these queries and note the output:

```sql
-- What is currently in admin_users?
SELECT au.user_id, au.role, u.email
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id;

-- What is the actual UUID for seblux100?
SELECT id, email FROM auth.users WHERE email = 'seblux100@gmail.com';
```

If the UUIDs do not match, or seblux is missing from admin_users entirely:

```sql
-- Insert or fix the row
INSERT INTO admin_users (user_id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE email = 'seblux100@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
```

Verify after:

```sql
SELECT au.user_id, au.role, u.email
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id;
```

Both pilzner and seblux should appear with role = super_admin.

---

## STEP 2 — Verify the /admin route protection code

Find the admin route guard in apps/web. It will be in one of:
- `apps/web/app/admin/layout.tsx`
- `apps/web/middleware.ts`
- `apps/web/app/admin/page.tsx`

Check exactly how it queries admin_users. Common issues:
- Queries by username instead of user_id
- Uses the wrong Supabase client (anon key instead of service role) so RLS blocks the read
- Checks a column that doesn't exist or is named differently

The correct pattern is:

```typescript
// Use service role client — anon key cannot read admin_users due to RLS
const { data } = await supabaseAdmin
  .from('admin_users')
  .select('role')
  .eq('user_id', session.user.id)
  .single()

if (!data) redirect('/dashboard')
```

If the code uses the anon/browser Supabase client instead of supabaseAdmin (service role),
fix it to use the server-side admin client.

---

## STEP 3 — Add a visible admin link in the UI

Currently there is no way for an admin to navigate to /admin from the dashboard —
they have to know the URL. Add a subtle admin entry point:

In the web sidebar (the authenticated layout sidebar component):
- Query admin_users for the current user on page load
- If they are an admin, show a small "Admin" link at the very bottom of the sidebar,
  below Settings, with a shield icon (use any available icon from the icon library)
- Style it subtly — muted colour, smaller text — it should not be prominent to regular users
- Link to /admin

Do NOT show this link to non-admin users.

---

## STEP 4 — Test

1. Sign in as seblux100@gmail.com
2. Confirm the Admin link appears in the sidebar
3. Click it — confirm /admin loads without redirect
4. Sign in as a non-admin test account — confirm the Admin link does NOT appear
5. Confirm pilzner account still works as before

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

Only restart PM2 if the build exits with code 0.

---

## COMPLETION CHECKLIST

- [ ] admin_users table confirmed: both pilzner and seblux rows present with correct UUIDs
- [ ] /admin route protection uses service role client (not anon)
- [ ] seblux100@gmail.com can navigate to /admin without redirect
- [ ] Admin link visible in sidebar for admin accounts only
- [ ] Non-admin accounts do not see the Admin link
- [ ] Deployed to RPi5 — chefsbk.app/admin loads correctly for seblux
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
