-- Migration 070: Menu items table
-- Each item is a recipe assigned to a course slot within a menu

CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  course TEXT NOT NULL DEFAULT 'main',
  sort_order INTEGER NOT NULL DEFAULT 0,
  servings_override INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX idx_menu_items_recipe_id ON menu_items(recipe_id);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menu items inherit menu owner access"
  ON menu_items FOR ALL USING (
    EXISTS (
      SELECT 1 FROM menus
      WHERE menus.id = menu_items.menu_id
        AND menus.user_id = auth.uid()
    )
  );

CREATE POLICY "Public menu items readable via public menu"
  ON menu_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM menus
      WHERE menus.id = menu_items.menu_id
        AND menus.is_public = true
    )
  );
