-- Migration 075: Menu cover images
-- Adds cover_image_url column to menus and creates menu-covers storage bucket

-- Add cover_image_url column to menus
ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Create menu-covers storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-covers',
  'menu-covers',
  true,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: users can upload to their own menu folders
CREATE POLICY "Users can upload menu covers"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'menu-covers'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM menus WHERE user_id = auth.uid()
  )
);

-- Storage policy: users can update/delete their own menu covers
CREATE POLICY "Users can manage their menu covers"
ON storage.objects FOR ALL
USING (
  bucket_id = 'menu-covers'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM menus WHERE user_id = auth.uid()
  )
);

-- Storage policy: public read for menu covers
CREATE POLICY "Menu covers are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'menu-covers');
