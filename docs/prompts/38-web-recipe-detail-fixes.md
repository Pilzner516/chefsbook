# ChefsBook — Session 38: Web Recipe Detail Fixes
# Source: QA review 2026-04-10
# Target: apps/web

---

## CROSS-PLATFORM REQUIREMENT
This session is web-only. Mobile recipe detail is not touched.

Read .claude/agents/ui-guardian.md and .claude/agents/image-system.md before starting.

---

## FIX 1 — Comments section not showing

### Investigation
Open `apps/web/app/recipe/[id]/page.tsx` (or wherever the web recipe detail renders).
Check if `<RecipeComments>` component is imported and mounted.

It is almost certainly missing — the component was built in session 34 but never
added to the page. Wire it in:

```tsx
import { RecipeComments } from '@/components/RecipeComments';

// In the recipe detail JSX, below the recipe notes section:
{recipe.visibility === 'public' && (
  <RecipeComments
    recipeId={recipe.id}
    recipeOwnerId={recipe.user_id}
    commentsEnabled={recipe.comments_enabled ?? true}
  />
)}
```

Comments only show on public recipes. If the recipe is private or shared_link,
the comments section is hidden entirely.

Verify the `RecipeComments` component exists in `apps/web/components/`. If it does
not exist (only exists on mobile), port it from the mobile implementation — same
logic, adapted for React/Next.js instead of React Native.

---

## FIX 2 — Likes count position

### Current behaviour
Like count (♡ 0) appears at the bottom of the recipe near the PDF link.

### Target behaviour
Move the like button and count to the top of the recipe detail, to the right of
the recipe title on the same line or directly below it:

```
Fried Indonesian Noodles          ♡ 12
Indonesian · main · 45min
```

Or as a row below the title:
```
Fried Indonesian Noodles
Indonesian · main · 45min
[♡ 12 Likes]  [Public]
```

Keep it visually prominent but not dominant. Remove it from the bottom of the page.

Also verify: recipe owner can tap the like count to see who liked (likers sheet/modal).

---

## FIX 3 — PDF button: remove from bottom, add to Share menu

### Current behaviour
A "PDF" link/button appears at the bottom of the recipe detail for all users,
and clicking it returns `{"error":"Unauthorized"}` for non-Pro users.

### Fix
1. Remove the PDF button/link from the bottom of the recipe detail entirely.
2. Add PDF as an option inside the Share action — the Share button already exists
   in the recipe header actions. When clicked, show a dropdown or modal:
   ```
   ┌─────────────────────────────┐
   │  Share this recipe          │
   │                             │
   │  🔗 Copy link               │
   │  📄 Download PDF  [Pro]     │
   └─────────────────────────────┘
   ```
3. The PDF option is only shown to Pro users. Non-Pro users see it greyed out
   with a "Pro plan" badge — clicking shows the upgrade prompt.
4. Pro users clicking "Download PDF" triggers a fetch to `/recipe/[id]/pdf`
   with the auth token and downloads the file.

---

## FIX 4 — Remove Discover from web navigation

### Current behaviour
A "Discover" nav item exists in the web sidebar.

### Fix
Remove the Discover nav item from the sidebar entirely. The Search page already
provides public recipe discovery — Discover is redundant.

Also check: is there a `/dashboard/discover` route? If so, add a redirect:
```ts
// In apps/web/app/dashboard/discover/page.tsx:
import { redirect } from 'next/navigation';
export default function DiscoverPage() {
  redirect('/dashboard/search');
}
```

---

## DEPLOYMENT

After all fixes, deploy to RPi5:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Confirm build succeeds before restarting PM2.

---

## COMPLETION CHECKLIST

- [ ] RecipeComments component wired into web recipe detail page
- [ ] Comments section visible on public recipes (empty state shown if no comments)
- [ ] Likes count shown near recipe title, not at bottom
- [ ] Recipe owner can see likers by clicking the count
- [ ] PDF button removed from bottom of recipe detail
- [ ] PDF option added inside Share dropdown (Pro only, greyed for others)
- [ ] Discover removed from sidebar nav
- [ ] /dashboard/discover redirects to /dashboard/search
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
