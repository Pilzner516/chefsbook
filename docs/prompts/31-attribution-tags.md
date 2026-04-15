# ChefsBook — Session 31: Recipe Attribution Tags
# Depends on: Session 26 (usernames)
# Target: apps/mobile + apps/web + packages/db

---

## CROSS-PLATFORM REQUIREMENT — READ FIRST

Every feature in this session MUST be implemented on BOTH platforms:
- `apps/mobile` — React Native / Expo
- `apps/web` — Next.js

Do not implement a feature on one platform and leave the other with a TODO.
Both must be fully working before /wrapup.

Platform-specific notes:
- Attribution tag pills → recipe detail on both platforms
- @original_submitter pill (locked, red) → both platforms
- @shared_by pill (removable) → both platforms
- Tapping a tag → navigates to that user's public profile on both platforms
- "by @username" on recipe cards → mobile recipe list AND web dashboard recipe grid
- Save from share link → available on both platforms

---

## CONTEXT

When a user saves someone else's recipe, two permanent attribution tags are added:
@original_submitter (never removable) and @shared_by (the person who shared it to them,
never removable, never chains further). Read all applicable agents.

---

## HOW ATTRIBUTION WORKS

```
Chef A creates "Belgian Waffles" → original_submitter = @chefA

Chef B sees it in the Discover feed and saves it:
→ saved recipe has: original_submitter = @chefA, shared_by = @chefB (B shared to themselves)
  Actually: shared_by = null when saving from Discover (no intermediary)

Chef A shares a link to Chef C:
→ Chef C opens link and saves it
→ saved recipe has: original_submitter = @chefA, shared_by = @chefA

Chef C reshares to Chef D:
→ Chef D saves it
→ saved recipe has: original_submitter = @chefA, shared_by = @chefC
→ (NOT @chefA then @chefC — only ONE shared_by, always the immediate sharer)
```

**Rule:** `original_submitter` always comes from the root recipe and never changes.
`shared_by` is always the person who directly shared the link to the current user.
If saving from Discover (no direct share), `shared_by` is null.

---

## SHARE LINK WITH ATTRIBUTION

When a user shares a recipe link, the URL includes a referrer token:
```
chefsbk.app/recipe/[id]?ref=[sharer_username]
```

When the recipient opens this link and saves the recipe:
- `original_submitter_id` = copied from the source recipe
- `shared_by_id` = looked up from `?ref=` username param

---

## ATTRIBUTION TAG UI

On recipe detail (below the title, above ingredients):

```
┌──────────────────────────────────┐
│  📖 Original recipe by @chefA   │  ← always shown, red, not removable
│  🔗 Shared by @chefC            │  ← only shown if shared_by exists, removable
└──────────────────────────────────┘
```

**@original_submitter pill:**
- Background: `colors.accentSoft`, text: `colors.accent` (red)
- Lock icon 🔒 on the pill
- Not removable — no × button
- Tapping opens @chefA's public profile

**@shared_by pill:**
- Background: neutral grey
- Has × remove button (user can remove this one)
- Tapping opens @chefC's public profile

If both are null (user's own original recipe): no attribution section shown.

---

## DB WIRING

The columns added in session 26:
```
original_submitter_id UUID
original_submitter_username TEXT
shared_by_id UUID
shared_by_username TEXT
```

### When saving from Discover or What's New:
```ts
// In savePublicRecipe():
newRecipe.original_submitter_id = sourceRecipe.original_submitter_id ?? sourceRecipe.user_id;
newRecipe.original_submitter_username = sourceRecipe.original_submitter_username
  ?? sourceRecipe.user_profile.username;
newRecipe.shared_by_id = null;  // no direct sharer
newRecipe.shared_by_username = null;
```

### When saving from a share link with ?ref=:
```ts
// In saveFromShareLink():
newRecipe.original_submitter_id = sourceRecipe.original_submitter_id ?? sourceRecipe.user_id;
newRecipe.original_submitter_username = sourceRecipe.original_submitter_username
  ?? sourceRecipe.user_profile.username;
newRecipe.shared_by_id = sharerProfile.id;  // from ?ref= param
newRecipe.shared_by_username = sharerProfile.username;
```

### When creating own recipe (import, scan, speak):
```ts
newRecipe.original_submitter_id = currentUser.id;
newRecipe.original_submitter_username = currentUser.username;
newRecipe.shared_by_id = null;
newRecipe.shared_by_username = null;
```

---

## RECIPE CARD ATTRIBUTION

On recipe cards in the list/grid view (not just detail):
- If `original_submitter_username` exists and is not the current user:
  Show a small `by @username` line below the recipe title, grey, 12px
- Keeps card compact — one line only

---

## COMPLETION CHECKLIST

- [ ] Attribution columns wired in savePublicRecipe() correctly
- [ ] Attribution columns wired in saveFromShareLink() with ?ref= parsing
- [ ] Own recipe saves set original_submitter to current user
- [ ] No chaining — shared_by is always the immediate sharer only
- [ ] Attribution tags shown on recipe detail (locked original, removable shared_by)
- [ ] Tapping attribution tag navigates to that user's profile
- [ ] original_submitter pill has lock icon, no remove button
- [ ] shared_by pill has × remove button
- [ ] Recipe card shows "by @username" for non-own recipes
- [ ] i18n keys for attribution strings
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
