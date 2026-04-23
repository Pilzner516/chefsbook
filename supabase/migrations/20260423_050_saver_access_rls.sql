-- Migration: Allow savers to access private recipes
-- Updates recipes visibility RLS policy to include recipe_saves check

-- Drop the old policy
DROP POLICY IF EXISTS "recipes: visibility" ON recipes;

-- Create new policy that includes saver access
CREATE POLICY "recipes: visibility" ON recipes FOR SELECT
USING (
  (user_id = uid())
  OR (visibility = 'public'::visibility_level)
  OR (visibility = 'shared_link'::visibility_level)
  OR ((visibility = 'friends'::visibility_level) AND (EXISTS (
    SELECT 1 FROM follows
    WHERE follows.follower_id = uid()
    AND follows.followed_id = recipes.user_id
    AND follows.status = 'accepted'
  )))
  OR (EXISTS (
    SELECT 1 FROM recipe_saves
    WHERE recipe_saves.recipe_id = recipes.id
    AND recipe_saves.user_id = uid()
  ))
);
