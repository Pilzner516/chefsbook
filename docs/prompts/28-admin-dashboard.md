# ChefsBook — Session 28: Admin Dashboard
# Depends on: Sessions 26, 27
# Target: apps/admin (new Next.js app in monorepo) OR apps/web admin section

---

## CONTEXT

A separate web-only admin dashboard for super admins, admins, and proctors.
Accessible at `chefsbk.app/admin` or as a separate app. Build as a protected section
of `apps/web` under `/admin` routes — no separate app needed.

Super admin: seblux100@gmail.com (already exists in auth)

---

## ADMIN ROLES

```sql
-- Migration 019_admin_roles.sql
CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'proctor');

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role admin_role NOT NULL,
  added_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Seed super admin (replace with actual UUID)
-- INSERT INTO admin_users (user_id, role)
-- VALUES ('[seblux_user_id]', 'super_admin');

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can read admin_users"
  ON admin_users FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );
```

---

## ROUTE PROTECTION

All `/admin/*` routes check:
1. User is authenticated
2. User exists in `admin_users` table
3. Role determines what sections are visible

Redirect non-admins to `/dashboard` with no error message (security through obscurity).

---

## ADMIN DASHBOARD SECTIONS

### 1. Overview (all roles)
- Total users by plan
- New signups today / this week
- Active sessions
- Pending flagged comments count (highlighted red if > 0)
- Recent recipe imports count

### 2. User Management (super_admin + admin)
Table of all users with columns:
- Avatar, username, display name, email
- Plan, joined date, last active
- Recipe count, follower count
- Status: Active / Suspended
- Actions: View profile, Toggle access (suspend/restore), Change plan, Add admin role

Filters: by plan, by status, by join date
Search: by username, email, display name

**Toggle access:** sets a `is_suspended` flag on `user_profiles`. Suspended users
see a "Your account has been suspended" message on login. Add this column:
```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
```

**Change plan:** super_admin and admin can change any user's plan directly.

**Add admin role:** super_admin only can promote users to admin or proctor.

### 3. Flagged Comments (all roles)
Priority section — shown prominently when flags exist.

Table of flagged comments:
- Comment text
- Commenter username (link to profile)
- Recipe it was posted on (link)
- Flag reason (AI flagged / user reported)
- Severity (serious / mild)
- Status: Pending / Approved / Rejected

**Serious violations** (AI auto-hid + commenter suspended):
- Shown with red badge "AUTO-HIDDEN — PENDING REVIEW"
- Actions: Approve (restore comment + restore commenter) / Reject (delete comment, keep suspension)

**Mild violations** (AI flagged, comment visible):
- Shown with yellow badge "FLAGGED — REVIEW NEEDED"
- Actions: Approve (clear flag) / Reject (hide comment)

**User reported:**
- Shown with blue badge "USER REPORTED"
- Same approve/reject actions

### 4. Recipe Moderation (admin + proctor)
- List of public recipes with report count
- Flag/remove recipe
- View recipe detail
- Search by title, username

### 5. Promo Codes (super_admin only)
- List all promo codes with use count
- Create new promo code:
  - Code string
  - Target plan
  - Discount percent
  - Max uses (optional)
  - Expiry date (optional)
- Toggle active/inactive
- Delete

### 6. Plan Tier Management (super_admin only)
- View current tier definitions
- Adjust limits (stored in DB, not hardcoded — see below)
- This is read-only display for now; limits come from PLAN_LIMITS constants

### 7. Help Requests (admin + proctor)
- List of user-submitted help requests (feature to be added to user-facing app)
- Mark as resolved
- Reply (sends email — future feature, just store reply for now)

---

## PLAN LIMITS IN DB (for admin editability)

Add a `plan_limits` table so super_admin can adjust limits without a code deploy:

```sql
CREATE TABLE IF NOT EXISTS plan_limits (
  plan plan_tier PRIMARY KEY,
  own_recipes INTEGER,  -- NULL = unlimited
  shopping_lists INTEGER,
  cookbooks INTEGER,
  images_per_recipe INTEGER,
  family_members INTEGER,
  can_import BOOLEAN DEFAULT false,
  can_ai BOOLEAN DEFAULT false,
  can_share BOOLEAN DEFAULT false,
  can_comment BOOLEAN DEFAULT false,
  can_pdf BOOLEAN DEFAULT false,
  can_meal_plan BOOLEAN DEFAULT false,
  priority_ai BOOLEAN DEFAULT false,
  monthly_price_cents INTEGER DEFAULT 0,
  annual_price_cents INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed with current limits
INSERT INTO plan_limits VALUES
  ('free',   0,    1,    0,   0, 0, false, false, false, false, false, false, false, 0,    0),
  ('chef',   75,   5,   10,   1, 0, true,  true,  true,  true,  false, true,  false, 499,  399),
  ('family', 200,  5,   25,   1, 3, true,  true,  true,  true,  false, true,  false, 999,  799),
  ('pro',    NULL, NULL, NULL, 5, 0, true,  true,  true,  true,  true,  true,  true,  1499, 1199)
ON CONFLICT (plan) DO NOTHING;
```

The `usePlanGate` hook should read from this table (with a fallback to hardcoded
constants if the table is unavailable).

---

## SUSPENDED USER HANDLING

On every authenticated request, check `is_suspended`. If true:
- Mobile: show full-screen suspension notice with contact link
- Web: redirect to `/suspended` page with message

---

## COMPLETION CHECKLIST

- [ ] Migration 019 applied (admin_users, is_suspended, plan_limits)
- [ ] Super admin seeded for seblux100@gmail.com
- [ ] /admin routes protected — non-admins redirected silently
- [ ] Overview dashboard with key metrics
- [ ] User management table with search, filter, suspend, plan change
- [ ] Flagged comments section with severity indicators and approve/reject
- [ ] Recipe moderation section
- [ ] Promo code management (create, toggle, delete)
- [ ] Plan limits table seeded and readable from admin UI
- [ ] Help requests section (empty state OK for now)
- [ ] Suspended user sees suspension notice in app and web
- [ ] plan_limits DB table used by usePlanGate as source of truth
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
