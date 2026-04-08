# ChefsBook — Session: Fix Supabase Storage Uploads on Mobile
# Source: Pexels upload investigation
# Target: apps/mobile + @chefsbook/db + RPi5 Supabase

---

## CONTEXT

Storage uploads from mobile have never worked. The error "row-level security policy" is
misleading — RLS has been fully disabled on both `storage.objects` and `recipe_user_photos`
and the error persists. This means the rejection is happening in the Supabase Storage API
middleware BEFORE it reaches Postgres, not in our RLS policies.

Three likely root causes, investigate in this exact order and fix whichever one is the problem.
Do not skip ahead — confirm each step before moving to the next.

---

## STEP 1 — Check Storage container logs on RPi5

SSH into the Pi and read the actual rejection reason from the Storage API:

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose logs supabase-storage --tail=100 2>&1 | grep -i "error\|auth\|jwt\|deny\|forbidden\|401\|403"
```

Also try:
```bash
docker compose logs --tail=100 2>&1 | grep -i "storage"
```

Read the output carefully. The Storage container logs will show the actual HTTP request and
why it was rejected. Paste the relevant lines into DONE.md for the record.

---

## STEP 2 — Verify the mobile client sends auth JWT with storage requests

This is the most likely root cause. The Supabase Storage client must have an active user
session (JWT) attached — the anon key alone is not sufficient for storage uploads.

In the upload function (`uploadPhoto` or wherever `supabase.storage.upload()` is called),
add this check BEFORE the upload:

```ts
const { data: { session }, error: sessionError } = await supabase.auth.getSession();
console.log('Session before upload:', {
  hasSession: !!session,
  hasAccessToken: !!session?.access_token,
  userId: session?.user?.id,
  sessionError
});

if (!session?.access_token) {
  throw new Error('No active session — cannot upload to storage');
}
```

If `hasSession` is false or `hasAccessToken` is false when this runs, the Supabase client
is not authenticated at upload time. This means either:
- The session hasn't been restored yet from SecureStore (race condition on app launch)
- The auth storage adapter isn't correctly wired in the Supabase client constructor

**Fix for missing session:** In `@chefsbook/db`, find the Supabase client construction.
Confirm it looks like this (with SecureStore as the storage adapter):

```ts
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

If `auth.storage` is missing or using `AsyncStorage` instead of `SecureStore`, fix it.
The session won't persist correctly without the right adapter.

---

## STEP 3 — Fix the upload encoding format

Even with a valid session, the `decode(base64) → Uint8Array` approach is known to fail on
React Native / Hermes. The Supabase JS storage client on React Native expects either a
`Blob` or a `FormData` object — not a raw `Uint8Array`.

Replace the current base64 → decode → upload approach with a direct file URI upload using
`FormData`:

```ts
import * as FileSystem from 'expo-file-system';

async function uploadPhoto(localUri: string, recipeId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const fileName = `${recipeId}/${Date.now()}.jpg`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/recipe-images/${fileName}`;

  // Use expo-file-system uploadAsync — bypasses the JS client encoding issues entirely
  const response = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  if (response.status !== 200) {
    console.error('Upload failed:', response.status, response.body);
    throw new Error(`Upload failed: ${response.status}`);
  }

  // Return the public URL
  const { data } = supabase.storage
    .from('recipe-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
}
```

This approach:
- Manually attaches the JWT from the active session in the `Authorization` header
- Uses `expo-file-system`'s native upload (not JS base64 encoding)
- Bypasses the Supabase JS client's storage upload entirely, which is where the
  encoding issue occurs on Hermes

**For Pexels images specifically** — the flow becomes:
1. Download Pexels image to a temp local file via `expo-file-system` (already working)
2. Pass the local file URI to `uploadPhoto()` above
3. No base64 conversion needed at any point

---

## STEP 4 — Verify the storage bucket exists and is public

On RPi5, confirm the `recipe-images` bucket exists and has the correct settings:

```bash
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT id, name, public FROM storage.buckets;"
```

Expected output should include a row with `name = 'recipe-images'` and `public = true`.

If the bucket doesn't exist or is private, create/update it:
```bash
docker compose exec db psql -U postgres -d postgres -c \
  "INSERT INTO storage.buckets (id, name, public)
   VALUES ('recipe-images', 'recipe-images', true)
   ON CONFLICT (id) DO UPDATE SET public = true;"
```

Also confirm the bucket name in the upload code matches exactly — `recipe-images` vs
`recipe_images` vs `recipe-user-photos` — a mismatch silently fails.

---

## STEP 5 — End-to-end test

After applying fixes, test the complete upload flow:

1. Sign in to the app (confirm session exists via the console.log in Step 2)
2. Open any recipe in edit mode
3. Tap the `+` / dashed placeholder
4. Select "Take photo" or "Choose from library" — upload a test image
5. Confirm it appears in the recipe's photo gallery
6. SSH to RPi5 and verify a file exists in storage:
   ```bash
   docker compose exec db psql -U postgres -d postgres -c \
     "SELECT name, created_at FROM storage.objects WHERE bucket_id = 'recipe-images' LIMIT 10;"
   ```
7. Test Pexels: tap "Find a photo", select an image, confirm it uploads and appears

---

## COMPLETION CHECKLIST

- [ ] Storage container logs reviewed — actual rejection reason documented in DONE.md
- [ ] Session JWT confirmed present before upload (console.log check)
- [ ] Supabase client uses SecureStore adapter with `persistSession: true`
- [ ] Upload rewritten to use `FileSystem.uploadAsync` with manual JWT header
- [ ] Base64 / Uint8Array encoding removed from upload path
- [ ] `recipe-images` bucket confirmed to exist and be public on RPi5
- [ ] Bucket name consistent across all code references
- [ ] Camera/library upload works end-to-end (file appears in storage.objects)
- [ ] Pexels upload works end-to-end (file appears in storage.objects)
- [ ] Debug `console.log` and `console.warn` statements removed after fix confirmed
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
