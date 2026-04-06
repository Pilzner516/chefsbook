-- ============================================================
-- TECHNIQUES — cooking methods, skills, and processes
-- ============================================================
CREATE TABLE techniques (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title                text NOT NULL,
  description          text,
  -- Steps stored as JSONB: [{step_number, instruction, tip, common_mistake}]
  process_steps        jsonb DEFAULT '[]',
  tips                 text[] DEFAULT '{}',
  common_mistakes      text[] DEFAULT '{}',
  tools_and_equipment  text[] DEFAULT '{}',
  difficulty           text CHECK (difficulty IN ('beginner','intermediate','advanced')),
  -- Source
  source_url           text,
  source_type          text CHECK (source_type IN ('web','youtube','manual','extension')),
  youtube_video_id     text,
  image_url            text,
  -- Relations
  related_recipe_ids   uuid[] DEFAULT '{}',
  tags                 text[] DEFAULT '{}',
  -- Visibility & sharing
  visibility           visibility_level NOT NULL DEFAULT 'private',
  share_token          text UNIQUE DEFAULT translate(encode(gen_random_bytes(12),'base64'),'+/=','-_'),
  -- Timestamps
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX techniques_user_id    ON techniques (user_id);
CREATE INDEX techniques_title_trgm ON techniques USING gin (title gin_trgm_ops);

ALTER TABLE techniques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own" ON techniques FOR ALL USING (auth.uid() = user_id);
