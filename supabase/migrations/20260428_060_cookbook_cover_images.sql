-- Migration 060: Add cover image support to printed cookbooks
-- Adds cover_image_url column for custom cover photos
-- Adds selected_image_urls JSONB for per-recipe image selection
-- Creates cookbook-covers storage bucket

-- Add columns to printed_cookbooks
ALTER TABLE printed_cookbooks
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS selected_image_urls JSONB DEFAULT '{}';

-- Create storage bucket for cookbook covers
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cookbook-covers', 'cookbook-covers', true, 10485760) -- 10MB limit
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Users can upload to their own folder
CREATE POLICY "Users upload own covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cookbook-covers'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS policy: Public read for cookbook covers
CREATE POLICY "Public read cookbook covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'cookbook-covers');
