-- 027: Threaded comments (reply_count) + notifications expansion

ALTER TABLE recipe_comments ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
    UPDATE recipe_comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
    UPDATE recipe_comments SET reply_count = reply_count - 1 WHERE id = OLD.parent_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reply_count_trigger ON recipe_comments;
CREATE TRIGGER reply_count_trigger
  AFTER INSERT OR DELETE ON recipe_comments
  FOR EACH ROW EXECUTE FUNCTION update_reply_count();

-- Expand notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS actor_username TEXT,
  ADD COLUMN IF NOT EXISTS actor_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS recipe_title TEXT,
  ADD COLUMN IF NOT EXISTS comment_id UUID,
  ADD COLUMN IF NOT EXISTS batch_count INTEGER DEFAULT 1;
