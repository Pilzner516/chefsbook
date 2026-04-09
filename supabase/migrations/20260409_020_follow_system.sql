-- Migration 020: Follow system + notifications foundation
-- Depends on: user_profiles table (migration 001 + 017)

-- ── user_follows table ──
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

-- ── Auto-update follower/following counts via triggers ──
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE user_profiles SET following_count = following_count + 1
      WHERE id = NEW.follower_id;
    UPDATE user_profiles SET follower_count = follower_count + 1
      WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE user_profiles SET following_count = GREATEST(0, following_count - 1)
      WHERE id = OLD.follower_id;
    UPDATE user_profiles SET follower_count = GREATEST(0, follower_count - 1)
      WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER follow_count_trigger
  AFTER INSERT OR DELETE ON user_follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- ── Notifications table (foundation only — no UI yet) ──
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

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE USING (user_id = auth.uid());

-- ── Trigger to create notification on new follow ──
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
