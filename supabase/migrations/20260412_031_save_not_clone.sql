-- Update search_recipes to include saved (bookmarked) recipes in user's results
CREATE OR REPLACE FUNCTION search_recipes(
  p_user_id UUID,
  p_query TEXT DEFAULT NULL,
  p_cuisine TEXT DEFAULT NULL,
  p_course TEXT DEFAULT NULL,
  p_max_time INT DEFAULT NULL,
  p_source_type TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_include_public BOOLEAN DEFAULT false,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS SETOF recipes AS $$
  SELECT r.*
  FROM recipes r
  WHERE (
    r.user_id = p_user_id
    OR (p_include_public AND r.visibility IN ('public', 'shared_link'))
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
  ORDER BY
    CASE WHEN p_query IS NOT NULL THEN similarity(r.title, p_query) ELSE 1.0 END DESC,
    r.updated_at DESC
  LIMIT p_limit OFFSET p_offset;
$$ LANGUAGE sql STABLE;
