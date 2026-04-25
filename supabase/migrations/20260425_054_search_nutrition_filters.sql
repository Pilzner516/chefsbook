-- Migration 054: Add nutrition filters to search_recipes function
-- Part of Nutrition-3 session

-- Drop existing function first (signature is changing with new parameters)
DROP FUNCTION IF EXISTS search_recipes(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT[], BOOLEAN, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION search_recipes(
  p_user_id UUID,
  p_query TEXT DEFAULT NULL,
  p_cuisine TEXT DEFAULT NULL,
  p_course TEXT DEFAULT NULL,
  p_max_time INTEGER DEFAULT NULL,
  p_source_type TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_include_public BOOLEAN DEFAULT false,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  -- Nutrition filters (new)
  p_cal_min INTEGER DEFAULT NULL,
  p_cal_max INTEGER DEFAULT NULL,
  p_protein_min INTEGER DEFAULT NULL,
  p_carbs_max INTEGER DEFAULT NULL,
  p_fat_max INTEGER DEFAULT NULL,
  p_fiber_min INTEGER DEFAULT NULL,
  p_sodium_max INTEGER DEFAULT NULL
) RETURNS SETOF recipes AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (r.id) r.*
  FROM recipes r
  WHERE (
    r.user_id = p_user_id
    OR (p_include_public AND r.visibility IN ('public', 'shared_link') AND r.duplicate_of IS NULL)
    OR r.id IN (SELECT recipe_id FROM recipe_saves WHERE user_id = p_user_id)
  )
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
    -- Nutrition filters: only apply when nutrition data exists AND filter is set
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
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_recipes IS 'Full-text recipe search with cuisine, course, time, tags, and nutrition filters. Nutrition filters only match recipes with nutrition data.';
