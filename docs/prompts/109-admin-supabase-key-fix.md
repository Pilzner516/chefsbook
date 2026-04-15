# ChefsBook — Session 109: Fix "supabaseKey is required" on Admin Pages
# Source: Live review — all admin pages show supabaseKey error
# Target: apps/web admin pages

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

All admin pages show: "supabaseKey is required."

Root cause: Admin pages were converted to client components (to fix the
auth/session issue) but supabaseAdmin uses the SUPABASE_SERVICE_ROLE_KEY
which is a server-only secret. Service role keys MUST NEVER be sent to
the browser. Client components cannot use supabaseAdmin directly.

The fix requires a proper server/client split:
- Data fetching with supabaseAdmin → server-side only (API routes or
  Server Components)
- Auth check + UI rendering → client component

---

## THE CORRECT ARCHITECTURE FOR ADMIN PAGES

Admin pages need BOTH:
1. Client-side auth check (to verify the user is an admin)
2. Server-side data fetching (to use service role key safely)

The correct pattern:

```
/admin/users/page.tsx          ← Server Component
  - Fetches data via supabaseAdmin (service role, server-only)
  - Passes data as props to the client component
  - Handles redirect if not admin

/admin/users/UsersClient.tsx   ← Client Component  
  - Receives data as props
  - Handles UI state (search, sort, modals)
  - Makes additional fetches via /api/admin/* routes (never directly)
```

OR alternatively, all data fetching goes through API routes:

```
/api/admin/users/route.ts      ← API Route (server-only)
  - Verifies admin session server-side
  - Uses supabaseAdmin for DB queries
  - Returns JSON

/admin/users/page.tsx          ← Client Component
  - Fetches from /api/admin/users with credentials
  - Renders UI
```

Choose whichever pattern is already partially in place for the admin
section — do not mix both patterns. Be consistent across all admin pages.

---

## STEP 1 — Audit current admin page structure

Read every file in apps/web/app/admin/ and determine:
1. Which pages are currently Client Components ('use client')?
2. Which are Server Components?
3. Where is supabaseAdmin being called — server or client?
4. What is the existing pattern for the pages that DO work (Overview)?

---

## STEP 2 — Fix all broken admin pages

For each page showing "supabaseKey is required":
- /admin/recipes
- /admin/users  
- /admin/messages

Move all supabaseAdmin calls to server-side:

Option A (preferred if other pages use this pattern):
- Convert page.tsx back to a Server Component
- Do admin auth check server-side using getServerSession or cookies()
- Fetch data with supabaseAdmin in the Server Component
- Pass data as props to a Client Component for interactivity

Option B (if API routes are already in use):
- Create /api/admin/[page]/route.ts for each broken page
- Move supabaseAdmin queries into these API routes
- Client component fetches from the API route using fetch() with
  credentials: 'include'
- API route verifies admin status before returning data

Whichever option is chosen, apply it consistently to ALL admin pages.

---

## STEP 3 — Verify admin auth check still works

After the refactor, confirm:
1. Non-admin users are still redirected away from /admin
2. Admin users (pilzner, seblux) can access all admin pages
3. No "supabaseKey is required" error on any admin page
4. Data loads correctly on Users, Recipes, Messages pages

---

## STEP 4 — Check .env.local on RPi5

Also verify that SUPABASE_SERVICE_ROLE_KEY is correctly set in
apps/web/.env.local (or .env.production) on the Pi:

```bash
ssh rasp@rpi5-eth
grep SUPABASE_SERVICE_ROLE_KEY /mnt/chefsbook/repo/apps/web/.env.local
grep SUPABASE_SERVICE_ROLE_KEY /mnt/chefsbook/repo/apps/web/.env.production
```

If missing, add it. The key must be present for supabaseAdmin to work
server-side.

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

- [ ] Root cause confirmed: service role key exposed to client component
- [ ] SUPABASE_SERVICE_ROLE_KEY confirmed present in server env on RPi5
- [ ] All supabaseAdmin calls moved to server-side (Server Component or API route)
- [ ] /admin/users loads user list without error
- [ ] /admin/recipes loads recipe list without error
- [ ] /admin/messages loads without error
- [ ] Non-admin redirect still works
- [ ] Admin auth check still works for pilzner + seblux
- [ ] No "supabaseKey is required" error on any admin page
- [ ] Consistent server/client pattern across all admin pages
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
