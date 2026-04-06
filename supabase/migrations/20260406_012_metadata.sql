-- Dietary restrictions as structured flags on recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS dietary_flags text[] DEFAULT '{}';
-- Values: vegan, vegetarian, gluten-free, dairy-free, nut-free,
--         halal, kosher, low-carb, keto, paleo

-- Attribution: source ChefsBook user when recipe is cloned
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS attributed_to_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS attributed_to_username text;

-- Ingredient search uses recipe_ingredients table which already has
-- a gin_trgm_ops index on the ingredient column (recipe_ingredients_name).

-- Updated clone_recipe to include attribution + dietary_flags
CREATE OR REPLACE FUNCTION clone_recipe(
  p_source_recipe_id uuid,
  p_target_user_id   uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_new_id uuid;
  v_source recipes%rowtype;
  v_username text;
BEGIN
  SELECT * INTO v_source
  FROM recipes
  WHERE id = p_source_recipe_id
    AND (visibility IN ('public', 'shared_link') OR user_id = p_target_user_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipe not found or not accessible';
  END IF;

  SELECT username INTO v_username
  FROM user_profiles
  WHERE id = v_source.user_id;

  INSERT INTO recipes (
    user_id, title, description, source_url, source_type,
    image_url, prep_minutes, cook_minutes, servings,
    cuisine, course, tags, notes,
    calories, protein_g, carbs_g, fat_g,
    visibility, dietary_flags,
    attributed_to_user_id, attributed_to_username
  ) VALUES (
    p_target_user_id,
    v_source.title,
    v_source.description,
    v_source.source_url,
    v_source.source_type,
    v_source.image_url,
    v_source.prep_minutes,
    v_source.cook_minutes,
    v_source.servings,
    v_source.cuisine,
    v_source.course,
    v_source.tags,
    v_source.notes,
    v_source.calories,
    v_source.protein_g,
    v_source.carbs_g,
    v_source.fat_g,
    'private',
    COALESCE(v_source.dietary_flags, '{}'),
    v_source.user_id,
    v_username
  )
  RETURNING id INTO v_new_id;

  INSERT INTO recipe_ingredients (recipe_id, user_id, sort_order, quantity, unit, ingredient, preparation, optional, group_label)
  SELECT v_new_id, p_target_user_id, sort_order, quantity, unit, ingredient, preparation, optional, group_label
  FROM recipe_ingredients
  WHERE recipe_id = p_source_recipe_id
  ORDER BY sort_order;

  INSERT INTO recipe_steps (recipe_id, user_id, step_number, instruction)
  SELECT v_new_id, p_target_user_id, step_number, instruction
  FROM recipe_steps
  WHERE recipe_id = p_source_recipe_id
  ORDER BY step_number;

  RETURN v_new_id;
END;
$$;
