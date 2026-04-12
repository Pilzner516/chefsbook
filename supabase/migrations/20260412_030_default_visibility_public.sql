-- Change default recipe visibility from 'shared_link' to 'public'
-- All new recipes should be public by default
ALTER TABLE recipes ALTER COLUMN visibility SET DEFAULT 'public';

-- Migrate existing shared_link recipes to public
UPDATE recipes SET visibility = 'public' WHERE visibility = 'shared_link';
