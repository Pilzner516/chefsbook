# Prompt: Admin Feedback Management — Status, Internal Notes, Threaded Messaging

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/admin-feedback-management.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE

## Context

The admin feedback page (`/admin/feedback`) currently shows a flat read-only list of
user feedback items. See current state in the screenshot — two bug reports from @pilzner,
no actions available.

This session adds three capabilities to the admin feedback workflow:

1. **Status management** — admin can mark feedback as Under Review or delete it
2. **Internal admin notes** — admin can add private tracking notes to any feedback item
3. **Threaded messaging** — admin can send messages to the feedback submitter and
   maintain a thread, visible to both parties (like recipe comments)

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/deployment.md`

Run ALL pre-flight checklists from every agent above before writing any code.

---

## Pre-flight: verify current schema

Before writing any migrations, run these inside the `supabase-db` container:

```sql
\d user_feedback
\d recipe_comments
```

The `recipe_comments` table is the reference pattern for threading. Understand its
structure before designing the feedback thread table. Also check:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'user_feedback' ORDER BY ordinal_position;
```

Confirm the next available migration number (last known: 055).

---

## Database changes

### Migration 056 — Add status to user_feedback

```sql
ALTER TABLE user_feedback
  ADD COLUMN status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'under_review', 'resolved'));
```

- Default `new` for all existing and future rows
- `resolved` is available for future use but not exposed in the UI yet
- Do NOT add `deleted` as a status — deleted rows are hard-deleted (see Feature 1)

### Migration 057 — Admin notes on feedback

```sql
CREATE TABLE feedback_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES user_feedback(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_notes_feedback_id ON feedback_notes(feedback_id);

-- RLS: only admins can read/write notes
ALTER TABLE feedback_notes ENABLE ROW LEVEL SECURITY;
-- Admin check: user has is_admin = true in user_profiles
CREATE POLICY "Admins only" ON feedback_notes
  USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));
```

### Migration 058 — Feedback message threads

```sql
CREATE TABLE feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES user_feedback(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  is_admin_message BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_messages_feedback_id ON feedback_messages(feedback_id);
CREATE INDEX idx_feedback_messages_created_at ON feedback_messages(created_at DESC);

ALTER TABLE feedback_messages ENABLE ROW LEVEL SECURITY;

-- Admin can read/write all messages on any feedback
CREATE POLICY "Admin full access" ON feedback_messages
  USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));

-- User can read/write messages only on their own feedback
CREATE POLICY "User own feedback" ON feedback_messages
  USING (
    EXISTS (
      SELECT 1 FROM user_feedback
      WHERE id = feedback_messages.feedback_id
      AND user_id = auth.uid()
    )
  );
```

After applying all migrations, run `docker restart supabase-rest` to refresh the
PostgREST schema cache.

---

## Feature 1 — Status management

### Admin feedback page changes

Each feedback card gets a status badge and action buttons in the top-right corner:

**Status badge** (left of actions):
- `new` → no badge (default, clean)
- `under_review` → amber pill "Under Review"

**Action buttons:**
- **"Mark Under Review"** button — visible when status is `new`
  - Calls PATCH `/api/admin/feedback/[id]/status` with `{ status: 'under_review' }`
  - Updates badge immediately (optimistic UI)
- **"Delete"** button — always visible, styled as a destructive action (red)
  - Shows a confirmation dialog: "Delete this feedback? This cannot be undone."
  - Use `ChefsDialog` / `useConfirmDialog` — NOT a raw `alert()`
  - On confirm: calls DELETE `/api/admin/feedback/[id]`
  - Removes the card from the list immediately

**API routes to create:**
- `PATCH /api/admin/feedback/[id]/status` — updates `user_feedback.status`
- `DELETE /api/admin/feedback/[id]` — hard deletes the row

Both routes must verify the caller is an admin before executing.

