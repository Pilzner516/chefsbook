# ChefsBook — Session 124: Fix Like Notifications — Move to Server-Side API Route
# Source: Like notifications still not appearing despite session 123 fix
# Root cause hypothesis: toggleLike() runs client-side, supabaseAdmin unavailable in browser
# Target: apps/web + packages/db

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

Session 123 added createNotification(supabaseAdmin) inside toggleLike()
in packages/db. But packages/db is used by BOTH server and client code.
When toggleLike() runs client-side (in the browser), supabaseAdmin is
undefined because the service role key is never sent to the browser.

The fix: move the notification creation to a server-side API route that
is called immediately after a successful like.

---

## STEP 1 — Confirm the root cause

Check how toggleLike() is called in the web app:

1. Find the LikeButton component in apps/web
2. Is it a client component ('use client')?
3. Does it call toggleLike() directly from packages/db?
4. If yes — supabaseAdmin is undefined in this context

Also check packages/db/src/likes.ts (or equivalent):
- Does toggleLike() import supabaseAdmin?
- What happens when supabaseAdmin is undefined — does it throw or
  silently skip?

---

## STEP 2 — Create a server-side like API route

Create apps/web/app/api/recipe/[id]/like/route.ts:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@chefsbook/db'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const recipeId = params.id
  const userId = session.user.id

  // Toggle the like (insert or delete)
  const { data: existing } = await supabaseAdmin
    .from('recipe_likes')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('user_id', userId)
    .single()

  let liked: boolean

  if (existing) {
    // Unlike
    await supabaseAdmin
      .from('recipe_likes')
      .delete()
      .eq('recipe_id', recipeId)
      .eq('user_id', userId)
    liked = false
  } else {
    // Like
    await supabaseAdmin
      .from('recipe_likes')
      .insert({ recipe_id: recipeId, user_id: userId })
    liked = true

    // Create notification for recipe owner (server-side, supabaseAdmin available)
    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('user_id, title')
      .eq('id', recipeId)
      .single()

    if (recipe && recipe.user_id !== userId) {
      const { data: liker } = await supabaseAdmin
        .from('user_profiles')
        .select('username')
        .eq('id', userId)
        .single()

      await supabaseAdmin.from('notifications').insert({
        user_id: recipe.user_id,
        actor_id: userId,
        type: 'recipe_like',
        recipe_id: recipeId,
        message: `@${liker?.username ?? 'Someone'} liked your recipe "${recipe.title}"`
      })
    }
  }

  // Return updated like count
  const { data: updated } = await supabaseAdmin
    .from('recipes')
    .select('like_count')
    .eq('id', recipeId)
    .single()

  return NextResponse.json({ liked, like_count: updated?.like_count ?? 0 })
}
```

---

## STEP 3 — Update LikeButton to call API route

Find the LikeButton component in apps/web. Update it to:
- Call POST /api/recipe/[id]/like instead of toggleLike() directly
- Use fetch() with credentials: 'include'
- Update local state with the returned liked + like_count values
- Keep optimistic UI update (flip heart immediately, revert on error)

```typescript
const handleLike = async () => {
  // Optimistic update
  setIsLiked(prev => !prev)
  setLikeCount(prev => isLiked ? prev - 1 : prev + 1)

  const res = await fetch(`/api/recipe/${recipeId}/like`, {
    method: 'POST',
    credentials: 'include'
  })

  if (!res.ok) {
    // Revert on error
    setIsLiked(prev => !prev)
    setLikeCount(prev => isLiked ? prev + 1 : prev - 1)
    return
  }

  const data = await res.json()
  setIsLiked(data.liked)
  setLikeCount(data.like_count)
}
```

---

## STEP 4 — Remove createNotification from packages/db toggleLike

Remove the supabaseAdmin notification call from toggleLike() in
packages/db — it no longer belongs there since the API route handles it.
Keep toggleLike() as a simple insert/delete function.

This ensures packages/db stays safe for both client and server use.

---

## STEP 5 — Verify end-to-end

```sql
-- After liking a recipe, check notification exists
SELECT type, user_id, actor_id, message, created_at
FROM notifications
WHERE type = 'recipe_like'
ORDER BY created_at DESC LIMIT 3;
```

Also verify the like_count updates correctly on the recipe card.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Only restart PM2 if build exits with code 0.

---

## COMPLETION CHECKLIST

- [ ] Root cause confirmed: supabaseAdmin undefined client-side
- [ ] /api/recipe/[id]/like route created (server-side, supabaseAdmin available)
- [ ] LikeButton calls API route instead of toggleLike() directly
- [ ] Optimistic UI update preserved (instant heart flip)
- [ ] Notification created server-side after like insert
- [ ] No notification on unlike or self-like
- [ ] toggleLike() in packages/db cleaned up (no supabaseAdmin reference)
- [ ] Notification row confirmed in DB after test like
- [ ] like_count updates correctly
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
