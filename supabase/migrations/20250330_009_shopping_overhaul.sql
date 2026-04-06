-- ============================================================
-- SHOPPING LIST OVERHAUL — 2026-03-30
-- ============================================================

-- Extend shopping_lists
ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS store_name text;
ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;
ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Extend shopping_list_items
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS category text CHECK (
  category IN ('produce','dairy','meat','bakery','spices','frozen','canned','beverages','household','other')
);
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS quantity_needed text;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS purchase_unit text;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS unit_display text;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS checked_at timestamptz;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS recipe_name text;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS manually_added boolean DEFAULT false;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS item_image_url text;

-- Sharing table
CREATE TABLE IF NOT EXISTS shopping_list_shares (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id    uuid REFERENCES shopping_lists(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  can_edit   boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (list_id, shared_with_user_id)
);

ALTER TABLE shopping_list_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or shared" ON shopping_list_shares FOR ALL
  USING (
    auth.uid() = shared_with_user_id
    OR auth.uid() = (SELECT user_id FROM shopping_lists WHERE id = list_id)
  );

-- Update shopping_lists RLS to include shared lists
DROP POLICY IF EXISTS "own" ON shopping_lists;
CREATE POLICY "own or shared" ON shopping_lists FOR ALL
  USING (
    auth.uid() = user_id
    OR id IN (SELECT list_id FROM shopping_list_shares WHERE shared_with_user_id = auth.uid())
  );

-- Update shopping_list_items RLS to include shared lists
DROP POLICY IF EXISTS "own" ON shopping_list_items;
CREATE POLICY "own or shared" ON shopping_list_items FOR ALL
  USING (
    auth.uid() = user_id
    OR list_id IN (SELECT list_id FROM shopping_list_shares WHERE shared_with_user_id = auth.uid())
  );

-- Enable realtime on shopping_list_items for live sync
ALTER PUBLICATION supabase_realtime ADD TABLE shopping_list_items;

-- Index for shared list lookups
CREATE INDEX IF NOT EXISTS shopping_list_shares_user ON shopping_list_shares (shared_with_user_id);
