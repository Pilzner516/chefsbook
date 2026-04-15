# ChefsBook — Session 116: Admin Fixes — Import Tracking + Moderation + Flagged Content
# Items 11, 15, 16, 17, 18
# Target: apps/web admin + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

Five admin improvements. All admin queries must go through /api/admin
route using adminFetch/adminPost helpers (session 109 pattern).

---

## ITEM 11 — Import Site Tracking Admin Page

When importing from a URL, some sites consistently fail to import
ingredients correctly (e.g. seriouseats.com). We need an admin page
to track which sites work and which have issues.

### Database (migration 034)

```sql
CREATE TABLE import_site_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  last_import_at TIMESTAMPTZ,
  total_attempts INT DEFAULT 0,
  successful_attempts INT DEFAULT 0,
  known_issue TEXT,          -- admin note about what fails (e.g. "ingredients missing")
  status TEXT DEFAULT 'unknown' CHECK (status IN ('working', 'partial', 'broken', 'unknown')),
  last_checked_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE import_site_tracker ENABLE ROW LEVEL SECURITY;
-- Service role only for write; admin only for read
```

### Auto-tracking on import

In the URL import API route (apps/web/app/api/import/url/route.ts):
After each import attempt, upsert to import_site_tracker:
- Extract domain from the URL
- Increment total_attempts
- If import succeeded (has title + ingredients): increment successful_attempts,
  set last_import_at, update status based on success rate
- Status logic: >80% success = 'working', 20-80% = 'partial', <20% = 'broken'

Seed known issues for seriouseats.com:
```sql
INSERT INTO import_site_tracker (domain, known_issue, status)
VALUES ('seriouseats.com', 'Ingredients frequently missing — site uses
  non-standard JSON-LD schema', 'partial');
```

### Admin page: /admin/import-sites

Add "Import Sites" to admin sidebar nav.

Page layout:
- Header: "Import Site Tracker"
- Filter pills: All | Working | Partial | Broken | Unknown
- Table columns:
  - Domain
  - Status pill (green Working / yellow Partial / red Broken / grey Unknown)
  - Success Rate (successful/total as percentage + fraction)
  - Last Import
  - Known Issue (truncated, expand on hover)
  - Actions

Actions per row:
- "Edit" — opens modal to update status + known issue note manually
- Admin can override the auto-calculated status
- "Mark as Reviewed" — sets last_checked_by to current admin

---

## ITEM 15 — Recipe Moderation Status: explanation + behaviour

### What the status column means (document in admin UI)

Add an info tooltip (ℹ) next to the "Moderation Status" column header
that explains:

- **clean** — AI reviewed, no issues found. Recipe is fully visible.
- **mild** — AI flagged minor concern. Recipe is visible but flagged for
  admin review. Admin can approve (keep visible) or reject (make private).
- **serious** — AI flagged serious violation. Recipe automatically set to
  private + user account frozen. Admin must review urgently.

### Status changes

- clean → no admin action needed
- mild → admin can: Approve (mark clean, keep visible) or Reject (set private)
- serious → admin can: Approve (unfreeze user, restore recipe) or Reject
  (keep private, keep frozen)

Ensure the Approve/Reject buttons on the admin recipes page:
- Show a confirmation ChefsDialog before acting
- On Approve: set moderation_status = 'clean', restore visibility if private,
  unfreeze user if frozen (for serious cases)
- On Reject: set moderation_status = 'rejected', set visibility = 'private'
- Both actions send a notification to the recipe owner

---

## ITEM 16 — Admin Recipe Moderation: search by user

On the /admin/recipes page, add a search input that filters recipes by:
- Recipe title (existing)
- Username / original_submitter_username (new)

The search input should have a toggle or a dropdown to select:
"Search by: [Title ▼]" that can be changed to "Username"

When searching by username: filter to all recipes where
original_submitter_username ILIKE '%{query}%'

This is client-side filtering (data already loaded).

---

## ITEM 17 — Flagged messages and comments not showing in admin

When a message or comment is flagged by a user, nothing appears in the
admin section. The admin must see all flagged content clearly.

