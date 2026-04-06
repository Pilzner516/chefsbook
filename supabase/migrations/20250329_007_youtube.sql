-- ============================================================
-- YOUTUBE IMPORT — video recipe support
-- ============================================================

-- Add YouTube-specific columns to recipes
ALTER TABLE recipes ADD COLUMN youtube_video_id text;
ALTER TABLE recipes ADD COLUMN channel_name text;
ALTER TABLE recipes ADD COLUMN video_only boolean DEFAULT false;

-- Add timestamp column to recipe_steps
ALTER TABLE recipe_steps ADD COLUMN timestamp_seconds integer;

-- Expand source_type CHECK to include 'youtube'
ALTER TABLE recipes DROP CONSTRAINT recipes_source_type_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_source_type_check CHECK (
  source_type IN ('url','scan','manual','ai','social','cookbook','youtube')
);
