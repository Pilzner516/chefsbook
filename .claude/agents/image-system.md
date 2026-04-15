# image-system — ChefsBook Image Agent
# Read this file at the start of every session that touches images, uploads, or storage.

## YOUR ROLE
You own everything related to images in ChefsBook mobile. Your job is to ensure images
upload correctly, display correctly, and stay in sync across recipe cards, detail screens,
and edit mode.

---

## UPLOAD ARCHITECTURE

### The only correct upload method on mobile:
```ts
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

const SUPABASE_URL = 'http://100.110.47.62:8000';  // Tailscale IP — NEVER use rpi5-eth hostname
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey;

async function uploadPhoto(localUri: string, recipeId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const fileName = `${recipeId}/${Date.now()}.jpg`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/recipe-user-photos/${fileName}`;

  const response = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  if (response.status !== 200) throw new Error(`Upload failed: ${response.status}`);

  return `${SUPABASE_URL}/storage/v1/object/public/recipe-user-photos/${fileName}`;
}
```

Never use `supabase.storage.upload()` on mobile — it fails on Hermes due to encoding issues.
Never use `decode(base64)` → Uint8Array — same issue.
Never construct URLs using `supabase.storage.getPublicUrl()` — returns wrong hostname.
Always use the Tailscale IP `100.110.47.62` directly in URLs.

### RPi5 one-time setup (already done — do not redo):
`ALTER ROLE supabase_storage_admin SUPERUSER;`
This was required due to supautils blocking set_config() calls. Do not remove.

---

## DISPLAY ARCHITECTURE

### Every Image component showing a Supabase storage URL MUST have the apikey header:
```tsx
<Image
  source={{
    uri: photo.photo_url,
    headers: { apikey: SUPABASE_ANON_KEY }
  }}
  style={styles.image}
/>
```
Without this header, Kong gateway returns 401 even on public buckets.

### Chef's hat fallback rule:
Chef's hat shows ONLY when recipe has zero images. Never alongside real images.
```tsx
// CORRECT:
const photos = await listRecipePhotos(recipeId); // from recipe_user_photos
if (photos.length === 0) → show chef's hat
if (photos.length >= 1) → show HeroGallery with photos

// WRONG:
if (!recipe.image_url) → show chef's hat  // this ignores recipe_user_photos entirely
```

### HeroGallery — always check recipe_user_photos, not recipe.image_url
recipe.image_url is the original import URL — it may or may not be in storage.
recipe_user_photos is the source of truth for displayed images.
Primary photo = first result from: ORDER BY is_primary DESC, created_at ASC LIMIT 4.

---

## PEXELS INTEGRATION

### API key — must use expo-constants, not process.env:
```ts
import Constants from 'expo-constants';
const PEXELS_KEY = Constants.expoConfig?.extra?.pexelsApiKey;
// In app.json: { "expo": { "extra": { "pexelsApiKey": "..." } } }
```

### Always pre-fetch in parallel with import:
```ts
const [importResult, pexelsPhotos] = await Promise.all([
  importRecipeFromUrl(url),
  searchPexels(titleGuess)
]);
```

### Search returns 3 photos using photos[].src.large2x for upload, .src.medium for thumbnail.

---

## PRE-FLIGHT CHECKLIST
```
□ Does this session upload images?
  → FileSystem.uploadAsync with Authorization + apikey headers
  → URL uses 100.110.47.62 (Tailscale IP), never rpi5-eth
□ Does this session display images from Supabase storage?
  → <Image source={{ uri, headers: { apikey } }} />
□ Does this session affect recipe_user_photos?
  → recipe card, recipe detail hero, edit gallery all refreshed after change
□ Does this session use Pexels?
  → API key from expo-constants
  → Pre-fetched in parallel, not sequentially
□ Does this session show a chef's hat placeholder?
  → Only when recipe_user_photos returns zero rows for this recipe
```

## POST-FLIGHT CHECKLIST
```
□ Upload an image → red "Uploading..." pill shows → resolves → image appears in hero
□ File exists in storage.objects on RPi5 after upload
□ Recipe card shows uploaded image without app restart
□ Chef's hat shows ONLY for recipes with zero photos in recipe_user_photos
□ All Image components for Supabase URLs have apikey header
□ Pexels returns 3 results for "chocolate cake" (common test query)
□ Image persists after closing and reopening recipe detail
```

---

## KNOWN PROBLEM PATTERNS — DO NOT REPEAT

| Pattern | What happened | Correct approach |
|---------|--------------|-----------------|
| Upload hangs indefinitely | URL used rpi5-eth hostname, emulator can't resolve | Always use 100.110.47.62 |
| 401 on image display | Missing apikey header on Image component | Always add apikey header |
| Chef's hat + real image both showing | Hero checked recipe.image_url not recipe_user_photos | Always check recipe_user_photos |
| Pexels returns empty | API key loaded from process.env (not available in Expo) | Use expo-constants |
| Recipe card stale after image edit | Store not invalidated after upload | Refresh primary photo in store immediately after upload |
| supabase.storage.upload() RLS error | JS client encoding fails on Hermes | Always use FileSystem.uploadAsync |

---

## ADDITIONAL FAILURE PATTERNS — DO NOT REPEAT

| Pattern | What happened | Correct approach |
|---------|--------------|-----------------|
| Wrong column name on recipe_user_photos | Entire image system used `photo_url` — actual column is `url` | ALWAYS run `\d recipe_user_photos` before writing any query. Column is `url` not `photo_url` |
| Proxy not applied to all image locations | 12 files needed fixing after initial proxy implementation | After adding proxy to one component, grep ALL tsx files for `image_url\|avatar_url\|photo_url` and apply proxy everywhere |
| Chef's hat shown alongside real images | Hero checked `recipe.image_url` not `recipe_user_photos` | ALWAYS check `recipe_user_photos` first. `recipe.image_url` is only the fallback |
