# ChefsBook — Session 97: Direct Messaging System
# Source: Feature request — user-to-user direct messaging
# Target: apps/web + apps/mobile + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence.

This is a large new feature. Build it completely and correctly the first time.
Read data-flow.md, ui-guardian.md, testing.md, deployment.md, ai-cost.md.

---

## OVERVIEW

Users can send direct messages to each other. Messages show in a dedicated
Messages section in the notification panel (or a separate Messages tab).
Messages are AI-moderated and users can flag inappropriate messages.
Flagged messages go to proctors and admins for review.

---

## STEP 1 — Database

Create migration 028: direct_messages table

```sql
CREATE TABLE direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  is_read BOOLEAN DEFAULT false,
  moderation_status TEXT DEFAULT 'clean' CHECK (moderation_status IN ('clean','mild','serious')),
  flag_reason TEXT,
  flagged_at TIMESTAMPTZ,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON direct_messages(recipient_id, created_at DESC);
CREATE INDEX ON direct_messages(sender_id, created_at DESC);

-- Message flags table
CREATE TABLE message_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('Inappropriate','Harassment','Spam','Other')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, flagged_by)
);

-- Unread count: add unread_messages_count to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS unread_messages_count INT DEFAULT 0;

-- Trigger: increment unread count on new message
CREATE OR REPLACE FUNCTION increment_unread_messages()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles SET unread_messages_count = unread_messages_count + 1
  WHERE id = NEW.recipient_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_message
  AFTER INSERT ON direct_messages
  FOR EACH ROW EXECUTE FUNCTION increment_unread_messages();
```

RLS policies:
- SELECT: sender or recipient can read their own messages
- INSERT: authenticated users can send (sender_id must = auth.uid())
- UPDATE: only sender can edit (not needed for MVP — skip)
- DELETE: sender or admin can delete

---

## STEP 2 — DB queries in packages/db

Add to packages/db/src/messages.ts:

```typescript
sendMessage(senderId, recipientId, content)  // inserts + triggers moderation
getConversation(userId1, userId2, limit, offset)  // messages between two users
getConversationList(userId)  // list of unique conversations with last message + unread count
markMessagesRead(senderId, recipientId)  // marks messages as read, resets unread count
flagMessage(messageId, flaggedBy, reason)
deleteMessage(messageId, userId)  // sender or admin only
getUnreadMessageCount(userId)
```

---

## STEP 3 — AI moderation in packages/ai

Add moderateMessage() using HAIKU model (same pattern as moderateComment):
- Input: message content
- Output: clean | mild | serious
- On mild: message delivered but flagged for review
- On serious: message hidden (is_hidden = true), sender notified,
  message escalated to admin
- Non-blocking: if AI call fails, deliver message as clean

Add moderateMessage to ai-cost agent reference table.

---

## STEP 4 — Web: Messages UI

### 4a — Message button on user profiles

On /u/[username] and /chef/[username]:
- Add a "Message" button near the top of the profile, next to Follow button
- Button opens a compose modal (ChefsDialog style) with:
  - Recipient username shown at top (read-only)
  - Text area (max 1000 chars, char counter)
  - Send button
- On send: calls sendMessage(), shows "Message sent" toast
- Users cannot message themselves — hide button on own profile

### 4b — Messages panel/tab

Add a "Messages" tab to the notification bell panel (making it 6 tabs:
the existing 5 + Messages), OR create a dedicated /dashboard/messages page.
Recommended: dedicated page at /dashboard/messages for better UX.

Sidebar nav: add Messages link with unread count badge (same style as bell).

Messages page layout:
- Left column: conversation list (avatar + username + last message preview + timestamp + unread badge)
- Right column: selected conversation thread (messages in chronological order, newest at bottom)
- Compose area at bottom: text input + Send button
- Mobile: full-screen conversation list → tap to open thread

Each message bubble:
- Own messages: right-aligned, red/cream background
- Their messages: left-aligned, white background
- Timestamp on hover/tap
- Flag button (⚑) on hover/tap — opens flag reason picker

### 4c — Unread count in sidebar

Show unread message count badge on the Messages nav item.
Update in real-time via Supabase Realtime subscription.

---

## STEP 5 — Mobile: Messages UI

### 5a — Message button on chef profile screen

Same as web — "Message" button near Follow button on chef profile.
Tapping opens a bottom sheet compose view.

### 5b — Messages tab or screen

Add Messages to mobile navigation. Options:
- New tab in the tab bar (if space allows)
- Or: accessible from the notification bell panel as a Messages section

Recommended: add a Messages screen accessible from the profile/settings area
or as a 6th tab. Use the same conversation list → thread pattern as web.

---

## STEP 6 — Admin: Message moderation

On /admin, add a "Messages" section showing:
- All flagged messages (is_hidden = true or flag_count >= 1)
- Sender, recipient, content, flag reason
- Actions: Approve (un-hide), Remove (keep hidden), Warn sender, Suspend sender

---

## STEP 7 — Notifications

When a user receives a new message, create a notification of type
'direct_message' in the notifications table (or show an in-app badge).
The unread_messages_count on user_profiles drives the badge number.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
# Apply migration first
psql -U postgres -d postgres -f /mnt/chefsbook/repo/supabase/migrations/028_direct_messages.sql
docker restart supabase-rest

cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] Migration 028 applied on RPi5 (direct_messages, message_flags, unread trigger)
- [ ] PostgREST restarted after migration
- [ ] packages/db: sendMessage, getConversation, getConversationList, markRead, flagMessage, getUnreadCount
- [ ] packages/ai: moderateMessage() on HAIKU, added to ai-cost reference
- [ ] Web: Message button on user profiles (not own profile)
- [ ] Web: /dashboard/messages page with conversation list + thread view
- [ ] Web: Messages link in sidebar with unread count badge
- [ ] Web: Flag message flow with reason picker
- [ ] Mobile: Message button on chef profile
- [ ] Mobile: Messages screen accessible from navigation
- [ ] Admin: Flagged messages section
- [ ] Unread count updates in real-time
- [ ] feature-registry.md updated with direct messaging rows
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
