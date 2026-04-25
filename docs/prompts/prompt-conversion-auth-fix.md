# Prompt: Fix — "Conversion failed: Not authenticated" on Re-import
# Model: OPUS
# Launch: Read docs/prompts/prompt-conversion-auth-fix.md and execute fully.
# TYPE: CODE FIX

---

## CONTEXT

On the recipe detail page, clicking Re-import → Convert to Technique (or Convert
to Recipe) shows a dialog: "Conversion failed — Not authenticated".

The user IS authenticated — they are the recipe owner (owner controls are visible,
sidebar shows logged-in user). The auth token is not being passed correctly to
the conversion API route.

This was built in Prompt R. The bug is in the API route auth check or the
client-side fetch call.

---

## PRE-FLIGHT

Read these files — nothing else:
- apps/web/app/recipe/[id]/page.tsx — find the conversion handler (Re-import dropdown)
- Find the conversion API route (search for 'convert' in apps/web/app/api/)
- CLAUDE.md for RPi5 deploy

Do NOT read the entire codebase. Surgical fix only.

---

## DIAGNOSIS STEPS

1. Find the client-side fetch call that triggers conversion. Check:
   - Is the `Authorization: Bearer <token>` header included?
   - Is the Supabase session token being retrieved before the fetch?
   - Is it using `fetch` directly or a Supabase client call?

2. Find the API route handler. Check:
   - How does it verify auth? (`getServerSession`, `createRouteHandlerClient`,
     checking the Authorization header, etc.)
   - Does it use `cookies()` for session — and if so, is the client sending
     cookies correctly?

Common patterns that cause this:
- Client sends fetch without credentials: missing `credentials: 'include'`
  or missing Authorization header
- Route uses `createServerComponentClient` instead of `createRouteHandlerClient`
- Route calls `supabase.auth.getUser()` but session cookie isn't forwarded

---

## THE FIX

Once root cause is identified, fix it. Do not change anything else — only
the auth mechanism in the conversion route and/or the client fetch call.

---

## VERIFICATION

```bash
cd apps/web && npx tsc --noEmit
```

Live test:
1. Navigate to any recipe detail page as the owner
2. Click Re-import → Convert to Technique (or the conversion option)
3. Confirm: NO "Not authenticated" error
4. Confirm: conversion proceeds (or shows next step in the flow)
5. Test as non-owner (incognito) → should get a proper "not authorized" error,
   not the same "not authenticated" message

---

## DEPLOYMENT
Follow deployment.md. Build on RPi5, PM2 restart, smoke test.

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION CONVERSION-AUTH-FIX]`) must include:
- Exact root cause (one sentence)
- Which file(s) changed
- Confirmed conversion works as owner
- Confirmed non-owner gets correct error
- tsc clean
- Deploy confirmed: HTTP 200
