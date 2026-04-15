# ChefsBook — Session 88: Admin Polish + Search Page Overhaul
# Source: Live review of admin dashboard + search page
# Target: apps/web (admin + search) + apps/mobile (search)

---

## CONTEXT

Read CLAUDE.md, DONE.md, and all applicable agents per SESSION START sequence.
This session touches web UI, data-flow, and deployment — read those agents.
Deploy to RPi5 when all fixes are complete.

---

## FIX 1 — Promo code example text

On the web signup page, the placeholder/example text for the promo code field
currently says "e.g. pro100". Change it to "e.g. disco20".

Find the signup form in apps/web and update the placeholder or helper text.

---

## FIX 2 — Promo code admin page: Create / Delete / Deactivate buttons broken

On /admin/promos (or equivalent), the Create, Delete, and Deactivate buttons
do nothing when clicked. Debug and fix all three:

- Create: likely a form submit handler not wired, or API route failing silently
- Delete: likely missing confirmation + API call
- Deactivate: likely toggle not persisting to DB

Check the component, the API route it calls, and the DB query.
Add try/catch with visible error feedback so failures are not silent.
Use the supabaseAdmin (service role) client for all admin operations — anon
client will fail due to RLS.

---

## FIX 3 — User management: show role as pill in dedicated column

On the /admin/users table, there is a "Make Proctor" button but no visible
indicator of a user's current role. Add:

- A "Role" column to the users table
- Show a pill for each user's current role:
  - super_admin → red pill "Super Admin"
  - admin → orange pill "Admin"  
  - proctor → blue pill "Proctor"
  - (no row in admin_users) → grey pill "User"
- The pill should appear in the Role column, not inline with action buttons
- Query admin_users table joined to user list to determine role

---

## FIX 4 — User management: sortable columns

On the /admin/users table, make these columns sortable by clicking the header:
- Username (A→Z / Z→A)
- Email
- Plan (free/chef/family/pro)
- Created date
- Role

Add a sort indicator arrow (↑ ↓) to the active sort column header.
Default sort: created date descending (newest first).
Sorting should be client-side (data is already loaded).

---

## FIX 5 — Sidebar Admin link: red text, same font size as Settings

In the web app sidebar, the Admin link added in session 87 should:
- Be the same font size as other sidebar items like Settings
- Text colour: pomodoro red (#ce2b37) — not muted/grey
- Keep the shield icon
- Only visible to admin users (already implemented — keep that logic)

Find the sidebar component and update the Admin link styling.

---

## FIX 6 — Public recipes showing only 3

On the admin overview or wherever public recipes are displayed, only 3 are
showing. This is likely a hardcoded limit or a missing `.limit()` removal.

Also check: the a@aol.com (pilzner) account has recipes set to public
visibility. Verify the query fetches ALL recipes where visibility = 'public',
not just the current user's. Remove any limit cap or increase it to a
reasonable number (e.g. 100).

---

## FIX 7 — Search page overhaul (Web + Mobile)

### Problem
The search page shows no recipes by default even with no filters selected.
There is also no clear toggle between "My Recipes" and "All Recipes".

### Fix — Web (apps/web/app/dashboard/search)

1. Add two prominent pill toggle buttons at the top of the search page:
   - "All Recipes" (default, selected on load)
   - "My Recipes"
   - Style: large pill buttons, selected state uses pomodoro red background
     with white text; unselected uses cream/white background with dark text
   - These replace or sit above any existing scope toggle

2. Default behaviour — "All Recipes":
   - On load with no search query and no filters, show ALL recipes the user
     has access to: their own + public recipes + recipes shared with them
   - This should NOT be empty — it is the full browsable catalog
   - Use the existing search RPC or build a simple query:
     `visibility = 'public' OR user_id = current_user_id`
   - Show results in a grid (same card style as dashboard)

3. "My Recipes" behaviour:
   - Filters to only the current user's recipes (any visibility)
   - Same layout

4. Search query behaviour:
   - When user types in the search box, search within the current scope
     (All or My depending on selected pill)

5. Filters (cuisine, course, etc.) apply within the current scope

### Fix — Mobile (apps/mobile/app/(tabs)/search.tsx)

Same logic on mobile:
1. Add "All Recipes" and "My Recipes" pill toggle at top of search tab
2. Default to "All Recipes" showing all accessible recipes on load
3. "My Recipes" filters to own recipes only
4. Search query and filters apply within selected scope
5. Pills should use Trattoria theme colors (accent red for selected,
   soft background for unselected) — never hardcode hex, use useTheme().colors

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

- [ ] Promo code example updated to "e.g. disco20" on signup page
- [ ] Admin promo page: Create / Delete / Deactivate all working with error feedback
- [ ] Admin users table: Role column with colour-coded pills (super_admin/admin/proctor/user)
- [ ] Admin users table: sortable columns with sort indicator arrows
- [ ] Sidebar Admin link: pomodoro red, same font size as Settings
- [ ] Public recipes: all public recipes visible, not capped at 3
- [ ] Web search: "All Recipes" / "My Recipes" pill toggle at top, default All Recipes
- [ ] Web search: All Recipes shows full accessible catalog on load (not empty)
- [ ] Mobile search: same pill toggle, same default behaviour
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5 — all pages return 200
- [ ] Run /wrapup
