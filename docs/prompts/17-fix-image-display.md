# ChefsBook — Session: Fix Image Not Displaying After Upload
# Source: Emulator screenshot — delete button visible but image not rendering
# Target: apps/mobile

---

## CONTEXT

From the screenshot, after selecting an image the × delete button appears (proving a DB
record was created) but the image itself does not render — just the empty dashed placeholder.
The `+` add button is also visible. This means the record exists in `recipe_user_photos`
but either the file is not in storage or the URL is wrong.

Work through these checks in order. Do not skip any step.

---

## STEP 1 — Check what URL was actually saved

Query the DB on RPi5:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT id, recipe_id, photo_url, created_at
   FROM recipe_user_photos
   ORDER BY created_at DESC
   LIMIT 5;"
```

Also check if the file actually exists in storage:
```bash
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT name, bucket_id, created_at
   FROM storage.objects
   WHERE bucket_id = 'recipe-user-photos'
   ORDER BY created_at DESC
   LIMIT 10;"
```

Log both results in DONE.md. This will immediately reveal whether:
- The file made it to storage or not
- The `photo_url` in `recipe_user_photos` matches an actual storage object

---

## STEP 2 — Fix the URL if it is malformed

Common issues with self-hosted Supabase storage public URLs:

**Issue A:** URL contains `rpi5-eth` hostname instead of the Tailscale IP. The emulator
cannot resolve `rpi5-eth`. The URL must use `100.110.47.62`.

**Issue B:** URL format is wrong. For self-hosted Supabase the public URL format is:
```
http://100.110.47.62:8000/storage/v1/object/public/recipe-user-photos/[filename]
```
Not the cloud format (`https://[project].supabase.co/storage/v1/...`).

**Issue C:** The `getPublicUrl()` call returns the URL based on `SUPABASE_URL` — if
`SUPABASE_URL` in the mobile env is set to a hostname the emulator can't reach, the
returned URL will be unreachable.

Fix: after `FileSystem.uploadAsync` succeeds, construct the public URL manually rather
than relying on `supabase.storage.getPublicUrl()`:

```ts
const STORAGE_BASE = 'http://100.110.47.62:8000/storage/v1/object/public';
const publicUrl = `${STORAGE_BASE}/recipe-user-photos/${fileName}`;
```

Store this as the `photo_url` in `recipe_user_photos`.

---

## STEP 3 — Fix the image component to load from the correct URL

In the `EditImageGallery` component (and anywhere else recipe photos are displayed),
the image is rendered from `photo_url`. Check:

1. Is `photo_url` being passed to `<Image source={{ uri: photo_url }} />`?
2. Add a temporary `onError` handler to log any load failure:
```tsx
<Image
  source={{ uri: photo.photo_url }}
  onError={(e) => console.error('Image load error:', e.nativeEvent.error, photo.photo_url)}
  onLoad={() => console.log('Image loaded:', photo.photo_url)}
  style={styles.thumbnail}
/>
```
Check Metro logs for the error message — it will say exactly why the image failed to load.

3. If the URL requires auth (i.e. the bucket is not fully public), add the auth header:
```tsx
<Image
  source={{
    uri: photo.photo_url,
    headers: { Authorization: `Bearer ${session?.access_token}` }
  }}
  style={styles.thumbnail}
/>
```
Though this should not be needed if the bucket is public.

---

## STEP 4 — Verify the complete flow end-to-end

After fixes:
1. Select an image from library in edit mode
2. Confirm the red "Uploading..." pill appears
3. Confirm it resolves (pill disappears, image thumbnail appears)
4. Re-query storage.objects on RPi5 — file should be there
5. Re-query recipe_user_photos — photo_url should be a reachable URL
6. Close and reopen the recipe — image should still appear (not just in-session state)

---

## COMPLETION CHECKLIST

- [ ] DB query run — photo_url and storage.objects both checked and logged
- [ ] File confirmed present in storage.objects after upload
- [ ] photo_url uses Tailscale IP (100.110.47.62) not hostname
- [ ] Public URL constructed manually if getPublicUrl() returns wrong hostname
- [ ] Image component has onError logging to catch load failures
- [ ] Image renders correctly in edit mode after selection
- [ ] Image persists after closing and reopening recipe detail
- [ ] Same fix applied to recipe detail read-only gallery view
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
