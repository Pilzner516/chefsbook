# ChefsBook — Session 95: Recipe Detail Enhancements
# Source: Feature review — recipe detail improvements
# Target: apps/web + apps/mobile

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, ui-guardian.md, data-flow.md,
deployment.md, and testing.md per SESSION START sequence.

This session enhances the recipe detail page on both web and mobile.
Check feature-registry.md before touching any existing feature.

---

## FIX 7 — Cuisine field: replace text input with dropdown

On recipe detail edit mode, the cuisine field is currently a free-text input.
Replace it with a searchable dropdown that shows:
1. All cuisines already used across the user's recipes (from DB)
2. A curated list of common cuisines as fallback options

Implementation:
- Query distinct cuisine values from the user's recipes on load
- Merge with a hardcoded list of ~30 common cuisines (Italian, French,
  Mexican, Japanese, Chinese, Indian, Thai, Greek, Spanish, American,
  Mediterranean, Middle Eastern, Korean, Vietnamese, Moroccan, etc.)
- Deduplicate and sort alphabetically
- Show as a searchable dropdown/picker — user can type to filter or
  select from the list
- User can still type a custom cuisine not in the list
- Web: use a combobox pattern (input + dropdown suggestions)
- Mobile: use a bottom sheet picker with search input
- Matches the pattern of the existing tags implementation

---

## FIX 8 — Attribution: show submitter AND source URL

On recipe detail, the attribution pill currently shows EITHER the
submitter OR the source URL — never both.

Fix: always show BOTH when both exist:
- original_submitter pill (red, locked, shows @username)
- source URL pill (shows domain name, links to original URL)

These must appear side by side in the attribution row below the title.
If only one exists, show only that one.
If neither exists, show nothing.

This applies to both web and mobile recipe detail.

The submitter pill must never be editable by any user.
The source URL pill must open the original URL in a new tab/browser.

---

## FIX 11 — Save count icon next to like count

On recipe detail (web + mobile), next to the heart/like count, add a
bookmark/save count showing how many users have saved this recipe.

Implementation:
- The recipe_saves table already exists with a save_count trigger
- Add a bookmark icon (use a bookmark or ribbon icon from the existing
  icon library — never use emoji)
- Show the save_count number next to it
- Clicking the count (if viewer is the recipe owner): opens a modal
  showing the list of users who saved it (username + avatar), same
  pattern as the likers modal
- Clicking the count (if viewer is NOT the owner): no action
- The bookmark icon itself is not interactive — it is display only
- Style: same size and colour as the like count display

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

- [ ] Cuisine field is a searchable dropdown in edit mode (web + mobile)
- [ ] Custom cuisine entry still possible if not in list
- [ ] Attribution row shows both submitter pill AND source URL pill when both exist
- [ ] Source URL pill opens original URL in new tab/browser
- [ ] Submitter pill is locked/non-editable
- [ ] Save count (bookmark icon + number) visible next to like count on recipe detail
- [ ] Recipe owner can click save count to see who saved the recipe
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
