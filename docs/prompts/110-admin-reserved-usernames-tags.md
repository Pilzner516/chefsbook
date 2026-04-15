# ChefsBook — Session 110: Admin — Reserved Usernames + Recipe Sorting + Account Status Tags + User Flags + Bulk Messaging
# Source: Admin feature requests
# Target: apps/web admin + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

Five distinct admin features. Build all completely.
All DB queries in admin pages must use supabaseAdmin (service role).
Session 109 must be complete before running this session.

---

## FEATURE 1 — Reserved Usernames

### Database

Create migration 032: reserved_usernames table

```sql
CREATE TABLE reserved_usernames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  reason TEXT,
  is_approved BOOLEAN DEFAULT false,
  approved_for_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  approved_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE reserved_usernames ENABLE ROW LEVEL SECURITY;
```

Seed the initial reserved list:

```sql
INSERT INTO reserved_usernames (username, reason) VALUES
('admin', 'admin role'),
('administrator', 'admin role'),
('chefsbook', 'brand'),
('chefs_book', 'brand'),
('chefsbook_official', 'brand'),
('official', 'brand'),
('support', 'admin role'),
('moderator', 'admin role'),
('mod', 'admin role'),
('proctor', 'admin role'),
('staff', 'admin role'),
('system', 'admin role'),
('root', 'admin role'),
('superadmin', 'admin role'),
('super_admin', 'admin role'),
('help', 'admin role'),
('pilzner', 'founder account'),
('seblux', 'founder account'),
('chefsbook_support', 'brand'),
('chefsbook_team', 'brand'),
('chef', 'brand'),
('owner', 'admin role');
```

### Signup validation

In the username availability check (web + mobile signup):
- After checking not already taken, also check reserved_usernames
- If found AND is_approved = false: return "This username is reserved"
- If found AND is_approved = true AND approved_for_user_id = current user: allow
- Existing accounts with reserved usernames are grandfathered — not affected

### AI flag on impersonation-style usernames

When a new username is submitted that is NOT on the reserved list,
run a HAIKU check (non-blocking, do not delay signup):

Prompt: "Does this username '{username}' impersonate an admin, staff,
moderator, official brand account, or authority figure? Reply YES or NO only."

If YES:
- Allow the signup (do not block)
- Create a user_flags record (Feature 4) of type 'username_impersonation'
  with note: "AI flagged username as potentially impersonating authority"
- Admin sees the flag icon on the user in the Users table

### Admin page: Reserved Usernames

Add "Reserved Usernames" to the admin sidebar nav (after User Ideas).

Page at /admin/reserved-usernames:
- Header: "Reserved Usernames" + "Add Username" red button
- Filter pills: All | Reserved | Approved
- Table columns: Username | Reason | Status | Approved For | Actions

Status pills:
- Red "Reserved" when is_approved = false
- Green "Approved" when is_approved = true

Actions per row:
- "Approve" button (Reserved rows): modal with two options:
  - Assign to existing user — username search dropdown
  - Create new account — popup with email, name, auto-generated password
    shown to admin; on submit creates auth.users + user_profiles with
    this reserved username; sets is_approved = true + approved_for_user_id
  - Approval note field + Confirm button
- "Revoke Approval" (Approved rows): sets is_approved = false,
  clears approved_for_user_id
- "Remove": deletes with ChefsDialog confirmation

Add Username modal:
- Username input + reason input + Add button
- Validates: no spaces, alphanumeric + underscore only
- Checks not already in list
- Inserts with is_approved = false

---

## FEATURE 2 — Admin Recipes Page: Sorting + Submitter Pill

### Sortable columns (client-side)

On /admin/recipes make these columns sortable by clicking the header:
- Title (A→Z / Z→A)
- Submitter
- Visibility
- Moderation Status
- Date Added (default: newest first)

Add ↑ ↓ sort indicator on the active sort column.

### Submitter column

Add a Submitter column showing original_submitter_username as a red
attribution pill. Clicking navigates to /u/[username].
If null: show "Unknown" in muted grey text.

Column order: Title | Submitter | Visibility | Moderation Status | Date Added | Actions

---

## FEATURE 3 — Account Status Tags (admin-only)

### Database (add to migration 032)

```sql
CREATE TABLE user_account_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  added_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tag)
);
ALTER TABLE user_account_tags ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for authenticated users — service role only
```

Default tag suggestions (shown in picker UI, not stored in DB):
VIP, Beta Tester, Partner, Influencer, Press,
Flagged, Under Review, Canceled, Churned,
Paid, Comped, Trial Extended, Banned

### Admin Users page — Account Status column

