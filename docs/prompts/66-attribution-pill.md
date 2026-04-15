# ChefsBook — Session 66: Recipe Creator Attribution Pill
# Source: Feature request 2026-04-11
# Target: apps/web + apps/mobile (recipe detail page)

---

## CROSS-PLATFORM REQUIREMENT
Implement on BOTH platforms. Read .claude/agents/ui-guardian.md,
.claude/agents/image-system.md, and .claude/agents/deployment.md before starting.

---

## CONTEXT

Every recipe detail page should show a pill near the action bar identifying
where the recipe came from — who created it, which site it was imported from,
or which cookbook it came from. Tapping the pill navigates to that source.

This replaces/consolidates the existing `@original_submitter` attribution tags
from session 31 which are not currently visible. The new pill is the primary
visible attribution element.

---

## ATTRIBUTION LOGIC

Determine what to show based on recipe fields, in priority order:

```ts
function getAttribution(recipe: Recipe): Attribution {

  // 1. Original ChefsBook user (created by scanning, speaking, manual entry)
  if (recipe.original_submitter_id && recipe.original_submitter_username) {
    return {
      type: 'user',
      avatar_url: recipe.original_submitter_profile?.avatar_url,
      label: `@${recipe.original_submitter_username}`,
      href: `/u/${recipe.original_submitter_username}`,
    };
  }

  // 2. Imported from a cookbook
  if (recipe.cookbook_id && recipe.cookbook_title) {
    return {
      type: 'cookbook',
      icon: '📖',
      label: recipe.cookbook_title,
      href: `/dashboard/cookbooks/${recipe.cookbook_id}`,
    };
  }

  // 3. Imported from a URL — show domain only
  if (recipe.source_url) {
    const domain = new URL(recipe.source_url).hostname.replace('www.', '');
    return {
      type: 'url',
      icon: '🔗',
      label: domain,
      href: recipe.source_url,
      external: true,
    };
  }

  // 4. No attribution available
  return null;
}
```

---

## PILL UI

Place the attribution pill on the recipe detail page, directly below the
recipe title and above the action bar (heart/share/pin/edit row):

```
Fried Indonesian Noodles
Indonesian · main · 45 min

[👤 avatar]  @pilzner            ← ChefsBook user pill
[📖]  The French Laundry Cookbook  ← Cookbook pill
[🔗]  seriouseats.com              ← URL import pill
```

### Pill styling (web)
```tsx
<a href={attribution.href} target={attribution.external ? '_blank' : undefined}
   className="attribution-pill">
  {attribution.type === 'user' && (
    <img src={proxyIfNeeded(attribution.avatar_url)} className="avatar" />
  )}
  {attribution.icon && <span>{attribution.icon}</span>}
  <span>{attribution.label}</span>
  {attribution.external && <span>↗</span>}
</a>
```

Style:
- Background: `#f3f4f6` (light grey)
- Border: 1px solid `#e5e7eb`
- Border-radius: 24px (full pill)
- Padding: 4px 12px 4px 6px
- Font: 13px, `#374151`
- Avatar: 20px circle, `object-fit: cover`
- Hover: background `#e5e7eb`
- Cursor: pointer

### Mobile pill styling
- Same layout using React Native `TouchableOpacity`
- `colors.backgroundSecondary` background
- Avatar from `recipe_user_photos` or `user_profiles.avatar_url`
- Apply `proxyIfNeeded()` for Supabase storage avatar URLs

---

## DATA REQUIREMENTS

The recipe detail query must include:
```ts
.select(`
  *,
  original_submitter:user_profiles!original_submitter_id(
    id, username, avatar_url
  ),
  cookbook:cookbooks(id, title)
`)
```

If `original_submitter_id` is the current user's own ID, still show the pill
(it's their recipe) but don't make it a link — just show the avatar and username
as a non-clickable label, or navigate to their own profile.

---

## RELATIONSHIP WITH EXISTING ATTRIBUTION TAGS

The session 31 attribution tags (`@original_submitter` locked pill,
`@shared_by` removable pill) should remain but move to a less prominent position —
below the ingredients section or in a collapsible "Recipe info" section.

The new attribution pill near the title is the primary, always-visible element.
The session 31 tags are secondary detail for users who want the full chain.

If the session 31 tags are not currently visible anywhere, verify they are
rendered in the recipe detail and fix their placement so they appear in the
"Recipe info" section below the description.

---

## ALSO: URL IMPORT — store source_url

Verify that `source_url` is being stored on the recipe when importing from URL.
Check:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT title, source_url FROM recipes WHERE source_url IS NOT NULL LIMIT 5;"
```

If `source_url` is empty for URL-imported recipes, find where the import saves
the recipe and ensure it stores the original URL.

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

- [ ] Attribution logic determines correct source (user / cookbook / URL)
- [ ] Pill shown below recipe title on web recipe detail
- [ ] ChefsBook user pill: avatar + @username, links to profile
- [ ] Cookbook pill: book icon + title, links to cookbook page
- [ ] URL pill: link icon + domain only, opens original URL in new tab
- [ ] No pill shown if no attribution data available
- [ ] Mobile recipe detail: same pill with correct styling
- [ ] `source_url` confirmed stored on URL-imported recipes
- [ ] `original_submitter` join included in recipe detail query
- [ ] Existing session 31 attribution tags still present (moved to Recipe info section)
- [ ] Avatar URLs go through `proxyIfNeeded()` on web
- [ ] Deployed to RPi5 and verified live on chefsbk.app
- [ ] Mobile verified via ADB screenshot
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
