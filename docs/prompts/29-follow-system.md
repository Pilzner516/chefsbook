# ChefsBook — Session 29: Follow System + What's New Feed
# Depends on: Session 26 (usernames)
# Target: apps/mobile + apps/web + packages/db

---

## CROSS-PLATFORM REQUIREMENT — READ FIRST

Every feature in this session MUST be implemented on BOTH platforms:
- `apps/mobile` — React Native / Expo
- `apps/web` — Next.js

Do not implement a feature on one platform and leave the other with a TODO.
Both must be fully working before /wrapup.

Platform-specific notes:
- Follow button → on public profile pages on both web and mobile
- What's New feed → Search tab on mobile AND Discover/Search page on web
- Followers/Following tabs → on public profile pages on both platforms
- All new modals/sheets → safe area insets on mobile, standard modal on web

---

## CONTEXT

Users can follow each other to see new public recipes in a "What's New" feed.
Read all applicable agents before starting.

---

## DB CHANGES

Migration `020_follow_system.sql`:

```sql
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON user_follows(following_id);

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read follows"
  ON user_follows FOR SELECT USING (true);

CREATE POLICY "Users can manage own follows"
  ON user_follows FOR ALL
  USING (follower_id = auth.uid())
  WITH CHECK (follower_id = auth.uid());

-- Auto-update follower/following counts via triggers
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE user_profiles SET following_count = following_count + 1
      WHERE id = NEW.follower_id;
    UPDATE user_profiles SET follower_count = follower_count + 1
      WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE user_profiles SET following_count = following_count - 1
      WHERE id = OLD.follower_id;
    UPDATE user_profiles SET follower_count = follower_count - 1
      WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER follow_count_trigger
  AFTER INSERT OR DELETE ON user_follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
```

---

## FOLLOW BUTTON

### On public profile pages
```
[Following ✓]  ← already following (tap to unfollow, with confirmation)
[Follow +]     ← not following
```

- Optimistic update (update UI immediately, sync to DB in background)
- Unfollow requires confirmation: "Unfollow @username?"
- Cannot follow yourself (button hidden on own profile)

### Follow gating
Following requires Chef plan or above. Free users see:
```
[🔒 Follow — Chef Plan Required]
```

---

## WHAT'S NEW FEED

### Location
Search tab — new card alongside existing category cards (Cuisine, Course, etc.)
Label: "What's New" with a ✨ or 🔔 icon.

### Behaviour
- Only visible to users who follow at least one person
- If following nobody: card shows "Follow chefs to see their latest recipes"
  with a "Find people to follow" button → navigates to user search
- Tapping the card opens the What's New feed (full screen or bottom sheet)

### Feed content
```sql
-- Recipes from followed users, public only, ordered by newest
SELECT r.*, up.username, up.avatar_url
FROM recipes r
JOIN user_profiles up ON up.id = r.user_id
JOIN user_follows uf ON uf.following_id = r.user_id
WHERE uf.follower_id = [current_user_id]
  AND r.visibility = 'public'
ORDER BY r.created_at DESC
LIMIT 50;
```

### Feed UI
- Recipe cards same style as Discover feed
- Shows "@username · 2 hours ago" below each card
- Tapping card opens recipe detail
- Pull to refresh
- Empty state: "No new recipes from people you follow yet"

---

## PUBLIC PROFILE — FOLLOW TAB

On public profile pages, add two tabs:
- **Recipes** — public recipes (existing)
- **Followers** — list of followers (avatar + username)
- **Following** — list of who they follow

Both lists are public (visible to anyone viewing the profile).
Tapping a user in these lists navigates to their profile.

---

## NOTIFICATIONS (foundation only)

Add `notifications` table for future use — just the schema, no UI yet:
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'new_follower', 'new_comment', 'recipe_liked', 'comment_flagged'
  actor_id UUID REFERENCES user_profiles(id),
  recipe_id UUID REFERENCES recipes(id),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Trigger to create notification on new follow:
```sql
CREATE OR REPLACE FUNCTION notify_new_follower()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, actor_id, message)
  VALUES (NEW.following_id, 'new_follower', NEW.follower_id,
    'started following you');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER new_follower_notification
  AFTER INSERT ON user_follows
  FOR EACH ROW EXECUTE FUNCTION notify_new_follower();
```

---

## COMPLETION CHECKLIST

- [ ] Migration 020 applied to RPi5
- [ ] Follow/unfollow works on public profile pages
- [ ] Follow counts update immediately (triggers)
- [ ] Follow requires Chef plan or above
- [ ] What's New card in Search tab
- [ ] What's New feed shows public recipes from followed users
- [ ] Feed shows @username and relative time per recipe
- [ ] Empty state with "find people" CTA when following nobody
- [ ] Followers/Following tabs on public profile
- [ ] Notifications table created (no UI yet)
- [ ] Safe area insets on all new screens
- [ ] i18n keys for all new strings
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
