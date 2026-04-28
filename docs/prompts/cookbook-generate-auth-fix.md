# Prompt: Cookbook PDF — Fix Unauthorized Error on Generate Route

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/cookbook-generate-auth-fix.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: CODE FIX

## Context

When clicking "Generate Preview" in the cookbook print wizard (/dashboard/print),
the UI shows an "Unauthorized" error in a red box. The price calculation step works
correctly (~$16.65 shown) but the generate API call returns 401.

This is the same auth pattern bug that was fixed in session CONVERSION-AUTH-FIX.

---

## Agent files to read before writing any code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/deployment.md`

---

## Step 1 — Find the generate route

```bash
find apps/web/app/api/cookbooks -name "route.ts" | xargs grep -l "generate\|Unauthorized\|auth"
```

The route is likely at:
`apps/web/app/api/cookbooks/[id]/generate/route.ts`

Read it fully before making any changes.

---

## Step 2 — Identify the auth pattern

Look for how the route validates the user. The bug will be one of these patterns:

**Pattern A — using anon client to verify token:**
```typescript
const { data: { user }, error } = await supabase.auth.getUser(token)
// anon client cannot verify tokens — returns null user
```

**Pattern B — missing or incorrect Authorization header extraction:**
```typescript
const token = request.headers.get('Authorization')
// missing .replace('Bearer ', '') or similar
```

**Pattern C — using wrong Supabase client:**
```typescript
import { supabase } from '@/lib/supabase' // anon client
// should use service role client or createServerClient
```

---

## Step 3 — Apply the fix

Reference the fix pattern from session CONVERSION-AUTH-FIX in DONE.md — find that
entry and use the exact same auth approach that was applied there.

The correct pattern for API routes that need to verify a logged-in user is:

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session }, error } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  // proceed with authenticated user
}
```

Apply the same fix to ALL cookbook API routes that have auth checks, not just the
generate route — check:
- `/api/cookbooks/[id]/generate`
- `/api/cookbooks/[id]/price`
- `/api/cookbooks/[id]/order`
- `/api/cookbooks/[id]/submit`
- `/api/cookbooks` (POST/GET)
- `/api/orders`

Fix all of them in one pass to avoid hitting this again on the next step.

---

## Step 4 — Test

1. Deploy to RPi5
2. Go to `/dashboard/print`
3. Build a test cookbook (5+ recipes, any title)
4. Click through all steps to "Generate Preview"
5. Confirm no "Unauthorized" error
6. Confirm PDF generates and is accessible
7. Download the PDF and visually verify:
   - No `ñ` timer characters
   - TOC has single-line dotted entries
   - Warm cream background

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5 via `/mnt/chefsbook/deploy-staging.sh`.

---

## Wrapup

Follow `wrapup.md` fully.
Proof required: confirm "Generate Preview" completes without error.
Note the URL of the generated PDF in DONE.md.
