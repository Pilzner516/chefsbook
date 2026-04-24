# Prompt V — User Suspension/Expulsion + Admin Messages Hub
## Scope: apps/web (admin users page, admin messages, user-facing banner, content visibility)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ui-guardian.md`
8. `.claude/agents/data-flow.md`

Run ALL pre-flight checklists before writing a single line of code.

Inspect:
```sql
\d user_profiles
\d messages (or find actual messages table name)
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE '%message%' OR table_name LIKE '%flag%';
```

Read the existing admin pages fully:
- Admin Users page
- Admin Flagged Recipes page
- Admin Flagged Comments page
- Admin Messages page (current flagged messages)

---

## FEATURE 1 — User suspension and expulsion

### Database changes

```sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS account_status TEXT 
  DEFAULT 'active' 
  CHECK (account_status IN ('active', 'suspended', 'expelled'));

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS pre_suspension_plan TEXT DEFAULT NULL;
-- Stores plan tier before suspension so it can be restored

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE user_profiles  
ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES auth.users(id);

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS status_reason TEXT DEFAULT NULL;
```

Apply migration on RPi5, restart supabase-rest.

### Admin UI — Suspend/Expel buttons on Users page

On the admin Users page, each user row already has action buttons.
Add two new action buttons per user row:

**Suspend button:**
- Label: "Suspend" (amber/orange colour — warning, not destructive)
- If user is already suspended: show "Unsuspend" (green)
- Clicking "Suspend" opens ChefsDialog:
  - Title: *"Suspend this user?"*
  - Message: *"@{username} will be restricted to the Free plan.
    Their content remains visible but they lose access to paid
    features. They will be notified and can message support."*
  - Optional reason field (text input, admin notes)
  - Buttons: **"Suspend"** (amber) / **"Cancel"** (ghost)

**Expel button:**
- Label: "Expel" (red — destructive warning)
- If user is already expelled: show "Reinstate" (green)
- Clicking "Expel" opens ChefsDialog:
  - Title: *"Expel this user?"*
  - Message: *"ALL of @{username}'s content (recipes, techniques,
    comments, messages) will be hidden from every member immediately.
    This includes recipes others have saved. They will be notified
    and can message support."*
  - Optional reason field
  - Buttons: **"Expel"** (red) / **"Cancel"** (ghost)

**States are mutually exclusive** — suspending an expelled user
removes expelled status and vice versa. Active = neither suspended
nor expelled.

### API routes

`POST /api/admin/users/[userId]/suspend`:
```typescript
// Verify admin, then:
// 1. Store current plan in pre_suspension_plan
// 2. Set account_status = 'suspended'
// 3. Set plan = 'free' (force free plan)
// 4. Set status_changed_at, status_changed_by, status_reason
// 5. Send notification message to user (see Feature 3)
```

`POST /api/admin/users/[userId]/unsuspend`:
```typescript
// 1. Restore plan from pre_suspension_plan (or 'free' if null)
// 2. Set account_status = 'active'
// 3. Clear status fields
```

`POST /api/admin/users/[userId]/expel`:
```typescript
// 1. Set account_status = 'expelled'
// 2. Set status_changed_at, status_changed_by, status_reason
// 3. Send notification message to user
// Content visibility handled at query level (see Feature 2)
```

`POST /api/admin/users/[userId]/reinstate`:
```typescript
// 1. Set account_status = 'active'
// 2. Clear status fields
// Content becomes visible again automatically
```

---

## FEATURE 2 — Content visibility enforcement for expelled users

### Rule
When a user is expelled (`account_status = 'expelled'`):
- Their recipes are hidden from ALL other users
  (including users who saved them — unlike private recipes)
- Their techniques are hidden from all other users
- Their comments are hidden from all other users
- Their messages to other users are hidden
- The expelled user themselves can still see their own content

### Where to enforce

**Recipe queries:**
In `listRecipes()`, `searchRecipes()`, and any public recipe feed:
Add a JOIN or subquery to exclude recipes where the owner's
`account_status = 'expelled'`:

```sql
JOIN user_profiles up ON up.id = r.user_id
WHERE up.account_status != 'expelled'
```

**Recipe detail page:**
If `recipe.owner.account_status = 'expelled'` AND
current user is not the owner AND current user is not admin:
Return 404 or redirect to dashboard.

**My Recipes (saved recipes from expelled users):**
The recipe should not appear in savers' My Recipes lists.
Add the same expelled filter to the My Recipes query.

**Comments:**
In comment queries, filter out comments where
`commenter.account_status = 'expelled'`.

**Techniques:**
Same filter as recipes.

**Suspended users:**
Content remains fully visible — suspension only affects plan features.

---

## FEATURE 3 — User-facing restriction banner

### When to show
Show a banner at the top of every page (above the nav) when
the authenticated user's `account_status` is 'suspended' or 'expelled'.

### Suspended banner
```
⚠️  Your account has been restricted to the Free plan by Chefsbook.
    If you have questions, please contact our team.
    [Message Support]
```
Background: amber/yellow
The banner is persistent — cannot be dismissed.

### Expelled banner
```
🚫  Your account has been restricted by Chefsbook.
    Your content is temporarily hidden from the community.
    If you have questions, please contact our team.
    [Message Support]
```
Background: red/pink (lighter red, not alarming)
The banner is persistent — cannot be dismissed.

### "Message Support" button
Opens the existing message compose UI (or a simple modal if compose
doesn't exist for direct messaging).

Pre-fills:
- Recipient: admin account (find the admin user ID — use a@aol.com
  or a dedicated support user)
- Subject/tag: `account_restriction_inquiry`
- Placeholder text: *"Describe your question or concern..."*

On send: creates a message in the messages table tagged with
`account_restriction_inquiry` and routes to the Admin Inbox
(see Feature 4).

---

## FEATURE 4 — Merged Admin Messages Hub

### Replace the three separate admin pages
Currently there are three separate admin pages:
- Admin → Flagged Recipes
- Admin → Flagged Comments  
- Admin → Messages (flagged messages)

**Replace all three** with a single **"Messages & Flags"** page
accessible at `/admin/messages` with four tabs:

### Tab 1: Flagged Recipes
Move existing Flagged Recipes page content here.
Exact same functionality — no changes to the flagged recipes UI.

### Tab 2: Flagged Comments
Move existing Flagged Comments page content here.
Exact same functionality.

### Tab 3: Flagged Messages
Move existing flagged messages content here.
Exact same functionality.

### Tab 4: Admin Inbox (new)
A unified inbox for direct admin communications:

**What appears here:**
- Messages tagged `account_restriction_inquiry` (from suspended/expelled users)
- Messages sent directly from admin to users (from the Users page)
- Replies to any admin-initiated message
- Any message where sender or recipient is an admin user

**Layout:**
- Left panel: conversation list (sender username, subject/tag, date, unread badge)
- Right panel: full conversation thread when a conversation is selected
- Admin can reply from the right panel
- Filter by tag: All | account_restriction_inquiry | Direct messages

**Unread count:**
Show a badge on the "Admin Inbox" tab label when there are unread messages.

### Admin sidebar navigation
Replace the three separate nav items (Flagged Recipes, Flagged Comments, Messages)
with a single **"Messages & Flags"** nav item linking to `/admin/messages`.
The badge on the nav item shows total unread/pending count across all tabs.

---

## FEATURE 5 — Admin Users page: activity indicators

### Database changes
```sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- join_date already exists as created_at on auth.users — no migration needed
```

Apply migration on RPi5, restart supabase-rest.

### Heartbeat API
Create `PATCH /api/user/heartbeat`:
- Auth required
- Updates `last_seen_at = NOW()` for the authenticated user
- No response body needed, just 200 OK
- Use regular (non-admin) Supabase client

### Heartbeat client
In the main app layout (the wrapper that renders for all
authenticated pages), add a heartbeat effect:

```typescript
useEffect(() => {
  // Send immediately on mount
  fetch('/api/user/heartbeat', { method: 'PATCH' });
  
  // Then every 3 minutes while page is open
  const interval = setInterval(() => {
    fetch('/api/user/heartbeat', { method: 'PATCH' });
  }, 3 * 60 * 1000);
  
  return () => clearInterval(interval);
}, []);
```

Fire-and-forget — never await, never show errors to user.

### Login count tracking
In the existing auth/login flow, after successful login,
increment `login_count` in user_profiles:
```sql
UPDATE user_profiles SET login_count = login_count + 1
WHERE id = {userId}
```
Find where the post-login redirect happens and add this increment.

### Admin Users page columns
Add these columns to the users table:

1. **🟢 Online indicator**
   - Green dot (●) next to username if `last_seen_at > NOW() - 5 minutes`
   - Grey dot if offline
   - No dot if `last_seen_at` is NULL (never seen)

2. **Last Active** — `last_seen_at` formatted as `mm/dd/yy hh:mm`
   Show "Never" if NULL

3. **Last Login** — most recent login timestamp formatted as `mm/dd/yy`
   (find where this is stored — check auth.users.last_sign_in_at)

4. **Login Count** — integer from `login_count` column

5. **Recipes** — count of recipes owned by this user
   ```sql
   SELECT COUNT(*) FROM recipes WHERE user_id = {userId}
   ```
   Include in the users list query.

6. **Joined** — `auth.users.created_at` formatted as `mm/dd/yy`

All new columns are sortable (clicking header sorts ascending/descending).

7. **Cost** — fix the existing Cost column which always shows $0.
   Find the actual AI usage log table:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_name LIKE '%usage%' OR table_name LIKE '%cost%' 
   OR table_name LIKE '%ai_log%';
   ```
   Fix the users query to JOIN and SUM actual costs per user
   from the correct table. Format as $X.XX — show $0.00 if no usage.

---

## IMPLEMENTATION ORDER
1. Apply user_profiles migrations (account_status, pre_suspension_plan,
   last_seen_at, login_count etc.)
2. Feature 2 — Content visibility filters (expelled users) in queries
3. Feature 1 — Suspend/Expel API routes
4. Feature 1 — Admin Users page suspend/expel buttons + dialogs
5. Feature 5 — Heartbeat API + client heartbeat effect
6. Feature 5 — Login count tracking in auth flow
7. Feature 5 — Admin Users page new columns
8. Feature 3 — User-facing restriction banner
9. Feature 3 — "Message Support" pre-filled message flow
10. Feature 4 — Merged Messages & Flags hub
11. Feature 4 — Admin Inbox tab
12. Update admin sidebar nav
13. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
14. Deploy per `deployment.md`

---

## GUARDRAILS
- Suspend and expel are mutually exclusive — enforced server-side
- Expelled content filters must be server-side — never trust client
- The restriction banner cannot be dismissed by the user
- Pre-suspension plan must be stored before overwriting with 'free'
- Admin can see expelled users' content (admin bypass in all queries)
- Reinstating a user restores their content visibility immediately
- The merged Messages & Flags page must preserve ALL existing
  functionality from the three pages it replaces
- Do NOT delete the old admin page files until the new page is
  verified working — redirect old URLs to new page

---

## REGRESSION CHECKS — MANDATORY
1. Suspending a user forces Free plan ✓
2. Unsuspending restores original plan ✓
3. Expelled user's recipes hidden from other users including savers ✓
4. Expelled user can still see their own content ✓
5. Reinstating expelled user restores all content visibility ✓
6. Suspended/expelled user sees banner on every page ✓
7. "Message Support" creates message tagged account_restriction_inquiry ✓
8. Admin Messages & Flags page loads with all 4 tabs ✓
9. Flagged Recipes tab works as before ✓
10. Flagged Comments tab works as before ✓
11. Admin Inbox shows account restriction messages ✓
12. Green dot shows for active users (last seen < 5 min) ✓
13. Last Active, Login Count, Recipes, Joined columns show correctly ✓
14. Login count increments on each login ✓
15. My Recipes images still show ✓
16. Recipe detail page still works ✓

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Migrations applied confirmed
- Which expelled content filters were added and where
- Admin Inbox message routing confirmed
- Old admin page redirect URLs
- All 13 regression checks confirmed
- tsc clean + deploy confirmed
