# ChefsBook — Session 70: Fix Attribution Row Layout
# Source: QA screenshot 2026-04-11
# Target: apps/web + apps/mobile (recipe detail)

---

## CROSS-PLATFORM REQUIREMENT
Fix on BOTH platforms. Read .claude/agents/ui-guardian.md and
.claude/agents/deployment.md before starting.

---

## CONTEXT

From QA screenshot, the recipe detail attribution area has two issues:
1. The uploader's avatar/username pill is missing — only the URL pill shows
2. The "Public" visibility pill shows between the title and action bar —
   this is redundant and should be removed from this location
3. Both attribution pills should be on the same horizontal line

---

## FIX 1 — Show uploader pill even for URL-imported recipes

The current attribution logic only shows the user pill when
`original_submitter_username` is set. But for URL-imported recipes that the
current user imported themselves, `original_submitter_username` may be empty
even though the current user IS the original submitter.

Update the attribution logic:

```ts
function getAttributions(recipe: Recipe, currentUser: User): Attribution[] {
  const attributions: Attribution[] = [];

  // Always show the uploader — either original_submitter or current user
  const uploaderUsername = recipe.original_submitter_username
    ?? (recipe.user_id === currentUser.id ? currentUser.username : null);
  const uploaderAvatar = recipe.original_submitter_profile?.avatar_url
    ?? (recipe.user_id === currentUser.id ? currentUser.avatar_url : null);

  if (uploaderUsername) {
    attributions.push({
      type: 'user',
      avatar_url: uploaderAvatar,
      label: `@${uploaderUsername}`,
      href: `/u/${uploaderUsername}`,
    });
  }

  // Add source if URL or cookbook
  if (recipe.cookbook_id && recipe.cookbook_title) {
    attributions.push({
      type: 'cookbook',
      icon: '📖',
      label: recipe.cookbook_title,
      href: `/dashboard/cookbooks/${recipe.cookbook_id}`,
    });
  } else if (recipe.source_url) {
    const domain = new URL(recipe.source_url).hostname.replace('www.', '');
    attributions.push({
      type: 'url',
      icon: '🔗',
      label: domain,
      href: recipe.source_url,
      external: true,
    });
  }

  return attributions;
}
```

This returns an array of attributions. Render them as pills on a single row.

---

## FIX 2 — Single attribution row with both pills side by side

Replace the current single-pill attribution with a flex row:

```tsx
{/* Attribution row — below title, above action bar */}
<div style={{ display: 'flex', gap: 8, alignItems: 'center',
              flexWrap: 'wrap', margin: '8px 0' }}>
  {attributions.map(attr => (
    <AttributionPill key={attr.type} attribution={attr} />
  ))}
</div>
```

Result:
```
Homemade Biscuits

[👤 @pilzner]  [🔗 preppykitchen.com ↗]

♡ 0  [share]  [pin]  [edit]
```

Both pills on the same line. If viewport is narrow, they wrap to two lines
(flexWrap: 'wrap') — acceptable.

---

## FIX 3 — Remove "Public" pill from between title and action bar

Find the visibility badge/pill that shows "Public" or "Private" in the
recipe detail header area (between title and the ♡ like button row).

Remove it from this location entirely. The visibility indicator for the
recipe owner already exists elsewhere (e.g. in the recipe edit options or
the recipe card). It does not need to appear in the detail view action area.

Do NOT remove the visibility toggle from edit mode — only remove the
display-only "Public" badge from the read-mode detail view.

---

## MOBILE — same fixes

Apply the same three fixes to the mobile recipe detail:
1. Show current user as uploader if original_submitter is empty
2. Both pills in a horizontal row (flex row with gap)
3. Remove the "Public" visibility badge from between title and action bar

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

Verify on chefsbk.app — open "Homemade Biscuits":
- See `[@pilzner]` pill AND `[🔗 preppykitchen.com ↗]` pill on same line
- No "Public" badge between title and action bar

---

## COMPLETION CHECKLIST

- [ ] User pill shows for URL-imported recipes (current user as uploader)
- [ ] Both user pill and URL/cookbook pill on same horizontal line
- [ ] Avatar shows in user pill (or initials if no avatar)
- [ ] "Public" visibility badge removed from read-mode detail view
- [ ] Mobile: same layout with both pills on same line
- [ ] Mobile: "Public" badge removed from action area
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
