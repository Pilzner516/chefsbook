-- Migration 078: Update search_recipes and get_public_feed to exclude personal versions

CREATE OR REPLACE FUNCTION public.search_recipes(p_user_id uuid, p_query text DEFAULT NULL::text, p_cuisine text DEFAULT NULL::text, p_course text DEFAULT NULL::text, p_max_time integer DEFAULT NULL::integer, p_source_type text DEFAULT NULL::text, p_tags text[] DEFAULT NULL::text[], p_include_public boolean DEFAULT false, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_cal_min integer DEFAULT NULL::integer, p_cal_max integer DEFAULT NULL::integer, p_protein_min integer DEFAULT NULL::integer, p_carbs_max integer DEFAULT NULL::integer, p_fat_max integer DEFAULT NULL::integer, p_fiber_min integer DEFAULT NULL::integer, p_sodium_max integer DEFAULT NULL::integer)
 RETURNS SETOF recipes
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (r.id) r.*
  FROM recipes r
  WHERE (
    r.user_id = p_user_id
    OR (p_include_public AND r.visibility IN ('public', 'shared_link') AND r.duplicate_of IS NULL)
    OR r.id IN (SELECT recipe_id FROM recipe_saves WHERE user_id = p_user_id)
  )
    AND r.is_personal_version = FALSE
    AND (p_query IS NULL OR (
      r.title ILIKE '%' || p_query || '%'
      OR r.description ILIKE '%' || p_query || '%'
      OR r.cuisine ILIKE '%' || p_query || '%'
      OR EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.recipe_id = r.id AND ri.ingredient ILIKE '%' || p_query || '%')
      OR EXISTS (SELECT 1 FROM unnest(r.tags) t WHERE t ILIKE '%' || p_query || '%')
    ))
    AND (p_cuisine IS NULL OR r.cuisine = p_cuisine)
    AND (p_course IS NULL OR r.course = p_course)
    AND (p_max_time IS NULL OR r.total_minutes <= p_max_time)
    AND (p_source_type IS NULL OR r.source_type = p_source_type)
    AND (p_tags IS NULL OR r.tags && p_tags)
    AND (p_cal_min IS NULL OR (
      r.nutrition IS NOT NULL
      AND (r.nutrition->'per_serving'->>'calories')::numeric >= p_cal_min
    ))
    AND (p_cal_max IS NULL OR (
      r.nutrition IS NOT NULL
      AND (r.nutrition->'per_serving'->>'calories')::numeric <= p_cal_max
    ))
    AND (p_protein_min IS NULL OR (
      r.nutrition IS NOT NULL
      AND (r.nutrition->'per_serving'->>'protein_g')::numeric >= p_protein_min
    ))
    AND (p_carbs_max IS NULL OR (
      r.nutrition IS NOT NULL
      AND (r.nutrition->'per_serving'->>'carbs_g')::numeric <= p_carbs_max
    ))
    AND (p_fat_max IS NULL OR (
      r.nutrition IS NOT NULL
      AND (r.nutrition->'per_serving'->>'fat_g')::numeric <= p_fat_max
    ))
    AND (p_fiber_min IS NULL OR (
      r.nutrition IS NOT NULL
      AND (r.nutrition->'per_serving'->>'fiber_g')::numeric >= p_fiber_min
    ))
    AND (p_sodium_max IS NULL OR (
      r.nutrition IS NOT NULL
      AND (r.nutrition->'per_serving'->>'sodium_mg')::numeric <= p_sodium_max
    ))
  ORDER BY r.id,
    CASE WHEN p_query IS NOT NULL THEN similarity(r.title, p_query) ELSE 1.0 END DESC,
    r.updated_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_feed(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0, p_cuisine_filter text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, user_id uuid, title text, description text, image_url text, prep_minutes integer, cook_minutes integer, total_minutes integer, servings integer, cuisine text, course text, rating integer, tags text[], created_at timestamp with time zone, author_name text, author_avatar text, attributed_to_username text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    r.id, r.user_id, r.title, r.description, r.image_url,
    r.prep_minutes, r.cook_minutes, r.total_minutes,
    r.servings, r.cuisine, r.course, r.rating,
    r.tags, r.created_at,
    coalesce(up.display_name, up.username, 'Chef') as author_name,
    up.avatar_url as author_avatar,
    r.attributed_to_username
  FROM recipes r
  JOIN user_profiles up ON up.id = r.user_id
  WHERE r.visibility IN ('public', 'shared_link')
    AND r.duplicate_of IS NULL
    AND r.is_personal_version = FALSE
    AND (p_cuisine_filter IS NULL OR r.cuisine = p_cuisine_filter)
  ORDER BY r.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$function$;
