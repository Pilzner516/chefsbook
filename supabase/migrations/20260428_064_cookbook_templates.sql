-- Migration 064: Create cookbook_templates table for template registry
-- This enables admin-managed templates and future AI generation.

CREATE TABLE IF NOT EXISTS cookbook_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Classic',
  preview_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE cookbook_templates IS
  'Registry of cookbook PDF templates. Admin can activate/deactivate and reorder.';

-- Insert the 6 existing templates
INSERT INTO cookbook_templates (id, name, description, category, is_active, is_premium, sort_order) VALUES
  ('classic', 'Trattoria', 'Warm & rustic Italian style. Cream background, red accents.', 'Classic', true, false, 10),
  ('modern', 'Studio', 'Dark & dramatic chef''s notebook. Bold contrast.', 'Modern', true, false, 20),
  ('minimal', 'Garden', 'Clean & airy editorial. White with green accents.', 'Minimal', true, false, 30),
  ('heritage', 'Heritage', 'Farmhouse charm with sage green accents.', 'Classic', true, false, 40),
  ('nordic', 'Nordic', 'Stark Scandinavian minimalism with blue accents.', 'Minimal', true, false, 50),
  ('bbq', 'BBQ', 'Bold smoky pitmaster style. Charcoal with amber.', 'Modern', true, false, 60)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE cookbook_templates ENABLE ROW LEVEL SECURITY;

-- Public read policy (all users can see active templates)
CREATE POLICY "Anyone can view active templates"
  ON cookbook_templates FOR SELECT
  USING (is_active = true);

-- Admin full access policy
CREATE POLICY "Admins can manage templates"
  ON cookbook_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );
