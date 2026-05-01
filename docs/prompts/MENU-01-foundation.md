# Prompt: ChefsBook Menus — Foundation: Database, Types & Admin Controls

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/MENU-01-foundation.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — WEB + MOBILE

## Overview

This is the foundational session for the ChefsBook Menus feature set. It establishes
the database schema, shared TypeScript types, and the admin control surface that all
subsequent Menus sessions depend on. No user-facing UI is built in this session —
only the infrastructure that every other Menus prompt builds on top of.

Two distinct menu concepts exist in ChefsBook:

1. **My Menus** — A user-curated occasion menu (Thanksgiving, dinner party, date night).
   Structured by course. Pulls from existing ChefsBook recipes. Visible, marketed feature.

2. **Restaurant Menu Scan** — A secret capability inside the existing Scan flow that
   recognises restaurant/specials menus and extracts dishes as recipes. Pro-gated,
   admin-enabled per user, default OFF.

This session: schema for both tracks + admin kill switch only.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/deployment.md`
- `.claude/agents/ai-cost.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Run `\d user_profiles` on RPi5 — confirm column names before adding `menu_scan_enabled`
2. Run `\d recipes` on RPi5 — confirm `tags` column type (text[])
3. Confirm next available migration number from DONE.md
4. Check `apps/web/app/admin/` for the existing admin user detail page pattern
5. Check `packages/db/src/queries/` for the existing query file structure
6. Confirm plan gating pattern from feature-registry.md — Pro check pattern for later sessions

---

## Database migrations

Confirm the next migration number from DONE.md before writing any SQL files.

### Migration A: `menus` table

```sql
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  occasion TEXT,
  -- e.g. 'dinner_party', 'holiday', 'date_night', 'everyday', 'custom'
  notes TEXT,
  -- user's personal notes about this menu
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menus_user_id ON menus(user_id);

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their menus"
  ON menus USING (user_id = auth.uid());

CREATE POLICY "Public menus are readable by all"
  ON menus FOR SELECT USING (is_public = true);
```

### Migration B: `menu_items` table

Each item is a recipe assigned to a course slot within a menu.

```sql
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  course TEXT NOT NULL DEFAULT 'main',
  -- course options: 'starter' | 'soup' | 'salad' | 'main' | 'side' | 'cheese' | 'dessert' | 'drink' | 'other'
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- position within its course
  servings_override INTEGER,
  -- if user wants different servings than the recipe default for this menu
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX idx_menu_items_recipe_id ON menu_items(recipe_id);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Access controlled via menu ownership
CREATE POLICY "Menu items inherit menu owner access"
  ON menu_items USING (
    EXISTS (
      SELECT 1 FROM menus
      WHERE menus.id = menu_items.menu_id
        AND menus.user_id = auth.uid()
    )
  );

CREATE POLICY "Public menu items readable via public menu"
  ON menu_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM menus
      WHERE menus.id = menu_items.menu_id
        AND menus.is_public = true
    )
  );
```

### Migration C: `menu_scan_enabled` flag on `user_profiles`

```sql
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS menu_scan_enabled BOOLEAN NOT NULL DEFAULT false;
```

After all migrations: `docker restart supabase-rest`

---

## Shared TypeScript types

Create `packages/db/src/types/menus.ts`:

```typescript
export type MenuCourse =
  | 'starter'
  | 'soup'
  | 'salad'
  | 'main'
  | 'side'
  | 'cheese'
  | 'dessert'
  | 'drink'
  | 'other';

export const COURSE_ORDER: MenuCourse[] = [
  'starter', 'soup', 'salad', 'main', 'side', 'cheese', 'dessert', 'drink', 'other',
];

export const COURSE_LABELS: Record<MenuCourse, string> = {
  starter:  'Starter',
  soup:     'Soup',
  salad:    'Salad',
  main:     'Main',
  side:     'Side',
  cheese:   'Cheese',
  dessert:  'Dessert',
  drink:    'Drink',
  other:    'Other',
};

export interface Menu {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  occasion: string | null;
  notes: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  menu_id: string;
  recipe_id: string;
  course: MenuCourse;
  sort_order: number;
  servings_override: number | null;
  notes: string | null;
  created_at: string;
}

export interface MenuWithItems extends Menu {
  menu_items: (MenuItem & {
    recipe: {
      id: string;
      title: string;
      description: string | null;
      prep_time: number | null;
      cook_time: number | null;
      servings: number | null;
      image_url: string | null;
    };
  })[];
}
```

