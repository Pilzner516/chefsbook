-- Recipe user photos
CREATE TABLE recipe_user_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id    uuid REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  storage_path text NOT NULL,
  url          text NOT NULL,
  caption      text,
  is_primary   boolean DEFAULT false,
  sort_order   int DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX recipe_user_photos_recipe ON recipe_user_photos (recipe_id, sort_order);
ALTER TABLE recipe_user_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own" ON recipe_user_photos FOR ALL USING (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('recipe-user-photos', 'recipe-user-photos', true, 10485760);

-- Storage policies
CREATE POLICY "user_photos_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'recipe-user-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "user_photos_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'recipe-user-photos');
CREATE POLICY "user_photos_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'recipe-user-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
