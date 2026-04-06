-- ============================================================
-- COOKBOOK INTELLIGENCE — TOC, recipe matching, AI suggestions
-- ============================================================

-- Extend cookbooks table
ALTER TABLE cookbooks ADD COLUMN IF NOT EXISTS google_books_id text;
ALTER TABLE cookbooks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE cookbooks ADD COLUMN IF NOT EXISTS total_recipes int;
ALTER TABLE cookbooks ADD COLUMN IF NOT EXISTS toc_fetched boolean DEFAULT false;
ALTER TABLE cookbooks ADD COLUMN IF NOT EXISTS toc_fetched_at timestamptz;

-- Cookbook recipes (table of contents entries)
CREATE TABLE cookbook_recipes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cookbook_id        uuid REFERENCES cookbooks(id) ON DELETE CASCADE NOT NULL,
  title             text NOT NULL,
  page_number       int,
  chapter           text,
  description       text,
  matched_recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,
  ai_generated      boolean DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX cookbook_recipes_cookbook ON cookbook_recipes (cookbook_id, chapter);
CREATE INDEX cookbook_recipes_title_trgm ON cookbook_recipes USING gin (title gin_trgm_ops);

ALTER TABLE cookbook_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "via_cookbook_owner" ON cookbook_recipes FOR ALL
  USING (cookbook_id IN (SELECT id FROM cookbooks WHERE user_id = auth.uid()));
