-- 016: Recipe content translations (cached per recipe per language)

CREATE TABLE IF NOT EXISTS recipe_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  translated_title TEXT,
  translated_description TEXT,
  translated_ingredients JSONB,
  translated_steps JSONB,
  translated_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recipe_id, language)
);

ALTER TABLE recipe_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own recipe translations"
  ON recipe_translations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_translations.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own recipe translations"
  ON recipe_translations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_translations.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own recipe translations"
  ON recipe_translations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_translations.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );

-- Allow deleting translations when recipe is edited
CREATE POLICY "Users can delete own recipe translations"
  ON recipe_translations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_translations.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );
