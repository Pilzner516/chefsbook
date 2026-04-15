# ChefsBook — Session 77: Threaded Comments + Notifications System
# Source: Feature request 2026-04-11
# Target: apps/mobile + apps/web + packages/db + @chefsbook/ai

---

## CROSS-PLATFORM REQUIREMENT
Build on BOTH platforms. Read .claude/agents/ui-guardian.md,
.claude/agents/data-flow.md, and .claude/agents/deployment.md before starting.
Run ALL pre-flight checklists.

---

## PART 1 — THREADED COMMENTS

### DB — already has parent_id
The `recipe_comments` table already has `parent_id UUID REFERENCES recipe_comments(id)`.
No migration needed for the basic structure.

Add one column for reply count:
```sql
ALTER TABLE recipe_comments
  ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0;

-- Trigger to maintain reply_count:
CREATE OR REPLACE FUNCTION update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
    UPDATE recipe_comments SET reply_count = reply_count + 1
      WHERE id = NEW.parent_id;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
    UPDATE recipe_comments SET reply_count = reply_count - 1
      WHERE id = OLD.parent_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reply_count_trigger
  AFTER INSERT OR DELETE ON recipe_comments
  FOR EACH ROW EXECUTE FUNCTION update_reply_count();
```

Apply to RPi5.

### Display rules
- Show top-level comments (parent_id IS NULL) in chronological order
- Under each top-level comment, show first 3 replies (parent_id = comment.id)
- If reply_count > 3: show "▶ N more replies" expander
- Tapping expander opens a thread view showing all replies
- Replies to replies are stored in DB with correct parent_id chain
- BUT displayed only 1 level deep — deeper replies show flat under the
  immediate parent in the thread view

### Thread view
When user taps "▶ N more replies":
- Open a bottom sheet (mobile) or slide-in panel (web)
- Title: "Thread — [comment preview]"
- Shows the original comment at top
- All replies below in chronological order
- Reply input at the bottom
- Back closes and returns to main comment list

### Reply UX
Tapping "Reply" on any comment:
1. Shows an inline input DIRECTLY BELOW that comment
2. Pre-filled with `@username ` (the person being replied to)
3. Keyboard opens automatically (mobile) / input focused (web)
4. Send button inline
5. Tapping Cancel or outside dismisses the input
6. On submit: creates comment with parent_id = that comment's id

```tsx
// Inline reply input:
{replyingTo === comment.id && (
  <div className="reply-input-row">
    <span className="reply-indicator">↩ Replying to @{comment.username}</span>
    <textarea
      autoFocus
      value={replyText}
      onChange={e => setReplyText(e.target.value)}
      placeholder={`Reply to @${comment.username}...`}
      maxLength={500}
    />
    <button onClick={cancelReply}>Cancel</button>
    <button onClick={submitReply} disabled={replyText.length < 2}>Send</button>
  </div>
)}
```

### Collapse long threads
Top-level comments with reply_count > 3:
```
@chef_marie · 2h ago
This recipe is amazing!
[👍 Reply] [🚩 Flag]

  └─ @pilzner · 1h ago
     Thank you so much!

  └─ @user2 · 50m ago
     Agreed, made it last night!

  └─ @user3 · 30m ago
     The tips were super helpful

  ▶ 4 more replies   ← tap to open thread view
```

---

## PART 2 — NOTIFICATIONS SYSTEM

### DB Migration `027_notifications_full.sql`

The `notifications` table was created as a stub in session 29. Expand it:

```sql
-- Add missing columns to notifications table:
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS actor_username TEXT,
  ADD COLUMN IF NOT EXISTS actor_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recipe_title TEXT,
  ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES recipe_comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS batch_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Notification types:
-- 'comment_reply'   — someone replied to your comment
-- 'recipe_comment'  — someone commented on your recipe
-- 'new_follower'    — someone followed you
-- 'recipe_like'     — likes batched (batch_count shows how many)
-- 'moderation'      — recipe approved/rejected

-- RLS:
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());
```

### Notification triggers

**On new reply:**
```ts
// In postComment(), after saving the comment:
if (comment.parent_id) {
  const parentComment = await getComment(comment.parent_id);
  if (parentComment.user_id !== currentUser.id) {
    await createNotification({
      user_id: parentComment.user_id,
      type: 'comment_reply',
      actor_id: currentUser.id,
      actor_username: currentUser.username,
      recipe_id: comment.recipe_id,
      recipe_title: recipe.title,
      comment_id: comment.id,
      message: `replied to your comment on "${recipe.title}"`
    });
  }
}
```

**On new comment on your recipe:**
```ts
if (recipe.user_id !== currentUser.id) {
  await createNotification({
    user_id: recipe.user_id,
    type: 'recipe_comment',
    actor_username: currentUser.username,
    recipe_id: recipe.id,
    recipe_title: recipe.title,
    comment_id: savedComment.id,
    message: `commented on your recipe "${recipe.title}"`
  });
}
```

