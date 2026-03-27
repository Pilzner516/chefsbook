# Supabase Migrations

All migrations are run manually against the self-hosted Supabase Postgres on rpi5-eth.

```bash
ssh rasp@rpi5-eth "sudo docker exec -i supabase-db psql -U postgres -d postgres" < supabase/migrations/<filename>.sql
```

## Migration Log

### 20250327_001_core.sql
Core schema. Creates all foundational tables with RLS policies:
- `user_profiles` — one per auth.users row, auto-created via trigger
- `follows` — social graph (follower/followed with pending/accepted status)
- `cookbooks` — physical cookbook shelf (EYB-style)
- `recipes` — core recipe table with visibility model (private/shared_link/friends/public)
- `recipe_ingredients` — ingredients with quantity, unit, preparation, group_label
- `recipe_steps` — ordered steps with optional timer_minutes
- `meal_plans` — daily meal planning (strictly private)
- `shopping_lists` / `shopping_list_items` — shopping lists with aisle grouping

Extensions enabled: `pg_trgm`, `unaccent`.
Indexes: GIN trgm on recipe title + ingredient names, standard B-tree on FKs and filters.
Triggers: `handle_new_user()` (auto-create profile), `update_updated_at()` (timestamps).

### 20250327_002_functions.sql
Server-side Postgres functions (all `security invoker`):
- `search_recipes(user_id, query, cuisine, course, max_time)` — pg_trgm fuzzy search across title + ingredients, returns relevance score
- `get_meal_plan_week(user_id, week_start_date)` — 7-day series LEFT JOINed to meal_plans + recipes
- `generate_shopping_list(user_id, meal_plan_ids[])` — aggregates ingredients across recipes, groups by aisle with smart defaults
- `clone_recipe(source_recipe_id, target_user_id)` — copies public/shared recipe + ingredients + steps into another user's collection
- `get_public_feed(limit, offset, cuisine_filter)` — public recipes with author info, ordered by rating + recency

### 20250327_003_storage.sql
Supabase Storage buckets with RLS policies:
- `recipe-images` — public read, authenticated write (own folder), 5MB limit, JPEG/PNG/WebP/GIF
- `avatars` — public read, authenticated write (own folder), 2MB limit, JPEG/PNG/WebP

### 20250327_004_features.sql
Additional feature tables:
- `cooking_notes` — journal entries per recipe cook (recipe_id, user_id, note, cooked_at)
- `menu_templates` — reusable meal plan templates (name, recipe_ids[])
- Adds `sub_recipe_id` column to `recipe_ingredients` (FK to recipes, for nested recipes)

### 20250327_005_categories.sql
Hierarchical recipe taxonomy — 8 groups, 371 total categories:
- `category_groups` — top-level groups (ingredient, cuisine, meal, method, diet, time, occasion, season)
- `categories` — self-referencing tree (parent_id for subcategories)
- `recipe_categories` — many-to-many join table

Category counts: ingredient (96), cuisine (74), meal (56), method (48), diet (27), time (15), occasion (27), season (28).

Key design decisions:
- French/Italian cuisine drill down to regions (Provençal, Lyonnaise, Roman, Neapolitan, etc.)
- Fungi, Chocolate, Bread, Pastry are standalone subcategories under ingredient
- Technique includes fermenting, confit, sous vide, lacto-fermentation

### 20250327_006_imports.sql
Bookmark batch import infrastructure:
- `import_jobs` — batch import tracking (status, source_type, URL counters, timestamps)
- `import_job_urls` — individual URLs with status (queued/processing/success/failed/duplicate/not_recipe), folder_name, linked recipe_id
- Adds `bookmark_folder` and `import_job_id` columns to `recipes` table
