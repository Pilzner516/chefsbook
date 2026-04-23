# Prompt T — Admin Nav Persistence Fix + Admin Create Account
## Scope: apps/web (admin sidebar, admin users page, auth)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ui-guardian.md`

Run ALL pre-flight checklists before writing a single line of code.
Read these files fully before touching anything:
- `apps/web/app/admin/layout.tsx`
- `apps/web/app/api/admin/nav-order/route.ts`
- The admin Users page (find its path in the admin section)

Run on RPi5 before writing any code:
```sql
SELECT admin_nav_order FROM user_profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = 'a@aol.com');
```
Report what this returns — if NULL, the save is broken.
If it has data, the load is broken.

---

## FIX 1 — Admin nav order persistence

### Problem
Admin sidebar drag-drop reordering reverts to default when navigating
away and returning. The order is not persisting across page loads.

### Diagnose first
Before writing any fix, determine which of these is broken:

**A) Save is broken** — admin_nav_order column is NULL in DB after dragging
Check: query DB as above. If NULL after dragging → save broken.

**B) Load is broken** — admin_nav_order has data in DB but isn't applied
Check: if DB has data but nav still shows default order → load broken.

**C) Both broken**

### Fix A — If save is broken
In `apps/web/app/api/admin/nav-order/route.ts`:
- Add error logging — log the full Supabase error if update fails
- Verify the user ID being used matches the authenticated admin
- Verify the column name is exactly `admin_nav_order`
- Test with a direct DB insert to confirm the column accepts data

### Fix B — If load is broken
In `apps/web/app/admin/layout.tsx`:
- The useEffect that loads `admin_nav_order` must run on every mount
- It must AWAIT the data fetch before setting `orderedNavItems`
- The admin layout likely re-mounts on every page navigation —
  the fetch must restore from DB each time, not rely on local state
- Pattern to use:
```typescript
useEffect(() => {
  async function loadNavOrder() {
    const { data } = await supabase
      .from('user_profiles')
      .select('admin_nav_order')
      .eq('id', user.id)
      .single();
    
    if (data?.admin_nav_order && data.admin_nav_order.length > 0) {
      // Reorder DEFAULT_REORDERABLE_NAV based on saved order
      const ordered = [...DEFAULT_REORDERABLE_NAV].sort((a, b) => {
        const aIdx = data.admin_nav_order.indexOf(a.key);
        const bIdx = data.admin_nav_order.indexOf(b.key);
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
      setOrderedNavItems(ordered);
      setAdminNavOrder(data.admin_nav_order);
    }
  }
  if (user?.id) loadNavOrder();
}, [user?.id]); // Re-runs when user changes, and on every mount
```

### After diagnosing and fixing
Verify end-to-end:
1. Drag an item to a new position
2. Navigate to a different admin page
3. Return to admin — order must be preserved
4. Hard refresh (Ctrl+Shift+R) — order must still be preserved

---

## FEATURE 2 — Admin: Create Account

### Context
Admins need to be able to create user accounts directly from the
admin panel. This bypasses:
- Email confirmation (admin-created accounts are auto-confirmed)
- Cloudflare Turnstile (no bot check needed for admin-created accounts)
- Disposable email check (admin knows what they're doing)

### Where to add it
Find the admin Users page. Add a **"+ Create Account"** button
in the top-right, consistent with other admin action buttons.

### Create Account form (modal/drawer)
Clicking opens a ChefsDialog or drawer with:
- **Email** (required) — text input
- **Password** (required) — text input with show/hide toggle
  Minimum 8 characters. Admin sets the initial password.
- **Username** (required) — text input
- **Display name** (optional) — text input
- **Plan** (required) — dropdown: Free / Chef / Family / Pro
  Default: Free
- **Role** (required) — dropdown: User / Admin
  Default: User
- **Send welcome email** — checkbox, default OFF
  If checked: send a welcome email to the new user
- Submit button: **"Create Account"** (primary, pomodoro red)
- Cancel button: ghost

### API route
Create `POST /api/admin/users/create`:
- Verify admin status (admin_users table) before any action
- Use Supabase **service role** client (required for admin user creation)
- Call `supabaseAdmin.auth.admin.createUser()` with:
  ```typescript
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,  // auto-confirm, no email verification needed
    user_metadata: {
      username,
      display_name: displayName || username,
    }
  });
  ```
- After creating auth user, create `user_profiles` row:
  ```typescript
  await supabaseAdmin.from('user_profiles').insert({
    id: data.user.id,
    username,
    display_name: displayName || username,
    plan: plan,  // 'free' | 'chef' | 'family' | 'pro'
  });
  ```
- If role is 'admin': also insert into `admin_users` table
- If send welcome email is checked: send via existing email system
  (check how other emails are sent in the codebase)
- Return `{ userId, email, username }` on success

### After creation
- Close the modal
- Refresh the users list
- Show success toast: *"Account created for {email}"*
- The new user can log in immediately with the provided credentials

### Error handling
- Email already exists → *"An account with this email already exists"*
- Username taken → *"This username is already taken"*
- Weak password → *"Password must be at least 8 characters"*
- General error → *"Failed to create account. Please try again."*

---

## IMPLEMENTATION ORDER
1. Query DB to diagnose nav persistence issue (before any code)
2. FIX 1 — Admin nav persistence (targeted fix based on diagnosis)
3. FEATURE 2 — Create Account API route
4. FEATURE 2 — Create Account UI (button + modal on Users page)
5. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
6. Deploy per `deployment.md`

---

## GUARDRAILS
- Admin create account MUST use service role client — regular client
  cannot create auth users
- `email_confirm: true` is mandatory — admin-created accounts skip
  email verification entirely
- If role = 'admin' is selected, double-check the admin is really
  creating another admin (no accidental promotions)
- Never expose the service role key to the client — API route only
- The create account form must validate all fields before submitting

---

## REGRESSION CHECKS — MANDATORY
1. Admin nav order persists after navigating away and returning ✓
2. Admin nav order persists after hard refresh ✓
3. Drag-drop still works after the persistence fix ✓
4. "Reset to default" still works ✓
5. Admin Users page: "Create Account" button visible ✓
6. Create Account modal opens and validates fields ✓
7. Created account can log in immediately ✓
8. Admin-created account is auto-confirmed (no email verification) ✓
9. If role=Admin selected: user appears in admin_users table ✓
10. My Recipes images still show ✓
11. Recipe detail page still works ✓

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Which was broken (save or load) for nav persistence
- SQL proof that admin_nav_order saves correctly after fix
- New API route path for create account
- Confirmation email_confirm: true is set
- All 11 regression checks confirmed
- tsc clean + deploy confirmed