Export from `packages/db/src/index.ts`.

---

## Database query functions

Create `packages/db/src/queries/menus.ts`:

```typescript
// getUserMenus(userId) — list all menus for a user, ordered by updated_at desc
// getMenu(menuId) — get a single menu with all items + recipe stubs
// createMenu(data) — insert a new menu row, return the created menu
// updateMenu(menuId, data) — update title/description/occasion/notes/is_public
// deleteMenu(menuId) — delete menu (cascades to menu_items)
// addMenuItem(menuId, recipeId, course, sortOrder, servingsOverride?) — insert menu_item
// updateMenuItem(itemId, data) — update course/sort_order/servings_override/notes
// removeMenuItem(itemId) — delete a single menu_item row
// reorderMenuItems(menuId, itemIds) — update sort_order for all items in a menu in one batch
// getMenuScanEnabled(userId) — fetch menu_scan_enabled from user_profiles
// setMenuScanEnabled(userId, enabled) — update menu_scan_enabled (admin only, use supabaseAdmin)
```

Implement each function. Use `supabase` (anon client) for user-scoped queries.
Use `supabaseAdmin` (service role) only for `setMenuScanEnabled`.

Always run `\d menus` and `\d menu_items` on RPi5 before writing column names.

---

## Admin UI — Secret Features toggle

### Location
Extend the existing admin user detail page (find it under `apps/web/app/admin/`).

### What to add
A new **"Secret Features"** card/section on the admin user detail page, below the
existing plan and account information. It contains a single toggle for now:

**Restaurant Menu Scan**
- Label: `"Restaurant Menu Scan (Pro only)"`
- Description: `"Allows this user to scan restaurant menus and extract dishes as recipes. Only activates for Pro users. Off by default."`
- Toggle: on/off — calls `setMenuScanEnabled(userId, enabled)` via a new admin API route
- Visual state: shows current value fetched from `user_profiles.menu_scan_enabled`
- If user is not Pro: show the toggle as disabled with a note: `"User must be on Pro plan"`

### Admin API route

Create `apps/web/app/api/admin/users/[id]/secret-features/route.ts`:

```typescript
// GET  — returns { menu_scan_enabled: boolean }
// POST — body: { menu_scan_enabled: boolean } — updates the flag
// Both routes: verify caller is in admin_users table (super_admin or admin role)
// Use supabaseAdmin to bypass RLS
```

---

## TypeScript

Run `npx tsc --noEmit` in both `apps/web` and `apps/mobile` before wrapup.
Fix any type errors introduced by this session. Zero errors required.

---

## Testing

### psql verification
```sql
-- Confirm tables exist with correct columns
\d menus
\d menu_items

-- Confirm flag exists on user_profiles
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name = 'menu_scan_enabled';

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('menus', 'menu_items');
```

### Admin UI verification
- Navigate to admin user detail page for a Pro user
- Confirm "Secret Features" section appears
- Toggle Restaurant Menu Scan on → confirm DB updates (`SELECT menu_scan_enabled FROM user_profiles WHERE id = '<id>'`)
- Toggle off → confirm DB updates
- Navigate to admin user detail for a non-Pro user → confirm toggle is disabled with note

### TypeScript
- `cd apps/web && npx tsc --noEmit` — zero errors
- `cd apps/mobile && npx tsc --noEmit` — zero errors

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5.
Run regression smoke test from `testing.md` before wrapup.

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md, record:
- Migration numbers applied
- `menu_scan_enabled` column added to `user_profiles`
- Admin Secret Features toggle shipped
- `packages/db/src/types/menus.ts` and `packages/db/src/queries/menus.ts` created

In feature-registry.md, add:
- `menus-foundation` — status: COMPLETE
- `admin-secret-features-toggle` — status: COMPLETE

In AGENDA.md, confirm next session is `MENU-02-my-menus.md`.
