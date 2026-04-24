# Prompt: Welcome Email + Admin Quick Fixes
# Launch: Read docs/prompts/prompt-welcome-email-admin-fixes.md and execute it fully.

## OBJECTIVE
Two small web tasks — wire up the welcome email that was flagged TODO in Prompt T,
and fix the Incomplete Recipes admin page stale data issue.

## PRE-FLIGHT
1. Read `.claude/agents/testing.md` — MANDATORY
2. Read `.claude/agents/deployment.md` — MANDATORY
3. Read `.claude/agents/feature-registry.md` — check email and admin page entries

---

## FIX 1 — Welcome Email on Signup

### Background
Prompt T added account creation flow but left a TODO comment for wiring in the
welcome email. Resend SMTP is already configured (smtp.resend.com, noreply@chefsbk.app).

### What to do
1. Find the signup route/handler in apps/web — look for the TODO comment from T
2. Find if a welcome email template already exists anywhere in the codebase
3. If a template exists — wire it into the signup completion handler
4. If no template exists — create a simple one:
   - Subject: "Welcome to ChefsBook, [name]!"
   - Body: warm welcome, link to dashboard, link to import first recipe
   - Trattoria brand colours (cream background #faf7f0, pomodoro red #ce2b37 accents)
   - Keep it short — 3-4 paragraphs max
5. The email must only send ONCE — on first successful signup, not on every login
6. Use the existing Resend/SMTP setup — do not introduce a new email library

### Verification
Create a test account and confirm the welcome email arrives.
Check that re-logging in does NOT trigger another welcome email.

---

## FIX 2 — Incomplete Recipes Admin Page Stale Data

### Symptom
The /admin/incomplete-recipes page shows stale data because Next.js is
statically caching the route.

### Fix
Add to the top of apps/web/app/admin/incomplete-recipes/page.tsx:

  export const dynamic = 'force-dynamic'

That's the entire fix. Confirm the page returns fresh data after a hard reload.

---

## TYPESCRIPT + DEPLOYMENT
1. cd apps/web && npx tsc --noEmit — must be clean
2. Deploy per deployment.md

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Welcome email: confirmed sent to test account (describe subject line seen)
- Incomplete recipes: confirmed force-dynamic added, fresh data on reload
- tsc clean confirmed
- Deploy confirmed
