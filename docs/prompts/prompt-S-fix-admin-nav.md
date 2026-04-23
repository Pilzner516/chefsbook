# Prompt S-FIX — Admin Nav Reordering + Bot Protection Toggle
## Scope: apps/web (admin sidebar, user sidebar, admin settings, Turnstile route)

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
Find and read these files before touching anything:
- The user-facing sidebar component (added drag-drop in Prompt S)
- The admin sidebar/layout component (`apps/web/app/admin/layout.tsx`)
- The admin settings page
- `apps/web/app/api/auth/verify-turnstile/route.ts`
- `apps/web/app/auth/page.tsx`

Inspect: find where admin settings are stored:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE '%setting%' OR table_name LIKE '%config%'
OR table_name LIKE '%system%';
```

---

## FIX 1 — Remove drag-drop reordering from user sidebar

### Context
Prompt S added drag-and-drop nav reordering to the wrong component —
it was added to the user-facing dashboard sidebar instead of the
admin sidebar.

### What to remove from user sidebar
- Remove all `@hello-pangea/dnd` imports and usage
- Remove grip icons (⠿) from user nav items
- Remove "Reset to default order" button
- Remove any drag-drop event handlers
- Restore the user sidebar to its original static state

### What to KEEP
- The `nav_order` TEXT[] column in user_profiles — keep it, may be
  used for user nav reordering in a future session
- The `/api/user/nav-order` PATCH endpoint — keep it
- The `@hello-pangea/dnd` package in package.json — keep it,
  will be used in admin sidebar

The user sidebar must look and behave exactly as it did before Prompt S.

---

## FIX 2 — Add drag-drop reordering to admin sidebar

### Where
`apps/web/app/admin/layout.tsx` (or wherever the admin nav is rendered).
Read the file fully before modifying.

### Admin nav items that CAN be reordered
All current admin nav links except the fixed ones below. Identify the
full list from the existing layout file.

### Fixed items (always at bottom, NOT reorderable)
- "← Back to app" — always last
- "Settings" — always second to last

### Implementation
Same pattern as Prompt S used for the user sidebar:
- `@hello-pangea/dnd` DragDropContext + Droppable + Draggable
- Grip icon (⠿) visible on hover next to each nav item
- Drag to reorder
- On drag end: save order to DB + update local state optimistically
- "Reset to default order" link appears when order has been customised

### Storage
Store admin nav order in `user_profiles.nav_order` — same column
already created in Prompt S. The admin user (Bob) is also a user
in user_profiles. Use the same `/api/user/nav-order` PATCH endpoint.

To distinguish admin nav order from user nav order, use a separate
key prefix in the array, OR add a new column:
```sql
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS admin_nav_order TEXT[] DEFAULT NULL;
```

Use `admin_nav_order` — do NOT share the same column as user nav
order to avoid conflicts.

Apply migration on RPi5, restart supabase-rest.

---

## FEATURE 3 — Bot Protection toggle in Admin Settings

### Context
Cloudflare Turnstile bot protection was added in Prompt P but is
currently always-on if keys are set. Admins need to be able to
toggle it off for development/testing without editing .env.local.

### Find existing admin settings storage
Check the DB for an existing settings/config table. If one exists,
add a row for bot_protection_enabled. If none exists, create:

```sql
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO system_settings (key, value) 
VALUES ('bot_protection_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
```

Apply migration on RPi5, restart supabase-rest.

Default value: `'false'` (off — safe for development).

### Admin Settings UI
Find the admin Settings page. Add a new section:

**"Security"** section with:
- Toggle switch: **Bot Protection (Cloudflare Turnstile)**
- Helper text: *"Blocks bots on signup and login. Enable in
  production. Requires real Turnstile keys in .env.local"*
- Current status: ON / OFF pill badge next to the label
- When toggled: calls `PATCH /api/admin/settings` with
  `{ key: 'bot_protection_enabled', value: 'true'/'false' }`
- Success toast: *"Bot protection enabled"* or *"Bot protection disabled"*

### API route
Create `PATCH /api/admin/settings/route.ts`:
- Verify admin status (admin_users table)
- Update system_settings row for the given key
- Return updated value

Or extend an existing admin settings route if one exists.

### Wire into Turnstile verification
In `apps/web/app/api/auth/verify-turnstile/route.ts`:

```typescript
// Check if bot protection is enabled before verifying
const setting = await supabaseAdmin
  .from('system_settings')
  .select('value')
  .eq('key', 'bot_protection_enabled')
  .single();

if (setting.data?.value !== 'true') {
  // Bot protection is disabled — skip verification
  return NextResponse.json({ success: true });
}

// Otherwise proceed with Cloudflare verification
```

This means:
- Toggle OFF → all signups/logins pass through without Turnstile
- Toggle ON → Cloudflare Turnstile enforced on every signup/login
- No code deploy needed to switch modes

---

## IMPLEMENTATION ORDER
1. Apply `admin_nav_order` migration on RPi5, restart supabase-rest
2. Apply `system_settings` migration (or add row to existing table)
3. FIX 1 — Remove drag-drop from user sidebar
4. FIX 2 — Add drag-drop to admin sidebar
5. FEATURE 3 — Bot protection toggle in admin settings
6. Wire toggle into verify-turnstile route
7. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
8. Deploy per `deployment.md`

---

## GUARDRAILS
- User sidebar must be IDENTICAL to pre-Prompt-S state after Fix 1
- Admin nav "← Back to app" and "Settings" are never draggable
- Bot protection toggle defaults to OFF — never ON on deploy
- The toggle only affects Turnstile — honeypot and disposable email
  checks always run regardless of toggle state (they have no API cost)
- Admin route must verify admin_users before allowing settings changes
- Use service role client for system_settings reads/writes

---

## REGRESSION CHECKS — MANDATORY
1. User sidebar: no grip icons, no drag behaviour, looks pre-S ✓
2. Admin sidebar: grip icons visible on hover, drag reordering works ✓
3. Admin nav order persists after page reload ✓
4. "Reset to default" restores admin nav original order ✓
5. Admin Settings: Bot Protection toggle visible with ON/OFF state ✓
6. Toggle OFF → signup works without Turnstile ✓
7. Toggle ON → Turnstile widget appears on signup/login ✓
8. Honeypot still works regardless of toggle state ✓
9. Disposable email check still works regardless of toggle state ✓
10. My Recipes images still show ✓
11. Recipe detail page still works ✓

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Confirmation user sidebar restored to pre-S state
- admin_nav_order migration applied confirmed
- system_settings table/row confirmed
- Bot protection toggle default value confirmed (must be 'false')
- All 11 regression checks confirmed
- tsc clean + deploy confirmed
