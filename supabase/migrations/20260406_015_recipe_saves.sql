-- Add save_count to recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS save_count integer DEFAULT 0;

-- Create recipe_saves table for social saves (distinct from is_favourite personal bookmark)
CREATE TABLE IF NOT EXISTS recipe_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_at timestamptz DEFAULT now(),
  UNIQUE(recipe_id, user_id)
);

-- Trigger to auto-update save_count
CREATE OR REPLACE FUNCTION update_recipe_save_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE recipes SET save_count = save_count + 1
    WHERE id = NEW.recipe_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE recipes SET save_count = GREATEST(save_count - 1, 0)
    WHERE id = OLD.recipe_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recipe_save_count_trigger ON recipe_saves;
CREATE TRIGGER recipe_save_count_trigger
AFTER INSERT OR DELETE ON recipe_saves
FOR EACH ROW EXECUTE FUNCTION update_recipe_save_count();

-- RLS
ALTER TABLE recipe_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own saves" ON recipe_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saves" ON recipe_saves
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read saves" ON recipe_saves
  FOR SELECT USING (true);
