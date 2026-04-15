# ChefsBook — Session 123: Fix Like Notifications
# Source: Likes tab in notification panel shows nothing when another user likes a recipe
# Target: packages/db + apps/web + apps/mobile

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

When User B likes User A's recipe, User A should receive a notification
in the Likes tab of the notification bell panel. This is not happening.

---

## STEP 1 — Diagnose

SSH to RPi5:

```sql
-- Check if any recipe_like notifications exist
SELECT * FROM notifications
WHERE type = 'recipe_like'
ORDER BY created_at DESC LIMIT 10;

-- Check recent likes
SELECT rl.recipe_id, rl.user_id, r.user_id as owner_id, r.title
FROM recipe_likes rl
JOIN recipes r ON r.id = rl.recipe_id
ORDER BY rl.created_at DESC LIMIT 5;
```

---

## STEP 2 — Find toggleLike() in packages/db

Read the toggleLike() function. Check:
1. Does it call createNotification() after a successful like INSERT?
2. If yes — does createNotification() use supabaseAdmin?
   (session 120 found that notifications require supabaseAdmin due to
   RLS — the same fix must apply here)
3. If no createNotification() call exists — add it

The notification should only fire on LIKE (insert), not on UNLIKE (delete).
The notification recipient is the recipe owner (not the liker).
Do not notify if the user likes their own recipe.

---

## STEP 3 — Fix

Apply the same pattern used for comment notifications (session 120):

```typescript
// After successful like INSERT
if (recipeOwnerId !== userId) {
  await createNotification(supabaseAdmin, {
    user_id: recipeOwnerId,        // who receives it
    actor_id: userId,              // who liked
    type: 'recipe_like',
    recipe_id: recipeId,
    message: `@${username} liked your recipe`
  })
}
```

Use supabaseAdmin for the createNotification call — anon client will
be blocked by RLS.

---

## STEP 4 — Verify

After fixing, test on RPi5:
```sql
-- Toggle a like and check notification appears
SELECT * FROM notifications WHERE type = 'recipe_like'
ORDER BY created_at DESC LIMIT 3;
```

Confirm the notification row exists with correct user_id (owner)
and actor_id (liker).

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

- [ ] Diagnosed: confirmed no recipe_like notifications in DB
- [ ] toggleLike() now calls createNotification() via supabaseAdmin on like
- [ ] No notification created when user likes their own recipe
- [ ] No notification created on unlike
- [ ] Test like confirmed: notification row in DB with correct user_id + actor_id
- [ ] Likes tab in notification panel shows the notification
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
