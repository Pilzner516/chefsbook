# Prompt: Fix Admin Account Creation + Welcome Email

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/fix-account-creation-welcome-email.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUG FIX — WEB ONLY

## Overview

Two related issues are blocking admin account creation:

1. **Internal server error on account creation** — When the admin creates a new user via `/admin/users`, the form returns "Internal server error". Root cause is the documented GoTrue NULL token crash: users created with `GOTRUE_MAILER_AUTOCONFIRM=true` get NULL `confirmation_token`, `recovery_token`, and related columns, which causes GoTrue to crash when it later tries to scan that user. The create route must patch these NULL columns immediately after user creation.

2. **Welcome emails not sending** — `RESEND_API_KEY` was never added to `.env.local` on the RPi5. The welcome email code exists and is wired up, but silently skips sending because the key is absent.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/deployment.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read the current contents of `apps/web/app/api/admin/users/create/route.ts` in full
2. Read `apps/web/lib/email.ts` to confirm the welcome email implementation
3. Confirm the GoTrue NULL token gotcha in CLAUDE.md (search "GoTrue NULL token crash")
4. Check the existing pattern used to fix this in session 85 (DONE.md) — the same SQL must now be applied programmatically inside the create route
5. Confirm `RESEND_API_KEY` is absent from `/mnt/chefsbook/repo/apps/web/.env.local` on RPi5:
   ```bash
   grep -i resend /mnt/chefsbook/repo/apps/web/.env.local
   ```
6. Confirm next available migration number from DONE.md (needed only if a schema change is required — likely not)

---

## Fix 1 — GoTrue NULL token crash in create route

### Root cause

`GOTRUE_MAILER_AUTOCONFIRM=true` is set on the RPi5. When `supabase.auth.admin.createUser()` creates a user with email confirmation bypassed, GoTrue leaves token columns as `NULL`. When GoTrue later tries to scan that user (e.g. on sign-in), the Go NULL scanner panics → 500.

This was previously fixed manually for the `seblux100` account in session 85 via a one-off `psql` command. It must now be fixed automatically inside the create route so every new account works.

### Fix

In `apps/web/app/api/admin/users/create/route.ts`, immediately after the `supabase.auth.admin.createUser(...)` call succeeds and you have the new user's `id`, add a direct SQL patch using `supabaseAdmin`:

```typescript
// Fix GoTrue NULL token crash (GOTRUE_MAILER_AUTOCONFIRM=true leaves NULL token columns)
await supabaseAdmin.from('_gofix').select().throwOnError().catch(() => null) // no-op to test client
// Use raw SQL via rpc or a direct postgres query:
await supabaseAdmin.rpc('exec_sql', {
  sql: `UPDATE auth.users
        SET confirmation_token       = COALESCE(confirmation_token, ''),
            recovery_token           = COALESCE(recovery_token, ''),
            email_change_token_new   = COALESCE(email_change_token_new, ''),
            email_change_token_current = COALESCE(email_change_token_current, ''),
            reauthentication_token   = COALESCE(reauthentication_token, '')
        WHERE id = '${newUserId}'`
})
```

> **Note:** Check whether `exec_sql` RPC exists. If not, use `supabaseAdmin` with the postgres client directly, or use a `supabase.rpc` that's already present in the codebase. Look at how other routes call raw SQL before deciding the approach. Do NOT create a new migration just for this — it's a runtime data patch.

If no existing RPC pattern works, fall back to executing via the existing `psql` approach via a server-side shell exec — but prefer a clean TypeScript solution using the admin client.

**Important:** Wrap this patch in try/catch. If the patch fails, log the error but do NOT abort the account creation response — the account was already created successfully and the failure should be surfaced in logs, not to the admin UI.

---

## Fix 2 — RESEND_API_KEY

Add the key to `.env.local` on the RPi5:

```bash
# On RPi5:
echo 'RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx' >> /mnt/chefsbook/repo/apps/web/.env.local
```

Obtain the key from: https://resend.com/api-keys (under the ChefsBook workspace). The sender domain is `noreply@chefsbk.app`.

After adding the key, verify it is present:
```bash
grep RESEND_API_KEY /mnt/chefsbook/repo/apps/web/.env.local
```

---

## Testing

### Account creation smoke test
1. Navigate to `https://chefsbk.app/admin/users`
2. Click "Create Account"
3. Fill in email, password, username, display name — select Plan: Pro, Role: User
4. Check "Send welcome email"
5. Click "Create Account"
6. **Expected:** No "Internal server error" — account is created successfully
7. Verify via psql that the new user's token columns are empty strings, not NULL:
   ```sql
   SELECT id, email, confirmation_token, recovery_token
   FROM auth.users
   ORDER BY created_at DESC
   LIMIT 1;
   ```
8. Verify the new user can sign in at `https://chefsbk.app/auth`

### Welcome email smoke test
1. Create a test account with "Send welcome email" checked
2. Confirm email arrives at the address used
3. If the Resend API key is correct but email doesn't arrive, check Resend dashboard logs at https://resend.com/emails
4. Check PM2 logs for any Resend errors:
   ```bash
   pm2 logs chefsbook-web --lines 30 --nostream
   ```

### Regression
- Existing user sign-in still works (pilzner + seblux100)
- `/admin/users` page loads without errors
- No TypeScript errors: `cd apps/web && npx tsc --noEmit`

---

## Deploy

Follow `deployment.md`. Web only — no mobile changes.

Build command on RPi5:
```bash
/mnt/chefsbook/deploy-staging.sh
```

Restart after deploy:
```bash
pm2 restart chefsbook-web
```

Smoke test: `curl -I https://chefsbk.app/admin/users` → expect HTTP 200.

---

## Wrapup

Follow `wrapup.md` fully. In DONE.md, record:
- GoTrue NULL token patch is now automatic in the create route (no more manual psql fixes needed for new accounts)
- `RESEND_API_KEY` added to RPi5 `.env.local` — welcome emails now live
- Remove the "⚠️ Email sending requires RESEND_API_KEY" warning from DONE.md's welcome email session entry and replace with ✅ confirmed working
