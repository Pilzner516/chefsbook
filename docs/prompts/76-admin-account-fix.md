# ChefsBook — Session 76: Fix Admin Account + Email Confirmation
# Source: QA 2026-04-11 — cannot create account due to email confirmation error
# Target: RPi5 Supabase config + admin_users table

---

## CONTEXT

Attempting to create the admin account (seblux100@gmail.com) fails with
"Error sending confirmation email". Self-hosted Supabase has no email
provider configured. Email confirmation must be disabled and the admin
account created directly via SQL.

Read .claude/agents/deployment.md before starting.

---

## STEP 1 — Disable email confirmation on self-hosted Supabase

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
```

Find the Supabase environment config:
```bash
cat .env | grep -i mail
cat docker-compose.yml | grep -i mail
```

Set auto-confirm to true. In the `.env` file add or update:
```
GOTRUE_MAILER_AUTOCONFIRM=true
```

If config is in `docker-compose.yml` under the `supabase-auth` service environment:
```yaml
GOTRUE_MAILER_AUTOCONFIRM: "true"
```

Restart the auth service:
```bash
docker compose restart supabase-auth
```

Wait 10 seconds then verify it restarted:
```bash
docker compose ps supabase-auth
```

---

## STEP 2 — Create admin account via SQL

Create the Supabase auth user directly without email confirmation:

```bash
docker compose exec db psql -U postgres -d postgres -c "
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  role,
  aud,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'seblux100@gmail.com',
  crypt('11223344', gen_salt('bf')),
  now(),
  'authenticated',
  'authenticated',
  now(),
  now()
) ON CONFLICT (email) DO NOTHING
RETURNING id;
"
```

Note the UUID returned — you'll need it in Step 3.

Also create the user_profiles record:
```bash
docker compose exec db psql -U postgres -d postgres -c "
INSERT INTO user_profiles (id, email, username, plan)
SELECT id, 'seblux100@gmail.com', 'seblux', 'pro'
FROM auth.users WHERE email = 'seblux100@gmail.com'
ON CONFLICT (id) DO NOTHING;
"
```

---

## STEP 3 — Seed admin_users table

Get the user ID:
```bash
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT id FROM auth.users WHERE email = 'seblux100@gmail.com';"
```

Insert into admin_users:
```bash
docker compose exec db psql -U postgres -d postgres -c "
INSERT INTO admin_users (user_id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE email = 'seblux100@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
"
```

---

## STEP 4 — Also make pilzner a super_admin

The pilzner account (existing, already working) should also be super_admin:
```bash
docker compose exec db psql -U postgres -d postgres -c "
INSERT INTO admin_users (user_id, role)
SELECT up.id, 'super_admin'
FROM user_profiles up
WHERE up.username = 'pilzner'
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
"
```

This means you can access /admin with either account.

---

## STEP 5 — Verify sign-in works

Try signing in at chefsbk.app/auth with:
- Email: seblux100@gmail.com
- Password: 11223344

Should sign in successfully and navigate to dashboard.

Then go to chefsbk.app/admin — should show the admin dashboard.

Also verify pilzner can access /admin.

---

## STEP 6 — Disable auto-confirm for regular users (security)

After creating the admin account, consider whether to keep GOTRUE_MAILER_AUTOCONFIRM=true
for all users. For now during development this is fine. Add a note to CLAUDE.md:

```
## Email Configuration
GOTRUE_MAILER_AUTOCONFIRM=true — email confirmation disabled (no SMTP configured)
All accounts are auto-confirmed on creation.
For production: configure SMTP in .env and set GOTRUE_MAILER_AUTOCONFIRM=false
```

---

## COMPLETION CHECKLIST

- [ ] GOTRUE_MAILER_AUTOCONFIRM=true set in Supabase config
- [ ] supabase-auth container restarted
- [ ] seblux100@gmail.com account created in auth.users
- [ ] user_profiles record created for seblux100@gmail.com
- [ ] admin_users seeded with super_admin for seblux100@gmail.com
- [ ] admin_users seeded with super_admin for pilzner
- [ ] Sign in works at chefsbk.app/auth with seblux100@gmail.com
- [ ] chefsbk.app/admin loads admin dashboard
- [ ] pilzner can also access /admin
- [ ] CLAUDE.md updated with email config note
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
