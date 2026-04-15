# ChefsBook — Session 74: Restore Comments Section on Recipe Detail
# Source: QA 2026-04-11 — comments disappeared after recent refactors
# Target: apps/web

---

## CONTEXT

The comments section has disappeared from the web recipe detail page.
It was working previously (session 59 confirmed it). A recent recipe detail
refactor (sessions 70, 76, or 79) likely removed or broke the wiring.

Read .claude/agents/testing.md and .claude/agents/deployment.md before starting.

---

## STEP 1 — Find the root cause

Check if RecipeComments is still mounted in the recipe detail page:

```bash
grep -n "RecipeComments" apps/web/app/recipe/\[id\]/page.tsx
grep -rn "RecipeComments" apps/web --include="*.tsx" -l
```

If `RecipeComments` is imported but not used in the page — wire it back in.
If `RecipeComments` is not imported at all — it was accidentally removed.

Also check if the recipe_comments table is accessible:

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c "\d recipe_comments"
```

If PostgREST cache is stale:
```bash
docker compose restart supabase-rest
```

---

## STEP 2 — Restore comments section

The `RecipeComments` component must be mounted in the recipe detail page:

```tsx
// In apps/web/app/recipe/[id]/page.tsx or the client component:
import { RecipeComments } from '@/components/RecipeComments';

// In the JSX, below the recipe notes section:
{recipe.visibility === 'public' && (
  <RecipeComments
    recipeId={recipe.id}
    recipeOwnerId={recipe.user_id}
    commentsEnabled={recipe.comments_enabled ?? true}
  />
)}
```

Comments only show on public recipes. Private and shared_link recipes
do not show the comments section.

---

## STEP 3 — Verify

Open a public recipe on chefsbk.app.
Scroll to the bottom — comments section must be visible (even if empty).
Post a test comment — it must appear in the list.

Confirm in DB:
```bash
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT id, content, status FROM recipe_comments ORDER BY created_at DESC LIMIT 3;"
```

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] Root cause identified — documented in DONE.md
- [ ] RecipeComments imported and mounted in recipe detail page
- [ ] Comments section visible on public recipe (even if empty)
- [ ] Test comment posts successfully
- [ ] Comment confirmed in DB via psql
- [ ] Deployed to RPi5 and verified live on chefsbk.app
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
