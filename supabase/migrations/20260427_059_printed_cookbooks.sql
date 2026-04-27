-- Migration: Printed Cookbooks (Lulu Print-on-Demand)
-- Tables for user-created print cookbook projects and orders

-- ============================================================
-- PRINTED_COOKBOOKS — user's print cookbook projects
-- ============================================================
CREATE TABLE printed_cookbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  author_name TEXT NOT NULL,
  cover_style TEXT NOT NULL DEFAULT 'classic'
    CHECK (cover_style IN ('classic', 'modern', 'minimal')),
  recipe_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generating', 'ready', 'ordered')),
  interior_pdf_url TEXT,
  cover_pdf_url TEXT,
  page_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_printed_cookbooks_user_id ON printed_cookbooks(user_id);

ALTER TABLE printed_cookbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own printed_cookbooks" ON printed_cookbooks
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- PRINTED_COOKBOOK_ORDERS — orders placed with Lulu
-- ============================================================
CREATE TABLE printed_cookbook_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  printed_cookbook_id UUID NOT NULL REFERENCES printed_cookbooks(id),
  lulu_print_job_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'payment_complete', 'submitted_to_lulu',
      'in_production', 'shipped', 'delivered', 'cancelled', 'failed'
    )),
  quantity INTEGER NOT NULL DEFAULT 1,
  -- Pricing (stored in cents)
  lulu_print_cost_cents INTEGER,
  shipping_cost_cents INTEGER,
  our_margin_cents INTEGER DEFAULT 499,
  total_charged_cents INTEGER,
  -- Shipping address
  shipping_name TEXT NOT NULL,
  shipping_street1 TEXT NOT NULL,
  shipping_street2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT,
  shipping_postcode TEXT NOT NULL,
  shipping_country_code TEXT NOT NULL,
  shipping_phone TEXT NOT NULL,
  shipping_level TEXT NOT NULL DEFAULT 'GROUND'
    CHECK (shipping_level IN ('MAIL', 'PRIORITY_MAIL', 'GROUND', 'EXPEDITED', 'EXPRESS')),
  -- Tracking
  tracking_number TEXT,
  tracking_url TEXT,
  estimated_delivery_date DATE,
  lulu_webhook_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_printed_cookbook_orders_user_id ON printed_cookbook_orders(user_id);
CREATE INDEX idx_printed_cookbook_orders_status ON printed_cookbook_orders(status);

ALTER TABLE printed_cookbook_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own printed_cookbook_orders" ON printed_cookbook_orders
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- STORAGE BUCKET for cookbook PDFs
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cookbook-pdfs', 'cookbook-pdfs', true, 104857600, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for cookbook-pdfs bucket
CREATE POLICY "cookbook-pdfs: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'cookbook-pdfs');

CREATE POLICY "cookbook-pdfs: auth upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cookbook-pdfs'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "cookbook-pdfs: owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'cookbook-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
