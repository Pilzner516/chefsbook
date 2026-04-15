# ChefsBook — Session 34: Web Recipe Images + Chef's Hat Fallback
# Source: Post-queue tracker items A + B
# Target: apps/web
# Cross-platform: Web only (mobile already fixed in sessions 17-18)

---

## CROSS-PLATFORM REQUIREMENT — READ FIRST

This session fixes the web platform to match the image system already working on mobile.
Read .claude/agents/image-system.md before starting — it contains the full image
architecture including required apikey headers and correct URL construction.

---

## CONTEXT

Images added via mobile (Pexels, camera, gallery) are stored in `recipe_user_photos`
table and Supabase Storage. The web app is not querying this table for recipe display —
it only checks `recipe.image_url` (the original import field). This means:

1. User-uploaded images never show on web recipe cards or detail pages
2. No chef's hat fallback when image_url is also empty

Both are the same root cause — the web never adopted the `recipe_user_photos` system
built in mobile sessions 17-18.

---

## FIX 1 — Add getPrimaryPhoto query to @chefsbook/db (web-side)

The mobile app already has `getPrimaryPhoto(recipeId)` and `getPrimaryPhotos(recipeIds[])`
batch query. Confirm these exist in `packages/db` and are usable from the web. If not,
add them:

```ts
// Get primary photo for a single recipe
export async function getPrimaryPhoto(recipeId: string) {
  const { data } = await supabase
    .from('recipe_user_photos')
    .select('photo_url, is_primary')
    .eq('recipe_id', recipeId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  return data;
}

// Batch: get primary photos for multiple recipes at once
export async function getPrimaryPhotos(recipeIds: string[]) {
  const { data } = await supabase
    .from('recipe_user_photos')
    .select('recipe_id, photo_url, is_primary')
    .in('recipe_id', recipeIds)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  // Return map of recipeId → primary photo_url
  const map: Record<string, string> = {};
  data?.forEach(photo => {
    if (!map[photo.recipe_id]) {
      map[photo.recipe_id] = photo.photo_url;
    }
  });
  return map;
}
```

---

## FIX 2 — Recipe image priority order (web)

Every place a recipe image is displayed on web must use this priority:

```
1. Primary photo from recipe_user_photos (user-uploaded via mobile or web)
2. recipe.image_url (original import URL — may be external)
3. Chef's hat logo (/images/chefs-hat.png or equivalent asset)
```

Create a shared web utility:

```ts
// apps/web/lib/recipeImage.ts
export function getRecipeImageUrl(
  primaryPhotoUrl: string | null | undefined,
  imageUrl: string | null | undefined
): string | null {
  return primaryPhotoUrl ?? imageUrl ?? null;
}
```

---

## FIX 3 — Recipe cards in dashboard (grid + list + table views)

The recipe list page fetches recipes — update it to also batch-fetch primary photos:

```ts
// After fetching recipes:
const recipeIds = recipes.map(r => r.id);
const primaryPhotos = await getPrimaryPhotos(recipeIds);

// Merge into recipe objects:
const recipesWithPhotos = recipes.map(r => ({
  ...r,
  primary_photo_url: primaryPhotos[r.id] ?? null
}));
```

In the recipe card component, update image source:
```tsx
const imageUrl = getRecipeImageUrl(recipe.primary_photo_url, recipe.image_url);

{imageUrl ? (
  <img
    src={imageUrl}
    alt={recipe.title}
    // If URL is a Supabase storage URL, it needs the apikey header.
    // Since Next.js <img> doesn't support custom headers, use next/image
    // with a custom loader for Supabase URLs:
  />
) : (
  <img src="/images/chefs-hat.png" alt="ChefsBook" className={styles.placeholder} />
)}
```

### Supabase storage URLs on web (important)

Unlike mobile where we can pass headers to `<Image>`, Next.js `<img>` and `next/image`
don't support custom request headers. Solutions in order of preference:

**Option A — Make the bucket truly public (no auth required)**
In Supabase dashboard or via SQL, confirm the `recipe-user-photos` bucket policy
allows public reads without the apikey header. If the Cloudflare Tunnel passes through
the Kong gateway, the apikey may still be required.

Test: open a `recipe_user_photos` URL directly in the browser. If it loads without
headers → Option A works, no code change needed for display.

**Option B — Next.js image proxy route**
Create `apps/web/app/api/image/route.ts` that proxies Supabase storage requests
with the apikey header:
```ts
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url');
  const response = await fetch(url, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY }
  });
  return new Response(response.body, {
    headers: { 'Content-Type': response.headers.get('Content-Type') }
  });
}
// Usage: <img src={`/api/image?url=${encodeURIComponent(photo_url)}`} />
```

Try Option A first — test a URL in the browser. If it fails with 401, implement
Option B.

---

## FIX 4 — Recipe detail hero (web)

The web recipe detail page shows a hero image. Update it to:

1. Fetch all photos for this recipe from `recipe_user_photos`
2. If photos exist → show the primary photo as hero, with a horizontal scroll
   gallery below for additional photos (up to 4, same as mobile)
3. If no photos → show chef's hat placeholder centered in the hero zone

The hero gallery on web doesn't need to be a swipeable pager (desktop users can
scroll) — a simple horizontal flex row with the primary image larger is fine.

---

## FIX 5 — Discover page recipe cards

Same batch-fetch pattern as Fix 3. Public recipes in the Discover feed must also
show user-uploaded photos.

---

## FIX 6 — Chef's hat asset

Confirm the chef's hat PNG used on the mobile landing screen is available as a
web-accessible static asset. It should be at `apps/web/public/images/chefs-hat.png`
or equivalent. If not, copy it from `apps/mobile/assets/`.

Use consistent sizing: 80×80px centered in the image placeholder zone with
`object-fit: contain` and the cream background (`#faf7f0`).

---

## COMPLETION CHECKLIST

- [ ] `getPrimaryPhotos()` batch query confirmed in packages/db
- [ ] `getRecipeImageUrl()` utility created in apps/web/lib
- [ ] Dashboard recipe cards show user-uploaded photos
- [ ] Dashboard recipe cards show chef's hat when no image available
- [ ] Supabase storage URL display tested (Option A or B implemented)
- [ ] Recipe detail hero updated to use recipe_user_photos
- [ ] Recipe detail shows photo gallery for multiple images
- [ ] Discover page cards show user-uploaded photos
- [ ] Chef's hat asset available at correct web path
- [ ] No broken image icons anywhere — always chef's hat as final fallback
- [ ] TypeScript: tsc --noEmit passes
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
