-- 024: Stores table + store_id on shopping_lists

CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  logo_url TEXT,
  initials TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_user_name
  ON stores (user_id, lower(name));

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own stores') THEN
    CREATE POLICY "Users can manage own stores"
      ON stores FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

ALTER TABLE shopping_lists
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- Backfill: create store records from existing shopping_lists.store_name
INSERT INTO stores (user_id, name, initials)
SELECT DISTINCT
  user_id,
  store_name,
  upper(left(store_name, 2))
FROM shopping_lists
WHERE store_name IS NOT NULL AND store_name != ''
ON CONFLICT (user_id, lower(name)) DO NOTHING;