**Filter bar update:**
Add a status filter alongside the existing type filters:
`All | Bugs | Suggestions | Praise` → add `| Under Review` filter tab

---

## Feature 2 — Internal admin notes

Each feedback card gets a collapsible **Admin Notes** section below the feedback content.

**Collapsed state:** Shows "Admin Notes (N)" link — N = count of existing notes. If zero,
shows "Add note".

**Expanded state:**
- List of existing notes: admin avatar, note text, relative timestamp
- Text input at the bottom: multiline, placeholder "Add a tracking note..."
- "Save Note" button
- Notes are displayed oldest-first
- Notes are ONLY visible to admins — never shown to the feedback submitter

**API routes to create:**
- `GET /api/admin/feedback/[id]/notes` — list notes for a feedback item
- `POST /api/admin/feedback/[id]/notes` — create a note

---

## Feature 3 — Threaded messaging with the sender

Each feedback card gets a **"Message Sender"** button (or "View Thread (N)" if messages exist).

**Thread UI** — opens as an inline expandable panel below the feedback card (same
pattern as admin notes, but visually distinct — use a different background color to
differentiate from notes):

- Messages displayed in chronological order, oldest first
- Admin messages: right-aligned, pomodoro red bubble `#ce2b37` with white text
- User messages: left-aligned, cream `#faf7f0` bubble with border
- Each message shows sender name and relative timestamp
- Text input at the bottom: "Reply to @username..."
- "Send" button

**When admin sends a message:**
- Saves to `feedback_messages` with `is_admin_message = TRUE`
- Triggers a notification to the user (use the existing notification system if available,
  otherwise note as a follow-up in AGENDA.md)

**User-facing thread (mobile):**
Users need a way to see admin replies. Check if the existing messages system
(`apps/mobile/app/messages.tsx`) can surface these, OR add a "Feedback Replies" section
to the user's profile/settings screen. If this is complex, implement the admin side fully
and log the mobile user-facing view as a follow-up in AGENDA.md — do NOT block the
admin feature on it.

**API routes to create:**
- `GET /api/admin/feedback/[id]/messages` — list thread messages
- `POST /api/admin/feedback/[id]/messages` — send a message (admin or user)

---

## UI layout — updated feedback card

```
┌─────────────────────────────────────────────────────────┐
│ [Avatar] @username  🐛 bug  [Screen tag]   [Under Review]│
│                                          [Mark Review] [Delete] │
│                                                         │
│  Feedback description text here...                      │
│  13m ago · Android · v1.0.0                             │
│                                                         │
│  ▼ Admin Notes (2)                                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [admin] "Reproduced on S24 — confirmed bug"     │   │
│  │ [admin] "Assigned to mobile-layout session"     │   │
│  │ [Add note input...]                [Save Note]  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ▼ Thread with @username (1 message)                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │          "Thanks, looking into this now" [Admin]│   │
│  │ [Reply input...]                        [Send]  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Testing

### Web (required before wrapup)

1. Navigate to `/admin/feedback`
2. Confirm feedback cards render with action buttons visible
3. Click "Mark Under Review" on a feedback item → amber badge appears
4. Click "Delete" → confirmation dialog appears → confirm → card removed
5. Expand Admin Notes → add a note → note appears in list
6. Expand Thread → send a message → message appears in bubble
7. Confirm filter tab "Under Review" shows only under-review items
8. No console errors throughout

### psql verification

```sql
-- Confirm migrations applied
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_feedback';
-- Should include: status

SELECT table_name FROM information_schema.tables
WHERE table_name IN ('feedback_notes', 'feedback_messages');
-- Should return both rows
```

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5 via `/mnt/chefsbook/deploy-staging.sh`.
Run regression smoke test from `testing.md` before wrapup.

---

## Wrapup

Follow `wrapup.md` fully.
Proof required for every checklist item — screenshots, psql results, or curl responses.
Log any deferred items (e.g. mobile user-facing thread view) in AGENDA.md.
