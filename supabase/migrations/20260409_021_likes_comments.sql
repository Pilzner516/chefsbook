-- 021: Likes, comments, AI moderation, user flagging

-- Likes
CREATE TABLE IF NOT EXISTS recipe_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recipe_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_recipe ON recipe_likes(recipe_id);
ALTER TABLE recipe_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read likes') THEN
    CREATE POLICY "Anyone can read likes" ON recipe_likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can manage own likes') THEN
    CREATE POLICY "Auth users can manage own likes" ON recipe_likes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION update_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE recipes SET like_count = like_count + 1 WHERE id = NEW.recipe_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE recipes SET like_count = like_count - 1 WHERE id = OLD.recipe_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS like_count_trigger ON recipe_likes;
CREATE TRIGGER like_count_trigger
  AFTER INSERT OR DELETE ON recipe_likes
  FOR EACH ROW EXECUTE FUNCTION update_like_count();

-- Comments
CREATE TABLE IF NOT EXISTS recipe_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES recipe_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  status TEXT DEFAULT 'visible',
  flag_severity TEXT,
  flag_source TEXT,
  flag_reason TEXT,
  flagged_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_recipe ON recipe_comments(recipe_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON recipe_comments(user_id);
ALTER TABLE recipe_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read visible comments') THEN
    CREATE POLICY "Anyone can read visible comments" ON recipe_comments FOR SELECT
      USING (status = 'visible' OR status = 'approved' OR user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can insert comments') THEN
    CREATE POLICY "Auth users can insert comments" ON recipe_comments FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own comments') THEN
    CREATE POLICY "Users can update own comments" ON recipe_comments FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- Comment count trigger
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'visible' THEN
    UPDATE recipes SET comment_count = comment_count + 1 WHERE id = NEW.recipe_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'visible' THEN
    UPDATE recipes SET comment_count = comment_count - 1 WHERE id = OLD.recipe_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comment_count_trigger ON recipe_comments;
CREATE TRIGGER comment_count_trigger
  AFTER INSERT OR DELETE ON recipe_comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_count();

-- Comment flags (user reports)
CREATE TABLE IF NOT EXISTS comment_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES recipe_comments(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, flagged_by)
);

-- Comments suspended
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS comments_suspended BOOLEAN DEFAULT false;

-- Blocked commenters per recipe owner
CREATE TABLE IF NOT EXISTS blocked_commenters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