**On new like (batched):**
```ts
// When a recipe is liked, upsert a batched notification:
const existing = await supabase
  .from('notifications')
  .select('id, batch_count')
  .eq('user_id', recipe.user_id)
  .eq('type', 'recipe_like')
  .eq('recipe_id', recipe.id)
  .eq('is_read', false)
  .single();

if (existing.data) {
  await supabase.from('notifications')
    .update({ batch_count: existing.data.batch_count + 1 })
    .eq('id', existing.data.id);
} else {
  await createNotification({
    user_id: recipe.user_id,
    type: 'recipe_like',
    recipe_id: recipe.id,
    recipe_title: recipe.title,
    batch_count: 1,
    message: `liked your recipe "${recipe.title}"`
  });
}
```

**On new follower:** Already triggered in session 29 follow system.
Update that trigger to use the expanded notifications schema.

### Notification bell — global header

**Web:** Add to the main dashboard header (top-right area):
```tsx
<NotificationBell unreadCount={unreadCount} onClick={openNotifications} />
```

**Mobile:** Add to the tab bar area or recipe list header.

Bell styling:
```tsx
function NotificationBell({ unreadCount, onClick }) {
  return (
    <button onClick={onClick} className="notification-bell">
      🔔
      {unreadCount > 0 && (
        <span className={`badge ${unreadCount > 0 ? 'pulse' : ''}`}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
```

Pulse animation (CSS):
```css
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.8; }
}
.badge.pulse {
  animation: pulse 2s ease-in-out infinite;
  background: #ce2b37;
  color: white;
  border-radius: 12px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 700;
}
```

### Notifications panel

Opens as a slide-in drawer (web) or bottom sheet (mobile):

```
┌─────────────────────────────────────────┐
│  Notifications              [Mark all read] [✕]
│─────────────────────────────────────────│
│  [All] [Comments] [Likes] [Followers] [Moderation]
│─────────────────────────────────────────│
│  COMMENTS                               │
│  ┌─────────────────────────────────┐   │
│  │ 👤 @chef_marie                  │   │
│  │ replied to your comment on      │   │
│  │ Homemade Biscuits · 2h ago      │   │
│  │ "This recipe is amazing!"       │   │  ← preview of their reply
│  │ [View Recipe →]  [Reply]        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  LIKES                                  │
│  ┌─────────────────────────────────┐   │
│  │ ❤️ 5 people liked               │   │
│  │ Homemade Biscuits · Today       │   │
│  │ [View Recipe →]                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  FOLLOWERS                              │
│  ┌─────────────────────────────────┐   │
│  │ 👤 @newchef started following   │   │
│  │ you · Yesterday                 │   │
│  │ [View Profile →]                │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Reply from notifications panel
When user taps [Reply] on a comment notification:
- Opens an inline reply input within the notification
- On submit: posts the reply and marks notification as read
- Does NOT navigate away from the panel

### "View Recipe →" link
Opens the recipe detail page and scrolls to the specific comment thread.
Pass `?comment=[commentId]` in the URL and scroll to that comment on load.

### Mark as read
- Tapping any notification marks it as read (is_read = true)
- "Mark all read" button marks all as read
- Unread notifications have a subtle left border in red
- Unread count in the bell updates in real-time

---

## PART 3 — MOBILE NOTIFICATIONS

Same notification bell in the mobile app:
- Place in the recipe list screen header (top-right)
- Or as a badge on the Recipes tab icon in the tab bar
- Tapping opens a full-screen notifications screen (not a bottom sheet)
- Same sections: All / Comments / Likes / Followers / Moderation
- Reply from within the notifications screen works the same way

---

## TESTING

After implementing:

1. Post a comment on a recipe → recipe owner should receive notification
2. Reply to that comment → commenter receives notification
3. Like a recipe 5 times (with different accounts or test) → batched like notification
4. Follow a user → follower notification
5. Verify bell pulses and shows correct unread count
6. Open notifications panel → all sections correct
7. Mark as read → bell count decreases
8. Tap "View Recipe →" → navigates to recipe, scrolls to comment

```bash
# Verify notifications in DB:
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT type, actor_username, recipe_title, message, is_read, batch_count
   FROM notifications ORDER BY created_at DESC LIMIT 10;"
```

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm dedupe
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] reply_count column + trigger applied to RPi5
- [ ] Migration 027 applied (notifications expanded)
- [ ] Replies show inline under parent comment (1 level deep display)
- [ ] "▶ N more replies" expander for threads with 3+ replies
- [ ] Thread view opens on expander tap (bottom sheet/panel)
- [ ] Inline reply input appears when Reply tapped
- [ ] Reply pre-filled with @username
- [ ] Reply creates comment with correct parent_id
- [ ] Notification created on new reply (not to self)
- [ ] Notification created on new comment on your recipe
- [ ] Like notifications batched (not one per like)
- [ ] Follower notifications working
- [ ] Bell in global web header with pulse animation
- [ ] Bell in mobile recipe list / tab bar
- [ ] Unread count shows on bell
- [ ] Notifications panel: 5 section tabs (All/Comments/Likes/Followers/Moderation)
- [ ] Reply from notification panel works
- [ ] "View Recipe →" scrolls to comment
- [ ] Mark as read works (single + mark all)
- [ ] Real-time unread count updates
- [ ] Tested all notification types via psql verification
- [ ] Safe area insets on all mobile new UI
- [ ] i18n keys for all new strings (all 5 locales)
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
