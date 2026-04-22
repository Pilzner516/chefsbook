# Prompt O — Search Enhancements: Social Counts + Following + What's New
## Scope: apps/web (search page, search query, recipe cards)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ui-guardian.md`
8. `.claude/agents/data-flow.md`

Run ALL pre-flight checklists before writing a single line of code.
Inspect: `\d recipes` `\d recipe_saves` `\d user_follows`
`\d recipe_likes` (or equivalent likes table — verify actual table name)

Read the existing search page fully before writing any code:
`apps/web/app/dashboard/search/page.tsx`

---

## CONTEXT

The search page currently has two tabs: "All Recipes" and "My Recipes".
This session adds:
1. Like and save counts on search result cards
2. Sort by popularity option
3. "Following" tab — recipes from followed chefs with time filter
4. "What's New" tab — platform trending recipes with hot score ranking

---

## FEATURE 1 — Like and save counts on search cards

### What to add
On each recipe card in search results, show below or alongside the
existing metadata (tags, time):
- ♥ {like_count} — heart icon + number
- 🔖 {save_count} — bookmark icon + number

Only show if count > 0 (don't show "♥ 0").
Use small, subtle text — same size as the time/tag metadata.
Style consistent with existing card metadata.

### Query changes
The search query must return `like_count` and `save_count` for each
recipe. Check the actual table/column names first (`\d recipes` and
check if counts are denormalised columns or must be JOINed).

If counts are denormalised on recipes table: just add them to SELECT.
If they require JOINs:
```sql
COUNT(DISTINCT rl.id) as like_count,
COUNT(DISTINCT rs.id) as save_count
```

Use the same image fix pattern from the search image fix session
(getPrimaryPhotos + getRecipeImageUrl) — do NOT regress this.

---

## FEATURE 2 — Sort by popularity

### Add to the existing sort dropdown on the search page
Current options likely include: Date Added, Title A-Z etc.
Add: **Most Popular**

### Popularity sort
Order by a combined score: `(like_count + save_count)` DESC.
When "Most Popular" is selected, apply this ORDER BY to the search
query regardless of other filters.

---

## FEATURE 3 — "Following" tab

### Tab placement
Add as a third tab on the search page, after "All Recipes" and
"My Recipes":

`[All Recipes]  [My Recipes]  [Following]  [What's New]`

### Content
Recipes created by chefs the current user follows.

Query:
```sql
SELECT r.*, [image fields], [count fields]
FROM recipes r
JOIN user_follows uf ON uf.following_id = r.user_id
WHERE uf.follower_id = {current_user_id}
AND r.visibility = 'public'
AND r.created_at >= NOW() - INTERVAL '{days} days'
ORDER BY r.created_at DESC
```

Check actual column names in `user_follows` table:
`\d user_follows` — note follower vs following column names.

### Time filter
When the Following tab is active, show a time filter row below the
search bar:
- **7 days** | **30 days** | **90 days** (pill buttons, one active)
- Default: 30 days
- The filter only appears when Following tab is active — hide on other tabs

### Empty state
If user follows no one:
*"You're not following any chefs yet. Discover chefs on the Search page
and follow them to see their latest recipes here."*

If user follows chefs but no recipes in the time window:
*"No new recipes from chefs you follow in the last {N} days."*

---

## FEATURE 4 — "What's New" tab

### Content
Platform-wide trending recipes, ranked by hot score.

### Hot score formula
```sql
-- Score = (likes + saves) / (hours_since_posted ^ 0.8)
-- Higher score = more engagement relative to age
SELECT r.*,
  [image fields],
  (like_count + save_count)::float /
  NULLIF(
    POWER(
      EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600.0,
      0.8
    ),
    0
  ) as hot_score
FROM recipes r
WHERE r.visibility = 'public'
AND r.created_at >= NOW() - INTERVAL '{days} days'
ORDER BY hot_score DESC
LIMIT 50
```

New recipes with 0 likes/saves get hot_score = 0 and appear at bottom.
Recipes less than 1 hour old: use 1 hour as minimum to avoid division
edge cases (`GREATEST(hours_since_posted, 1)`).

### Time filter
When What's New tab is active, show time filter:
- **Last 7 days** | **Last 30 days** | **All time** (pill buttons)
- Default: Last 30 days
- "All time" removes the date filter from the query entirely

### Empty state
*"No trending recipes yet — be the first to share one!"*

### No follow requirement
What's New shows recipes from all chefs on the platform.
Available to all authenticated users regardless of who they follow.

---

## TAB VISIBILITY RULES

- **All Recipes** — always visible
- **My Recipes** — always visible (shows empty state if no recipes)
- **Following** — always visible (shows empty state if not following anyone)
- **What's New** — always visible

All four tabs visible to all authenticated users.

---

## IMPLEMENTATION ORDER
1. Inspect all relevant table schemas (`\d` commands above)
2. Feature 1 — add like/save counts to search query + card display
3. Feature 2 — add "Most Popular" sort option
4. Feature 3 — Following tab + time filter + query
5. Feature 4 — What's New tab + time filter + hot score query
6. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
7. Deploy per `deployment.md`

---

## REGRESSION CHECKS — MANDATORY

After deploying, verify ALL of the following:
1. Search results still show images (getPrimaryPhotos pattern intact) ✓
2. Search results show like/save counts where > 0 ✓
3. All Recipes tab still works as before ✓
4. My Recipes tab still works as before ✓
5. Following tab shows recipes from followed chefs ✓
6. Following tab time filter changes results ✓
7. What's New tab shows trending recipes ✓
8. What's New time filter changes results ✓
9. Sort by Most Popular orders correctly ✓
10. My Recipes grid images still show ✓
11. Recipe detail page still works ✓

---

## GUARDRAILS
- NEVER use `recipe.image_url` directly — always use
  `getPrimaryPhotos()` + `getRecipeImageUrl()` per the CLAUDE.md gotcha
  added after the search image regression
- Only show public recipes in Following and What's New tabs
- Hot score formula must handle edge cases (new recipes, 0 engagement)
- Time filter state is per-tab — Following and What's New have
  independent time filter selections
- Do not change the All Recipes or My Recipes tab behaviour

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Actual table/column names found for likes, saves, follows
- Whether counts are denormalised or JOINed
- All 11 regression checks confirmed
- tsc clean + deploy confirmed
