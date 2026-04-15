# ChefsBook — Session 111: Quick Fixes Batch
# Items: savers key error, free plan like gate, recipe page sidebar, admin DM error
# Target: apps/web + apps/mobile

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

Four independent quick fixes. Diagnose each before touching code.
All admin queries must go through /api/admin route (session 109 pattern).

---

## FIX 1 — Savers modal: "supabaseKey is required" error

Clicking the bookmark count on recipe detail throws a supabaseKey error.
The getSavers() function or the modal component is calling supabaseAdmin
client-side.

Diagnose:
1. Find the savers modal component in apps/web/app/dashboard/recipe/[id]
2. Find where getSavers() is called — is it in a client component?
3. If getSavers() uses supabaseAdmin directly in a client component,
   move it to an API route: /api/recipe/[id]/savers/route.ts
4. The client component fetches from that API route instead

Fix: savers data must be fetched server-side. The modal client component
calls the API route, not supabaseAdmin directly.

Verify: click bookmark count on Homemade Biscuits, confirm savers list
loads without error.

---

## FIX 2 — Free plan cannot like recipes

The free plan should be view-only. Free users must not be able to like
recipes. This gate must apply on both web and mobile.

Check PLAN_LIMITS in packages/db — confirm canLike is defined per tier.
If missing, add it:
- free: canLike = false
- chef/family/pro: canLike = true

On web recipe detail:
- If user is free plan: heart icon is visible but non-interactive
- Clicking it shows a ChefsDialog upgrade prompt:
  "Liking recipes is available on Chef plan and above. Upgrade to interact
  with the community."
- Show "Upgrade" button linking to /dashboard/plans and "Maybe Later"

On mobile recipe detail:
- Same behaviour — tap heart → ChefsDialog upgrade prompt
- Never native Alert — use ChefsDialog

Do NOT hide the like count or the heart icon — free users can see
how many likes a recipe has, they just cannot add their own.

---

## FIX 3 — Recipe detail page: remove Dashboard button, add full sidebar

On the web recipe detail page (/dashboard/recipe/[id]):
- There is a "Dashboard" button that should be removed
- The full sidebar nav (My Recipes, Search, Shop, Plan, etc.) is missing
- All other dashboard pages show the sidebar — recipe detail must match

Fix:
1. Remove the "Dashboard" button from the recipe detail header/nav
2. Wrap the recipe detail page in the same dashboard layout that other
   pages use, so the sidebar appears on the left
3. The recipe detail content should sit in the main content area to
   the right of the sidebar, same as every other dashboard page
4. Verify: navigating to any recipe shows the full sidebar with all
   nav items visible

---

## FIX 4 — Admin direct message: "new row" error

When an admin sends a direct message from the Users table, they get an
error about "new row". This is likely an RLS violation on direct_messages
insert, or a missing field in the insert payload.

Diagnose:
1. Check the sendMessage() function in packages/db — what does it insert?
2. Run on RPi5:
```sql
\d direct_messages;
-- Check RLS insert policy
SELECT policyname, cmd, qual, with_check
FROM pg_policies WHERE tablename = 'direct_messages';
```
3. The admin send goes through /api/admin route — check what payload
   it passes to sendMessage()
4. Common causes:
   - sender_id is null (admin user_id not passed correctly)
   - RLS INSERT policy requires sender_id = auth.uid() but server-side
     call has no auth context
   - Missing required column

Fix: if RLS is blocking server-side inserts, use supabaseAdmin for
the insert (bypasses RLS). The sendMessage() in packages/db should
accept an optional admin client parameter.

Verify: admin sends a test message to seblux from the Users page,
message appears in seblux's /dashboard/messages inbox.

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

- [ ] Savers modal loads without supabaseKey error
- [ ] Savers fetch moved to API route (server-side)
- [ ] Free plan users see non-interactive heart with upgrade prompt on click
- [ ] Upgrade prompt uses ChefsDialog (not native Alert)
- [ ] Free plan gate applied on both web and mobile
- [ ] Recipe detail page has full sidebar (same as all other dashboard pages)
- [ ] "Dashboard" button removed from recipe detail
- [ ] Admin DM sends successfully — no "new row" error
- [ ] Admin DM appears in recipient's messages inbox
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
