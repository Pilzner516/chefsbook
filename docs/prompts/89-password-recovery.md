# ChefsBook — Session 89: Password Recovery + Settings Password Change
# Source: Feature request — password recovery email + change password in settings
# Target: apps/web + apps/mobile + RPi5 Supabase config

---

## CONTEXT

Read CLAUDE.md, DONE.md, and all applicable agents per SESSION START sequence.
This session touches web UI, mobile UI, deployment, and Supabase config.
Read ui-guardian.md, data-flow.md, deployment.md, testing.md.

⚠️ CRITICAL DEPENDENCY: Password recovery requires email delivery.
GOTRUE_MAILER_AUTOCONFIRM=true is currently set and NO SMTP is configured.
Before implementing anything, configure SMTP on RPi5 — see Step 0 below.

---

## STEP 0 — Configure SMTP on RPi5

Supabase GoTrue needs an SMTP server to send password recovery emails.
Use Resend (https://resend.com) — free tier allows 100 emails/day, no credit card.

1. Go to https://resend.com and create a free account
2. Create an API key
3. SSH to RPi5 and edit the Supabase .env or docker-compose config:

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
```

Find the GoTrue environment variables (in docker-compose.yml or .env) and add/update:

```
GOTRUE_SMTP_HOST=smtp.resend.com
GOTRUE_SMTP_PORT=587
GOTRUE_SMTP_USER=resend
GOTRUE_SMTP_PASS=<resend_api_key>
GOTRUE_SMTP_ADMIN_EMAIL=noreply@chefsbk.app
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_SMTP_SENDER_NAME=ChefsBook
```

Note: keep GOTRUE_MAILER_AUTOCONFIRM=true — this only controls signup confirmation,
not password recovery. Recovery emails are separate and always require SMTP.

Also set the site URL so recovery links point to the right place:
```
GOTRUE_SITE_URL=https://chefsbk.app
GOTRUE_URI_ALLOW_LIST=https://chefsbk.app/**
```

After editing, restart GoTrue:
```bash
docker compose restart supabase-auth
```

Test email delivery by triggering a password reset via the Supabase API:
```bash
curl -X POST https://api.chefsbk.app/auth/v1/recover \
  -H "apikey: <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"seblux100@gmail.com"}'
```

Confirm the email arrives before proceeding.

---

## STEP 1 — Web: Forgot Password flow

### 1a — Add "Forgot password?" link on the sign-in page

In apps/web/app/auth/page.tsx (or wherever the sign-in form lives):
- Add a "Forgot password?" link below the password input
- Clicking it shows a "Reset Password" form (either inline toggle or separate view)
- The reset form has: email input + "Send reset link" button
- On submit: call `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://chefsbk.app/auth/reset' })`
- Show success message: "Check your email for a reset link"
- Show error if email not found

### 1b — Create password reset page at /auth/reset

Create apps/web/app/auth/reset/page.tsx:
- Supabase sends the user to this URL with a token in the hash (#access_token=...)
- On page load: detect the token from the URL hash and establish the session
- Show a form with: New Password + Confirm Password inputs
- Validate passwords match and minimum 8 characters
- On submit: call `supabase.auth.updateUser({ password: newPassword })`
- On success: show "Password updated!" and redirect to /dashboard after 2 seconds
- On error: show the error message clearly
- Style with Trattoria theme — cream background, red button

---

## STEP 2 — Web: Change password in Settings

In apps/web/app/dashboard/settings/page.tsx:
- Add a "Change Password" section below the existing account fields
- Fields: Current Password, New Password, Confirm New Password
- On submit:
  1. First verify current password by attempting a sign-in (or use `supabase.auth.updateUser` directly — Supabase handles current password verification server-side for authenticated users)
  2. Call `supabase.auth.updateUser({ password: newPassword })`
  3. Show success toast/message: "Password updated"
  4. Clear the fields after success
- Validate: new password min 8 chars, confirm must match
- Show inline validation errors

---

## STEP 3 — Mobile: Forgot Password flow

In apps/mobile, on the sign-in screen:
- Add a "Forgot password?" touchable link below the password field
- Tapping it navigates to a new screen or shows a bottom sheet with an email input
- On submit: call `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://chefsbk.app/auth/reset' })`
  - Note: mobile sends user to the web reset page — this is intentional
  - The deep link handler on mobile can also catch the reset URL if configured
- Show confirmation: "Check your email for a reset link"
- Use Trattoria theme colors — never hardcode hex, use useTheme().colors

---

## STEP 4 — Mobile: Change password in Settings

In apps/mobile settings screen:
- Add a "Change Password" row/section
- Tapping opens a modal or bottom sheet with: Current Password, New Password, Confirm New Password
- Same validation as web (min 8 chars, confirm must match)
- On submit: `supabase.auth.updateUser({ password: newPassword })`
- Show success toast and close modal
- Use ChefsDialog for any alerts/confirmations (never native Alert)

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

Update CLAUDE.md to document:
- SMTP provider: Resend
- Password reset redirect URL: https://chefsbk.app/auth/reset
- GOTRUE_SITE_URL: https://chefsbk.app

---

## COMPLETION CHECKLIST

- [ ] SMTP configured on RPi5 (Resend) — test email delivered successfully
- [ ] GOTRUE_SITE_URL set to https://chefsbk.app
- [ ] Web: "Forgot password?" link on sign-in page
- [ ] Web: /auth/reset page handles token from URL hash and updates password
- [ ] Web: Settings page has Change Password section
- [ ] Mobile: "Forgot password?" link on sign-in screen
- [ ] Mobile: Settings has Change Password modal/sheet
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5 — build succeeds
- [ ] End-to-end test: trigger reset for seblux100@gmail.com, receive email, click link, set new password, sign in with new password
- [ ] Run /wrapup
