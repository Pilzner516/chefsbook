-- Migration 021: Update clone_recipe to set original_submitter fields
-- original_submitter chains from source recipe (or falls back to source user)
-- shared_by is set by application layer after clone (needs ?ref= context)

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
  v_orig_submitter_id uuid;
  v_orig_submitter_username text;
BEGIN
  SELECT * INTO v_source
  FROM recipes
  WHERE id = p_source_recipe_id
    AND (visibility IN ('public', 'shared_link') OR user_id = p_target_user_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipe not found or not accessible';
  END IF;

  -- Resolve original submitter: chain from source, or fall back to source user
  v_orig_submitter_id := COALESCE(v_source.original_submitter_id, v_source.user_id);
  SELECT username INTO v_orig_submitter_username
    FROM user_profiles WHERE id = v_orig_submitter_id;

  -- Also get source user's username for attributed_to (legacy field)
  SELECT username INTO v_username
  FROM user_profiles
  WHERE id = v_source.user_id;

  INSERT INTO recipes (
    user_id, title, description, source_url, source_type,
    image_url, prep_minutes, cook_minutes, servings,
    cuisine, course, tags, notes,
    calories, protein_g, carbs_g, fat_g,
    visibility, dietary_flags,
    attributed_to_user_id, attributed_to_username,
    original_submitter_id, original_submitter_username
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
    v_username,
    v_orig_submitter_id,
    v_orig_submitter_username
  )
  RETURNING id INTO v_new_id;

  INSERT INTO recipe_ingredients (recipe_id, user_id, sort_order, quantity, unit, ingredient, preparation, optional, group_label)
  SELECT v_new_id, p_target_user_id, sort_order, quantity, unit, ingredient, preparation, optional, group_label
  FROM recipe_ingredients WHERE recipe_id = p_source_recipe_id;

  INSERT INTO recipe_steps (recipe_id, user_id, step_number, instruction, timer_minutes, group_label)
  SELECT v_new_id, p_target_user_id, step_number, instruction, timer_minutes, group_label
  FROM recipe_steps WHERE recipe_id = p_source_recipe_id;

  RETURN v_new_id;
END;
$$;
