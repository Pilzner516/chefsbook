-- Migration 066: Extend cookbook_templates for template engine support
-- Phase 1 of the template system rebuild.
-- Adds columns for manifest, component code, and validation.

-- Add new columns to cookbook_templates
ALTER TABLE cookbook_templates
  ADD COLUMN IF NOT EXISTS manifest JSONB,
  ADD COLUMN IF NOT EXISTS component_code TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'draft', 'error')),
  ADD COLUMN IF NOT EXISTS supported_page_sizes TEXT[]
    NOT NULL DEFAULT ARRAY['letter'],
  ADD COLUMN IF NOT EXISTS lulu_compliant BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS validation_errors JSONB,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Mark all existing templates as system templates with full page size support
UPDATE cookbook_templates
SET
  is_system = true,
  lulu_compliant = true,
  supported_page_sizes = ARRAY['letter', 'trade', 'large-trade', 'digest', 'square'],
  status = 'active';

-- Populate manifests for the six system templates
UPDATE cookbook_templates SET manifest = '{
  "id": "classic",
  "name": "Trattoria",
  "description": "Warm rustic Italian style with cream background and red accents",
  "version": "2.0.0",
  "isSystem": true,
  "status": "active",
  "supportedPageSizes": ["letter", "trade", "large-trade", "digest", "square"],
  "luluCompliant": true,
  "fonts": [
    {"family": "Playfair Display", "weights": [400, 600, 700], "italic": [400]},
    {"family": "Inter", "weights": [300, 400, 500, 600]}
  ],
  "settings": {
    "palette": {
      "accent": "#ce2b37",
      "background": "#faf7f0",
      "text": "#1a1a1a",
      "muted": "#7a6a5a",
      "surface": "#f0ece0"
    },
    "fonts": {"heading": "Playfair Display", "body": "Inter"}
  }
}'::jsonb WHERE id = 'classic';

UPDATE cookbook_templates SET manifest = '{
  "id": "modern",
  "name": "Studio",
  "description": "Modern dark theme with dramatic presentation",
  "version": "2.0.0",
  "isSystem": true,
  "status": "active",
  "supportedPageSizes": ["letter", "trade", "large-trade", "digest", "square"],
  "luluCompliant": true,
  "fonts": [
    {"family": "Playfair Display", "weights": [400, 700], "italic": [400]},
    {"family": "Inter", "weights": [300, 400, 600]}
  ],
  "settings": {
    "palette": {
      "accent": "#ce2b37",
      "background": "#1a1a1a",
      "text": "#f5f0e8",
      "muted": "rgba(245, 240, 232, 0.5)",
      "surface": "#242424"
    },
    "fonts": {"heading": "Playfair Display", "body": "Inter"}
  }
}'::jsonb WHERE id = 'modern';

UPDATE cookbook_templates SET manifest = '{
  "id": "minimal",
  "name": "Garden",
  "description": "Fresh minimal style celebrating photography",
  "version": "2.0.0",
  "isSystem": true,
  "status": "active",
  "supportedPageSizes": ["letter", "trade", "large-trade", "digest", "square"],
  "luluCompliant": true,
  "fonts": [
    {"family": "Inter", "weights": [300, 400, 500, 600, 700]}
  ],
  "settings": {
    "palette": {
      "accent": "#009246",
      "background": "#ffffff",
      "text": "#1a1a1a",
      "muted": "#9a8a7a",
      "surface": "#f0ece0"
    },
    "fonts": {"heading": "Inter", "body": "Inter"}
  }
}'::jsonb WHERE id = 'minimal';

UPDATE cookbook_templates SET manifest = '{
  "id": "heritage",
  "name": "Heritage",
  "description": "Warm farmhouse style like a family heirloom",
  "version": "2.0.0",
  "isSystem": true,
  "status": "active",
  "supportedPageSizes": ["letter", "trade", "large-trade", "digest", "square"],
  "luluCompliant": true,
  "fonts": [
    {"family": "Libre Baskerville", "weights": [400, 700], "italic": [400]},
    {"family": "Source Sans Pro", "weights": [300, 400, 600]}
  ],
  "settings": {
    "palette": {
      "accent": "#8b9a7d",
      "background": "#f8f5f0",
      "text": "#3a3028",
      "muted": "#9a8a7a",
      "surface": "#f0ebe3"
    },
    "fonts": {"heading": "Libre Baskerville", "body": "Source Sans Pro"}
  }
}'::jsonb WHERE id = 'heritage';

UPDATE cookbook_templates SET manifest = '{
  "id": "nordic",
  "name": "Nordic",
  "description": "Stark Scandinavian minimalism with massive white space",
  "version": "2.0.0",
  "isSystem": true,
  "status": "active",
  "supportedPageSizes": ["letter", "trade", "large-trade", "digest", "square"],
  "luluCompliant": true,
  "fonts": [
    {"family": "Work Sans", "weights": [300, 400, 500, 600, 700]}
  ],
  "settings": {
    "palette": {
      "accent": "#5c7a8a",
      "background": "#ffffff",
      "text": "#2d2d2d",
      "muted": "#4a4a4a",
      "surface": "#f5f5f5"
    },
    "fonts": {"heading": "Work Sans", "body": "Work Sans"}
  }
}'::jsonb WHERE id = 'nordic';

UPDATE cookbook_templates SET manifest = '{
  "id": "bbq",
  "name": "BBQ",
  "description": "Smoky rustic American barbecue style",
  "version": "2.0.0",
  "isSystem": true,
  "status": "active",
  "supportedPageSizes": ["letter", "trade", "large-trade", "digest", "square"],
  "luluCompliant": true,
  "fonts": [
    {"family": "Oswald", "weights": [400, 500, 600, 700]},
    {"family": "Source Sans Pro", "weights": [300, 400, 600]}
  ],
  "settings": {
    "palette": {
      "accent": "#d4a03a",
      "background": "#f5f0e8",
      "text": "#2d2926",
      "muted": "#4a4543",
      "surface": "#fffdf8"
    },
    "fonts": {"heading": "Oswald", "body": "Source Sans Pro"}
  }
}'::jsonb WHERE id = 'bbq';

COMMENT ON COLUMN cookbook_templates.manifest IS
  'Full template manifest as JSON (settings, fonts, page sizes)';
COMMENT ON COLUMN cookbook_templates.component_code IS
  'TypeScript/TSX source code for non-system templates (evaluated at runtime)';
COMMENT ON COLUMN cookbook_templates.is_system IS
  'True for built-in templates; false for admin-uploaded or AI-generated';
COMMENT ON COLUMN cookbook_templates.status IS
  'Template status: active, inactive, draft, or error';
COMMENT ON COLUMN cookbook_templates.supported_page_sizes IS
  'Array of page sizes this template supports';
COMMENT ON COLUMN cookbook_templates.lulu_compliant IS
  'True if template meets Lulu print specifications';
COMMENT ON COLUMN cookbook_templates.validation_errors IS
  'JSON array of validation errors if status is error';