### Diagnose
1. Check comment_flags table on RPi5:
```sql
SELECT cf.*, rc.content as comment_content
FROM comment_flags cf
JOIN recipe_comments rc ON rc.id = cf.comment_id
LIMIT 10;
```

2. Check message_flags table:
```sql
SELECT mf.*, dm.content as message_content
FROM message_flags mf
JOIN direct_messages dm ON dm.id = mf.message_id
LIMIT 10;
```

3. Check the admin Flagged Comments page — does it query comment_flags?
4. Check the admin Messages page — does it show flagged messages?

### Fix — Admin Flagged Comments page

Ensure /admin/flagged shows:
- All comments in comment_flags (joined with recipe_comments for content)
- Columns: Comment text | Recipe | Commenter | Flag reason | Flagged by | Date
- Actions: Approve (remove flag, keep comment) | Remove (delete comment)
- Filter pills: All | Pending | Resolved

### Fix — Admin Messages page

Ensure /admin/messages shows:
- Flagged messages (where message_flags count > 0 OR is_hidden = true)
- Columns: Message content | Sender | Recipient | Flag reason | Date
- Actions: Approve (un-hide) | Remove (keep hidden)

If the pages query the wrong tables or have broken joins, fix them.
Use adminFetch() through /api/admin route — no direct supabaseAdmin
in client components.

---

## ITEM 18 — Reserved Username admin page: clarify and complete

The Actions column on /admin/reserved-usernames needs clarification
and two missing pieces:

### Current state (from session 110)
- Add: works
- Remove: works
- Approve + note: works (basic)
- Missing: assign to existing user dropdown
- Missing: view AI-flagged new usernames

### Fix A — Approve modal: assign to existing user

In the Approve modal, add a user search dropdown:
- Text input that searches user_profiles by username
- Shows matching users as dropdown options (avatar + @username)
- Selecting a user sets approved_for_user_id = that user's id
- The Approved For column in the table then shows that user with a
  profile link

### Fix B — AI-flagged usernames section

At the top of the /admin/reserved-usernames page, add a section:
"Recently Flagged Usernames" that shows user_flags records where
flag_type = 'username_impersonation' and is_resolved = false.

Columns: Username | User | Flag date | AI note | Actions
Actions: 
- "Add to Reserved List" — adds the username to reserved_usernames
- "Dismiss" — marks the user_flag as resolved (false positive)
- "Message User" — opens direct message compose to that user

This gives admins a clear workflow: AI flags → admin sees it here →
decides to reserve the name or dismiss.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth

# Apply migration 034
psql -U postgres -d postgres \
  -f /mnt/chefsbook/repo/supabase/migrations/034_import_tracker.sql
docker restart supabase-rest

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

### Import Site Tracker
- [ ] Migration 034: import_site_tracker table + seriouseats.com seeded
- [ ] URL import route upserts to import_site_tracker on every attempt
- [ ] /admin/import-sites page with filter pills + table + edit modal
- [ ] Status auto-calculated from success rate

### Recipe Moderation Status
- [ ] Info tooltip on Moderation Status column header explains all 3 states
- [ ] Approve/Reject show ChefsDialog confirmation before acting
- [ ] Approve: restores visibility, unfreezes user (serious cases), notifies owner
- [ ] Reject: sets private, notifies owner

### Recipe Search by User
- [ ] Search toggle: Title vs Username
- [ ] Username search filters by original_submitter_username

### Flagged Content
- [ ] Flagged Comments page correctly shows comment_flags data
- [ ] Approve/Remove actions work on flagged comments
- [ ] Admin Messages page shows flagged/hidden messages
- [ ] Approve/Remove actions work on flagged messages

### Reserved Usernames
- [ ] Approve modal has user search dropdown → sets approved_for_user_id
- [ ] Approved For column shows linked username
- [ ] AI-flagged usernames section at top of page
- [ ] Add to Reserved / Dismiss / Message User actions work

### General
- [ ] PostgREST restarted after migration
- [ ] All admin queries through /api/admin route (no client-side supabaseAdmin)
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
