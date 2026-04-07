-- Recipe versioning: parent/child version relationships
-- A recipe with is_parent=true has child versions linked via parent_recipe_id

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS parent_recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS version_label TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_parent BOOLEAN DEFAULT false;

-- Index for fast child lookup
CREATE INDEX IF NOT EXISTS idx_recipes_parent ON recipes(parent_recipe_id);
