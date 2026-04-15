# ChefsBook — Session 43: Fix recipe_user_photos Column Name Mismatch
# Source: DB schema check — column is `url` not `photo_url`
# Target: apps/mobile + apps/web + packages/db

---

## CONTEXT

The `recipe_user_photos` table has a column named `url`, NOT `photo_url`.
Every place in the codebase that references `photo_url` on this table is broken —
queries return nothing, images don't display, and the backfill SQL fails.

This is a single focused fix — find every reference to `photo_url` on
`recipe_user_photos` and change it to `url`.

Read .claude/agents/image-system.md before starting.

---

## STEP 1 — Find all references

Run this on the Windows PC from the repo root:
```powershell
grep -r "photo_url" apps/mobile/src apps/web packages --include="*.ts" --include="*.tsx" -n
grep -r "photo_url" apps/mobile/store apps/mobile/app --include="*.ts" --include="*.tsx" -n
```

Or from the Pi:
```bash
grep -r "photo_url" /mnt/chefsbook/repo/apps /mnt/chefsbook/repo/packages \
  --include="*.ts" --include="*.tsx" -n
```

List every file and line number that references `photo_url`.

---

## STEP 2 — Fix all references

For every file found, replace `photo_url` with `url` WHERE it refers to the
`recipe_user_photos` table. Be careful — `image_url` on the `recipes` table
is a different field and must NOT be changed.

Key files that almost certainly need fixing:
- `packages/db/src/recipes.ts` — `getPrimaryPhoto()`, `getPrimaryPhotos()`,
  `listRecipePhotos()`
- `apps/mobile/store/recipeStore.ts` — anywhere photos are read from DB
- `apps/mobile/components/HeroGallery.tsx` — renders `photo.url` not `photo.photo_url`
- `apps/mobile/components/EditImageGallery.tsx` — same
- `apps/web/lib/recipeImage.ts` — `proxyIfNeeded()` and image priority chain
- `apps/web/components/RecipeDetail` — wherever photos are mapped
- Any other component that maps over `recipe_user_photos` results

### Type definitions
Also update any TypeScript type/interface that defines `RecipePhoto` or similar:
```ts
// WRONG:
interface RecipePhoto {
  id: string;
  recipe_id: string;
  photo_url: string;  // ← change this
  is_primary: boolean;
}

// CORRECT:
interface RecipePhoto {
  id: string;
  recipe_id: string;
  url: string;  // ← actual column name
  is_primary: boolean;
  storage_path: string;
  sort_order: number;
  caption?: string;
}
```

---

## STEP 3 — Run the backfill on RPi5

After fixing the code, run this to backfill existing recipes:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c "
UPDATE recipes r
SET image_url = (
  SELECT p.url FROM recipe_user_photos p
  WHERE p.recipe_id = r.id
  AND p.is_primary = true
  ORDER BY p.created_at ASC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM recipe_user_photos p
  WHERE p.recipe_id = r.id
)
AND (r.image_url IS NULL OR r.image_url NOT LIKE '%storage/v1%');
"
```

Confirm it returns `UPDATE N` where N > 0.

---

## STEP 4 — Verify

After the fix, confirm:
1. `tsc --noEmit` passes in both apps
2. On web: recipe cards in dashboard show images without needing to edit/save the recipe
3. On web: search results show images
4. On mobile emulator: recipe cards show images

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

- [ ] All `photo_url` references to `recipe_user_photos` found via grep
- [ ] All references changed to `url`
- [ ] TypeScript type/interface updated to use `url` and include all actual columns
- [ ] `getPrimaryPhoto()` and `getPrimaryPhotos()` return correct data
- [ ] `tsc --noEmit` passes both apps
- [ ] Backfill SQL run on RPi5 — confirms UPDATE N rows
- [ ] Recipe cards on web show images without needing manual edit
- [ ] Recipe cards on mobile show images
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