- Shows all tags for each user as small color-coded pills
- Green pills: VIP, Beta Tester, Partner, Influencer, Press, Paid, Comped, Trial Extended
- Red pills: Flagged, Under Review, Canceled, Churned, Banned
- "+" icon opens tag popover: default list (toggle on/off) + free-text
  custom input; changes save immediately via supabaseAdmin
- Tags are never visible to non-admin users

### Tag filter pills above Users table

- "All Users" (default) + one pill per unique tag in DB (dynamic query)
- Clicking a tag pill filters the table to users with that tag
- Multiple tag pills active simultaneously = AND filter
- Active pills highlighted in pomodoro red

---

## FEATURE 4 — User Flags System

### Database (add to migration 032)

```sql
CREATE TABLE user_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN (
    'username_impersonation', 'reported_by_user',
    'reported_by_proctor', 'ai_flagged', 'admin_flagged', 'other'
  )),
  note TEXT,
  flagged_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_flags ENABLE ROW LEVEL SECURITY;
-- Service role only
```

### Flag icon in Users table

Show a red ⚑ flag icon next to the username when the user has any
unresolved flags (is_resolved = false).

Clicking the flag icon opens a popover showing:
- List of unresolved flags (type + note + date)
- "Mark Resolved" button per flag (with resolution note text input)
- "Add Flag" button to manually flag the user (type dropdown + note)

### Flag filter pill above Users table

Add a "⚑ Flagged" filter pill alongside the tag filter pills.
Clicking filters to users with at least one unresolved flag.

### Connection to Feature 1

When AI flags a username at signup (Feature 1), it creates a
user_flags record of type 'ai_flagged'. The flag icon appears on
that user's row in the admin Users table immediately.

---

## FEATURE 5 — Email Column + Direct Message Button + Bulk Messaging

### Email column

Add an Email column to the admin Users table.
Read email from auth.users via supabaseAdmin (service role required).

Column order (left to right):
Checkbox | User (avatar + username) | Email | Plan | Role | Account Status | ⚑ | Joined | Actions

### Direct message button per user

In the Actions column, add a "Message" pill button per user.
Clicking opens a ChefsDialog compose modal:
- To: @username (read-only, pre-filled)
- Message textarea (max 1000 chars with char counter)
- Send and Cancel buttons
- Uses sendMessage() from packages/db
- Success toast on send; error shown inline if fails
- Admin cannot message themselves

### Bulk messaging

Checkbox column (first column) enables multi-select:
- Checkbox per row; "Select All" checkbox in header
- When 1+ users selected: "Message Selected (N)" red button appears
  above the table, inline with the filter pills
- Clicking opens bulk compose modal:
  - To: scrollable list of selected @usernames
  - Message textarea (max 1000 chars, char counter)
  - Send button: loops sendMessage() for each selected recipient
  - Progress indicator: "Sending 3/5..."
  - Success: "Message sent to N users"
  - On completion: deselect all users
- Existing filters and tag pills remain active during selection

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth

# Apply migration 032
psql -U postgres -d postgres \
  -f /mnt/chefsbook/repo/supabase/migrations/032_admin_features.sql
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

### Feature 1 — Reserved Usernames
- [ ] Migration 032: reserved_usernames table + 22-entry seed list applied
- [ ] Signup blocks reserved usernames with correct message
- [ ] Existing accounts grandfathered (not affected)
- [ ] AI flags impersonation-style usernames non-blocking → creates user_flag
- [ ] /admin/reserved-usernames page: All/Reserved/Approved filter pills
- [ ] Add, Approve (existing + new account), Revoke, Remove all work

### Feature 2 — Admin Recipes
- [ ] Sortable columns with ↑ ↓ indicators, default newest first
- [ ] Submitter column with red attribution pill linking to /u/[username]

### Feature 3 — Account Status Tags
- [ ] user_account_tags table created, service role only
- [ ] Account Status column with color-coded pills + "+" popover
- [ ] Tag filter pills above Users table (dynamic, AND logic)
- [ ] Tags invisible to non-admins

### Feature 4 — User Flags
- [ ] user_flags table created, service role only
- [ ] Red ⚑ flag icon on users with unresolved flags
- [ ] Flag popover: list + Mark Resolved + Add Flag
- [ ] "⚑ Flagged" filter pill above Users table
- [ ] AI username check creates user_flag on impersonation detection

### Feature 5 — Email + DM + Bulk
- [ ] Email column in Users table (reads auth.users via supabaseAdmin)
- [ ] "Message" pill button in Actions → compose modal → sends via sendMessage()
- [ ] Checkbox column for multi-select
- [ ] "Message Selected (N)" button appears on selection
- [ ] Bulk compose modal with progress indicator
- [ ] Messages land in recipient's /dashboard/messages inbox

### General
- [ ] PostgREST restarted after migration
- [ ] feature-registry.md updated with all 5 features
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from this
      prompt, what was left incomplete, and why.
