# Favourites Heart + Recipe Save Count
# Save to: docs/prompts/favourites-save-count.md

Read CLAUDE.md, apps/mobile/CLAUDE.md and
.claude/agents/navigator.md to orient yourself.

Two features to implement:

## Feature 1 — Red heart on Favourites category card
In apps/mobile/app/(tabs)/search.tsx:

The Favourites category card currently shows a plain heart icon.
Change it to use colors.accent (#ce2b37) — filled red heart.
Use Ionicons "heart" (filled) not "heart-outline".
This applies in both My Recipes and Discover modes.

## Feature 2 — Recipe save/favorite count
### Database
Add to recipes table:
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS save_count integer DEFAULT 0;

Create a trigger that updates save_count automatically:
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

Check if a favourites or recipe_saves table exists.
If favourites are stored as a boolean on recipes (is_favourite),
create a new recipe_saves table instead:

CREATE TABLE IF NOT EXISTS recipe_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_at timestamptz DEFAULT now(),
  UNIQUE(recipe_id, user_id)
);

CREATE TRIGGER recipe_save_count_trigger
AFTER INSERT OR DELETE ON recipe_saves
FOR EACH ROW EXECUTE FUNCTION update_recipe_save_count();

RLS on recipe_saves:
- Users can insert/delete their own saves
- save_count on recipes is readable by all

Run migration on rpi5-eth via SSH.

### Recipe card — save count badge
In apps/mobile/components/UIKit.tsx (RecipeCard component):

Add a small save count badge overlaid on the recipe image
bottom-left corner:
- Only show if save_count > 0
- Style: small pill, semi-transparent dark background 
  (rgba(0,0,0,0.55)), white text
- Content: Ionicons "heart" (12px, #ff6b6b) + save count number
- Font: 11px white, font weight 600
- Padding: 4px 8px, border radius 12px
- Position: absolute, bottom: 8, left: 8
- Examples: "❤ 3", "❤ 47"

### Recipe detail — save count display
In apps/mobile/app/recipe/[id].tsx:

Below the recipe title, in the metadata row alongside 
cuisine and cook time:
- Show: Ionicons "heart" in colors.accent + "[n] saves"
- Only show if save_count > 0
- Font: 13px textSecondary
- If it's the user's OWN recipe: show "❤ 12 people saved this"
- If it's someone else's recipe: show "❤ 12 saves"

### Wire up saves
When user taps the heart/favourite on any recipe:
- Insert into recipe_saves (recipe_id, user_id)
- On untap: delete from recipe_saves
- This auto-triggers the save_count update via the trigger
- Update the local save_count display immediately (optimistic UI)

If recipes currently use is_favourite boolean:
- Keep is_favourite for the user's OWN recipes 
  (personal bookmark, not a social action)
- Use recipe_saves for saving OTHER users' public recipes
- These are two distinct actions

## Verify
adb screenshot to /tmp/cb_screen.png of:
1. Search tab — confirm Favourites card has red heart
2. Recipe list — confirm save count badge on a recipe image
3. Recipe detail — confirm save count in metadata row
Describe each, delete after.

Fix all errors without stopping.
Do not embed screenshots.
Commit: git add -A && git commit -m "feat: red heart on favourites, recipe save count badge"
