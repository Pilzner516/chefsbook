# ChefsBook — Session 39: Web Image Rendering Sweep
# Source: QA review 2026-04-10
# Target: apps/web

---

## CROSS-PLATFORM REQUIREMENT
This session is web-only. Read .claude/agents/image-system.md before starting.
This is the most important agent for this session — follow it exactly.

---

## CONTEXT

Session 34 built the `/api/image` proxy route and applied it to the dashboard recipe
cards and recipe detail hero. However several other image display locations were missed.
Every `<img>` or `<Image>` tag that displays a Supabase storage URL must go through
the proxy at `/api/image?url=[encoded_url]`.

The proxy route adds the required `apikey` header that Kong gateway requires.
Without it, all Supabase storage images return 401 and show as broken.

---

## PROXY HELPER (already exists — verify and reuse)

In `apps/web/lib/recipeImage.ts`, there should be a `proxyIfNeeded()` function.
Confirm it exists and works correctly:

```ts
export function proxyIfNeeded(url: string | null | undefined): string | null {
  if (!url) return null;
  // Only proxy Supabase storage URLs
  if (url.includes('storage/v1/object')) {
    return `/api/image?url=${encodeURIComponent(url)}`;
  }
  return url; // External URLs (Pexels etc.) don't need proxying
}
```

If this function doesn't exist, create it. Use it everywhere below.

---

## FIX 1 — Search page recipe cards

The search/dashboard page shows recipe cards with a broken image icon instead of
the recipe photo.

Find the search results recipe card component. Update image source:
```tsx
<img
  src={proxyIfNeeded(recipe.primary_photo_url ?? recipe.image_url) ?? '/images/chefs-hat.png'}
  alt={recipe.title}
/>
```

Also ensure `primary_photo_url` is being batch-fetched for search results the same
way as dashboard cards (using `getPrimaryPhotos(recipeIds)`).

---

## FIX 2 — Meal plan day cards

Meal plan cards show a broken image placeholder instead of the recipe photo.

Find the meal plan day card component. The card shows the recipe image alongside
the recipe name. Update:
```tsx
<img
  src={proxyIfNeeded(meal.recipe?.primary_photo_url ?? meal.recipe?.image_url) ?? '/images/chefs-hat.png'}
  alt={meal.recipe?.title}
/>
```

Ensure recipe data joined to meal_plans includes `primary_photo_url`.
If not, add it to the meal plan query.

---

## FIX 3 — Add recipe modal (meal plan)

The recipe picker modal shown when adding a recipe to a meal plan day shows
broken images for recipes in the list.

Find the add recipe modal/picker component. Each recipe row shows a small
thumbnail — apply the same proxy pattern:
```tsx
<img
  src={proxyIfNeeded(recipe.primary_photo_url ?? recipe.image_url) ?? '/images/chefs-hat.png'}
  alt={recipe.title}
  style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }}
/>
```

---

## FIX 4 — Avatar images in profile and recipe attribution

Avatars stored in Supabase Storage show as broken images. This includes:
- User settings page (own avatar)
- Recipe attribution tags (@original_submitter avatar if shown)
- Followers/Following lists
- Comment author avatars
- Like viewer list

Apply proxy to all avatar URLs:
```tsx
// In a shared Avatar component or wherever avatars render:
<img
  src={proxyIfNeeded(user.avatar_url) ?? '/images/default-avatar.png'}
  alt={user.username}
/>
```

Create a simple default avatar fallback at `apps/web/public/images/default-avatar.png`
— a grey circle with a person silhouette, or use CSS initials instead:

```tsx
// InitialsAvatar component for when no avatar_url exists:
function InitialsAvatar({ username, size = 40 }: { username: string; size?: number }) {
  const initials = username.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#ce2b37', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 600
    }}>
      {initials}
    </div>
  );
}
```

Use `InitialsAvatar` when `avatar_url` is null, proxy when it exists.

---

## FIX 5 — Recipe detail "Your Photos" thumbnail

The small thumbnail shown in "Your Photos 1/10" below the hero image is broken.

Find where the photo thumbnails render in the web recipe detail. Apply proxy:
```tsx
<img
  src={proxyIfNeeded(photo.photo_url)}
  alt="Recipe photo"
/>
```

---

## GLOBAL AUDIT

After fixing the above, do a scan of ALL `<img>` tags in `apps/web` that could
display Supabase storage URLs. Search for:
```bash
grep -r "photo_url\|image_url\|avatar_url" apps/web/components apps/web/app \
  --include="*.tsx" -l
```

For each file found, verify the URL goes through `proxyIfNeeded()`. Fix any missed.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] `proxyIfNeeded()` utility confirmed/created in apps/web/lib/recipeImage.ts
- [ ] Search page recipe cards show images correctly
- [ ] Meal plan day cards show recipe images correctly
- [ ] Add recipe modal in meal plan shows recipe thumbnails correctly
- [ ] Avatar images proxied and showing (settings, comments, attribution, followers)
- [ ] `InitialsAvatar` component used when avatar_url is null
- [ ] "Your Photos" thumbnails in recipe detail show correctly
- [ ] Global audit completed — no unproxied Supabase storage URLs remaining
- [ ] Chef's hat fallback on all recipe images when no photo available
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
