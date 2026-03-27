-- ============================================================
-- Storage buckets for recipe images and avatars
-- ============================================================

-- recipe-images bucket: public read, authenticated write, 5MB limit
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- avatars bucket: public read, authenticated write, 2MB limit
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- Storage RLS policies
-- ============================================================

-- recipe-images: anyone can read, authenticated users write to own folder
create policy "recipe-images: public read"
  on storage.objects for select
  using (bucket_id = 'recipe-images');

create policy "recipe-images: auth insert"
  on storage.objects for insert
  with check (
    bucket_id = 'recipe-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "recipe-images: own update"
  on storage.objects for update
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "recipe-images: own delete"
  on storage.objects for delete
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- avatars: anyone can read, authenticated users write to own folder
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: auth insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: own update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: own delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
