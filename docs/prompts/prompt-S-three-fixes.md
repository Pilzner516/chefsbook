# Prompt S — Three Fixes: Messages Load, Search Translations, Menu Reordering
## Scope: apps/web (messages page, search page, sidebar nav, admin nav)

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
Inspect: `\d messages` (or find actual messages table name)
`\d recipe_translations` `\d user_profiles`

---

## FIX 1 — Messages page stuck on "Loading messages..."

### Symptom
`/dashboard/messages` shows "Loading messages..." indefinitely.
No messages appear even though the sidebar shows a badge count of 3.

### Investigation
Find the messages page component and its data fetching:
- `apps/web/app/dashboard/messages/page.tsx` (or similar path)
- The API route or Supabase query it uses

Check:
1. What table does it query? (`\d messages` or find actual table name)
2. Is the query failing silently? Add error logging.
3. Does the RLS policy allow the authenticated user to read their messages?
4. Is the query using the correct user ID?

Run on RPi5:
```sql
-- Find actual messages table
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE '%message%';

-- Check if messages exist for the test user
SELECT COUNT(*) FROM messages WHERE recipient_id = (
  SELECT id FROM auth.users WHERE email = 'a@aol.com'
);
-- (adjust query based on actual schema)
```

Fix whatever is causing the silent failure. Add proper error state
to the UI so if loading fails, the user sees an error message instead
of infinite spinner.

---

## FIX 2 — Search page: show translated titles when language ≠ English

### Context
The `recipe_translations` table has title-only translations for most
recipes in fr/es/it/de. When the user switches the UI language,
the search results should show translated titles and descriptions
(where available) instead of the English originals.

### How translations are stored
```
recipe_translations
├─ recipe_id
├─ language (e.g. 'fr', 'es', 'it', 'de')
├─ translated_title
├─ translated_description (null for title-only translations)
├─ is_title_only (boolean)
```

### What to change

**In the search query** (`apps/web/app/dashboard/search/page.tsx`
or the search API route):

1. Get the current user's language from their profile or from the
   i18n context (check how the language is stored — likely in
   `user_profiles.preferred_language` or a cookie/localStorage)

2. If language is 'en' (or not set): no change, show original titles

3. If language is 'fr', 'es', 'it', or 'de':
   - JOIN `recipe_translations` on `recipe_id` AND `language = userLang`
   - Use `COALESCE(rt.translated_title, r.title)` as the display title
   - Use `COALESCE(rt.translated_description, r.description)` as display description
   - This way: if a translation exists, show it; if not, fall back to English

4. Pass the resolved title and description to the recipe card component

**In the recipe card:**
- Use the resolved title (already translated or English fallback)
- No change needed to the card component itself if the query
  passes the right values

### Language detection
Check how the current language is stored. Search for:
- `useLocale()` or `useTranslation()` hooks
- `i18n` configuration
- `preferred_language` in user_profiles
- URL locale prefix (e.g. `/fr/dashboard/search`)

Use whatever pattern is already in place — do NOT introduce a new
language storage mechanism.

### Important
- English recipes always show English title (no translation needed)
- If translation doesn't exist for a recipe: fall back to English gracefully
- Only affects display — underlying recipe data stays in original language
- Do NOT trigger new AI translation calls from the search page

---

## FEATURE 3 — Drag and drop menu reordering (User sidebar + Admin sidebar)

### Context
Users want to reorder their sidebar navigation items by dragging and
dropping. The order should persist across sessions, stored per user.

### Scope
**User sidebar** (authenticated dashboard nav):
Items that can be reordered:
- Search
- My Recipes
- My Techniques
- My Cookbooks
- Shopping
- Meal Plan
- Import & Scan
- Speak a Recipe
- Messages

Fixed items (always at bottom, not reorderable):
- Units toggle
- Settings
- Admin (if admin user)
- Sign out

**Admin sidebar**: NOT included in this prompt — admin nav reordering
is a separate future feature.

### Storage
Add a column to `user_profiles`:
```sql
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS nav_order TEXT[] DEFAULT NULL;
```

`nav_order` stores an array of nav item keys in the user's preferred
order, e.g. `['my-recipes', 'search', 'meal-plan', 'my-techniques', ...]`

If `nav_order` is NULL: use default order (existing order).
If `nav_order` is set: render nav items in that order.

Apply migration on RPi5, restart supabase-rest.

### Implementation

**Drag and drop library:**
Check if any dnd library is already installed in the project
(`@dnd-kit/core`, `react-beautiful-dnd`, `@hello-pangea/dnd`).
If not installed, use `@hello-pangea/dnd` (maintained fork of
react-beautiful-dnd, well-suited for lists):
```bash
cd apps/web && npm install @hello-pangea/dnd
```

**Sidebar component:**
Find the sidebar/nav component. Add drag handles to each reorderable
nav item — a small grip icon (⠿ or similar) that appears on hover.

On drag end:
1. Update local state immediately (optimistic update)
2. Save new order to `user_profiles.nav_order` via API call
3. On next page load, read `nav_order` from user profile and render
   in that order

**API route:**
`PATCH /api/user/nav-order` — accepts `{ navOrder: string[] }` and
updates `user_profiles.nav_order` for the authenticated user.

**Reset option:**
Add a small "Reset to default" link at the bottom of the nav
(only visible if `nav_order` is set) that sets `nav_order = NULL`
and restores the default order.

### Nav item keys
Define a canonical list of nav item keys matching the existing nav:
```typescript
const NAV_ITEMS = [
  { key: 'search', label: 'Search', ... },
  { key: 'my-recipes', label: 'My Recipes', ... },
  { key: 'my-techniques', label: 'My Techniques', ... },
  { key: 'my-cookbooks', label: 'My Cookbooks', ... },
  { key: 'shopping', label: 'Shopping', ... },
  { key: 'meal-plan', label: 'Meal Plan', ... },
  { key: 'import-scan', label: 'Import & Scan', ... },
  { key: 'speak-recipe', label: 'Speak a Recipe', ... },
  { key: 'messages', label: 'Messages', ... },
];
```

---

## IMPLEMENTATION ORDER
1. Fix 1 — Messages page (diagnose + fix, quickest win)
2. Apply `nav_order` migration on RPi5
3. Fix 2 — Search translations (query change)
4. Feature 3 — Drag and drop nav reordering
5. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
6. Deploy per `deployment.md`

---

## GUARDRAILS
- Fix 2: NEVER trigger new AI translation calls from search page
- Fix 2: Always fall back to English if translation not found
- Feature 3: Fixed items (Settings, Sign out, Admin) are NEVER reorderable
- Feature 3: nav_order = NULL means default order (don't store default explicitly)
- Feature 3: If a nav item key is missing from nav_order (new feature added
  after user set their order), append it at the end
- Use ChefsDialog for nothing here — no destructive actions

---

## REGRESSION CHECKS — MANDATORY
1. Messages page loads and shows messages ✓
2. English UI: search shows English titles ✓
3. French UI: search shows French translated titles where available ✓
4. French UI: recipes without translations show English title (fallback) ✓
5. Nav items can be dragged and reordered ✓
6. Nav order persists after page reload ✓
7. "Reset to default" restores original order ✓
8. Fixed items (Settings, Sign out) cannot be dragged ✓
9. My Recipes images still show ✓
10. Search page still works ✓
11. Recipe detail page still works ✓

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Messages: what was failing and what fixed it
- Translations: how language is detected and which query was changed
- Nav reorder: migration applied, library used, API route path
- All 11 regression checks confirmed
- tsc clean + deploy confirmed
