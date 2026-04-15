# ChefsBook — Session 59: Fix Shopping Crash + Comments Table + Likes Click
# Source: Live QA 2026-04-10
# Target: RPi5 DB + apps/web

---

## CONTEXT

Three confirmed failures from live browser testing on chefsbk.app:
1. Shopping list still crashes with application error when opening any list
2. Comments fail with "Could not find the table 'public.recipe_comments' in schema cache"
3. Clicking the like count removes the like instead of showing who liked it

Read .claude/agents/testing.md, .claude/agents/data-flow.md, and
.claude/agents/deployment.md before starting. Fix and verify each issue
on the live site before moving to the next.

---

## FIX 1 — Shopping list application crash

### Investigation
Get the exact error from PM2 logs:
```bash
ssh rasp@rpi5-eth
pm2 logs chefsbook-web --lines 50 2>&1 | grep -i "error\|Error\|undefined\|null"
```

Also check the Next.js error details:
```bash
cd /mnt/chefsbook/repo/apps/web
cat .next/server/app/dashboard/shop/page.js 2>/dev/null | head -5
```

Check if session 58 was actually deployed — compare git log on Pi vs local:
```bash
cd /mnt/chefsbook/repo
git log --oneline -5
```

If session 58 changes are not on the Pi, pull and rebuild:
```bash
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

If session 58 IS deployed and crash persists, the root cause is still the
null store join. Find the shopping list component and add defensive null
checks everywhere `list.store` is accessed:

```tsx
// Find every instance of list.store in apps/web/app/dashboard/shop/
grep -rn "list\.store\|lists\.store" apps/web/app/dashboard/shop/ --include="*.tsx"

// Make every access safe:
list.store?.name ?? list.store_name ?? list.name
list.store?.logo_url ?? null
list.store?.initials ?? null
```

Also wrap the entire shop page render in an error boundary or try/catch so
a single broken list doesn't crash the entire page.

### Verify
Open chefsbk.app/dashboard/shop → all lists visible → tap ShopRite → opens
→ tap Sunday meals (no store) → opens. No crash on any list.

---

## FIX 2 — recipe_comments not in PostgREST schema cache

### Step A — Restart PostgREST to refresh schema cache
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose restart supabase-rest
```

Wait 30 seconds, then test: try posting a comment on a public recipe.

### Step B — If restart doesn't fix it, verify the table exists
```bash
docker compose exec db psql -U postgres -d postgres -c "\d recipe_comments"
```

If the table doesn't exist, migration 021 was never applied to this Pi.
Apply it now:
```bash
docker compose exec db psql -U postgres -d postgres -c "
CREATE TABLE IF NOT EXISTS recipe_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES recipe_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  status TEXT DEFAULT 'visible',
  flag_severity TEXT,
  flag_source TEXT,
  flag_reason TEXT,
  flagged_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE recipe_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS \"Anyone can read visible comments\"
  ON recipe_comments FOR SELECT
  USING (status = 'visible' OR status = 'approved' OR user_id = auth.uid());

CREATE POLICY IF NOT EXISTS \"Auth users can insert comments\"
  ON recipe_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS \"Users can update own comments\"
  ON recipe_comments FOR UPDATE
  USING (user_id = auth.uid());
"

# Restart PostgREST after creating the table:
docker compose restart supabase-rest
```

### Step C — Also check comment_flags and blocked_commenters tables
```bash
docker compose exec db psql -U postgres -d postgres -c \
  "\dt public.*comment*"
```

All three tables must exist: recipe_comments, comment_flags, blocked_commenters.
If any are missing, apply their CREATE TABLE statements from the migration history.

### Verify
Open a public recipe on chefsbk.app → scroll to comments section → type a
comment → click Post → comment appears in the list.

Confirm in DB:
```bash
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT id, content, status FROM recipe_comments ORDER BY created_at DESC LIMIT 3;"
```

---

## FIX 3 — Clicking like count removes like instead of showing likers

### Current behaviour
Clicking the like count number (e.g. "♡ 3") toggles the like off instead of
showing a sheet/modal of who liked the recipe.

### Root cause
The like count display element is wrapped inside the LikeButton component or
shares the same click handler as the like toggle. The count click needs a
separate handler.

### Fix
In the web `LikeButton` component, separate the count click from the toggle:

```tsx
// The heart icon toggles the like:
<button onClick={handleToggleLike}>
  {isLiked ? '❤️' : '♡'}
</button>

// The count shows likers (only for recipe owner):
{isOwner ? (
  <button onClick={handleShowLikers} style={{ cursor: 'pointer' }}>
    {likeCount}
  </button>
) : (
  <span>{likeCount}</span>  // non-owners: count is not clickable
)}
```

The likers sheet/modal should show:
```
┌─────────────────────────────────┐
│  3 people liked this recipe     │
│─────────────────────────────────│
│  [Avatar] @username1     ↗     │
│  [Avatar] @username2     ↗     │
│  [Avatar] @username3     ↗     │
└─────────────────────────────────┘
```

Each row links to that user's profile (`/u/[username]`).
Only the recipe owner sees this — other users see the count as plain text.

### Verify
As the recipe owner: click like count → likers modal opens (does NOT toggle like).
As another user: like count is plain text, not clickable.

---

## DEPLOYMENT

After all three fixes:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Test all three on chefsbk.app before declaring done:
1. Open any shopping list → no crash
2. Post a comment → appears in list
3. Click like count as recipe owner → likers modal, NOT like toggle

---

## COMPLETION CHECKLIST

- [ ] PM2 logs checked — shopping crash root cause identified
- [ ] Shopping lists open without crash (with AND without store)
- [ ] recipe_comments table confirmed exists on RPi5 (or created)
- [ ] PostgREST restarted after any schema changes
- [ ] Comment posts successfully — confirmed in DB via psql
- [ ] Like count separated from like toggle in LikeButton component
- [ ] Recipe owner: clicking count opens likers modal
- [ ] Non-owner: like count is plain non-clickable text
- [ ] All three verified live on chefsbk.app
- [ ] Deployed to RPi5 — build succeeded, pm2 restarted
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
