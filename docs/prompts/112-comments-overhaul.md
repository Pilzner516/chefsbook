# ChefsBook — Session 112: Comments Overhaul
# Items: sorting, comment likes, unlimited depth, user profile link, comment notifications
# Target: apps/web + apps/mobile + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

This session overhauds the comments system. Multiple related changes —
implement all. Read data-flow.md and ui-guardian.md carefully before
writing any code.

---

## CHANGE 1 — Comment sorting: most engaged threads at top

Currently comments show in chronological order. Change to show the
most engaged threads first.

Sorting logic:
- Sort top-level comments by: (reply_count + like_count) DESC,
  then created_at DESC as tiebreaker
- Replies within a thread remain chronological (oldest first)
- This puts the most active discussions at the top

Update getComments() in packages/db to support this sort order.
Apply on both web and mobile.

---

## CHANGE 2 — Comment likes

Users should be able to like individual comments.

### Database (migration 033)

```sql
CREATE TABLE comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES recipe_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Add like_count to recipe_comments
ALTER TABLE recipe_comments ADD COLUMN IF NOT EXISTS like_count INT DEFAULT 0;

-- Trigger to maintain like_count
CREATE OR REPLACE FUNCTION update_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE recipe_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE recipe_comments SET like_count = like_count - 1 WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_like
  AFTER INSERT OR DELETE ON comment_likes
  FOR EACH ROW EXECUTE FUNCTION update_comment_like_count();
```

### DB functions in packages/db

Add:
- toggleCommentLike(commentId, userId) → inserts or deletes from comment_likes
- isCommentLiked(commentId, userId) → boolean
- Update getComments() to include like_count and isLiked per comment

### UI — web

On each comment (top-level and replies):
- Small heart icon + like count on the right side of the comment
- Clicking toggles like (optimistic update)
- Free plan users: same upgrade prompt as recipe likes
- Heart fills red when liked by current user

### UI — mobile

Same — heart icon + count per comment, optimistic toggle, plan gate.

---

## CHANGE 3 — Unlimited comment depth with "show more" collapse

Currently replies are 1 level deep. The system must support unlimited
depth but display only 2 levels deep by default.

### Database

recipe_comments already has parent_id. The system needs to support
grandchild comments (replies to replies).

Ensure:
- parent_id can reference any comment (not just top-level)
- reply_count trigger on parent comment fires for all direct children

### Display rules

- Level 1: top-level comments — always visible
- Level 2: direct replies — always visible (expand/collapse toggle)
- Level 3+: hidden behind a "▶ N more replies" button on the level 2
  comment, same as current level 2 collapse pattern
- Each level is indented slightly to show hierarchy

### Reply button

Every comment at every level must have a "Reply" button.
Clicking opens an inline reply input under that specific comment.
The reply is posted with parent_id = that comment's id.
This must work at level 2 (replying to a reply) — currently broken.

### Web implementation

- Reply button on every comment row (not just top-level)
- Inline textarea appears under the clicked comment
- Posted reply appears immediately in the thread
- "▶ N more replies" on level 2 comments that have children

### Mobile implementation

- Reply button on every comment row
- Same collapse/expand pattern
- Safe area insets on reply input

---

## CHANGE 4 — Clicking username in comments → profile (fix 404)

Clicking a username in the comments section gives a 404 error.
The link is likely going to /dashboard/u/[username] instead of
/u/[username] or /dashboard/chef/[username].

Fix:
1. Find where comment username links are rendered in web + mobile
2. Correct the route to /u/[username] (public profile page)
3. Verify: click a username in comments → profile loads (200)

---

## CHANGE 5 — Notifications: recipe owner notified on new comment

When a user comments on a recipe, the recipe owner must receive a
notification. This was designed in session 77 but is not working.

Diagnose:
1. Check the postComment() function in packages/db
2. Verify it calls createNotification() with type 'recipe_comment'
   for the recipe owner after inserting the comment
3. Check if the notification bell updates after a comment is posted
4. Verify the owner (pilzner) receives a notification when seblux
   comments on a recipe

Fix the notification flow if broken. Also verify:
- Reply notifications: when User B replies to User A's comment,
  User A gets a 'comment_reply' notification
- Both notification types appear in the bell panel

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth

# Apply migration 033
psql -U postgres -d postgres \
  -f /mnt/chefsbook/repo/supabase/migrations/033_comment_likes.sql
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

- [ ] Migration 033: comment_likes table + like_count on recipe_comments + trigger
- [ ] Comments sorted: most engaged (replies + likes) at top
- [ ] Comment like button on every comment (web + mobile)
- [ ] Comment like toggles optimistically, fills red when liked
- [ ] Free plan comment like shows upgrade prompt
- [ ] Reply button on EVERY comment at every depth level
- [ ] Replying to a reply works (level 3+ depth)
- [ ] Level 3+ replies hidden behind "▶ N more replies" expand button
- [ ] Username in comments links to /u/[username] — no 404
- [ ] Recipe owner receives notification when someone comments
- [ ] Comment author receives notification when someone replies to them
- [ ] Both notification types appear in bell panel
- [ ] PostgREST restarted after migration
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
