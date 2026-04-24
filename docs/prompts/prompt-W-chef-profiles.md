# Prompt W — Chef Public Profiles + Badge System
## Scope: apps/web (chef profile page, badge component, admin badge assignment, global badge display)

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

Read the existing chef profile page fully:
- Find the current profile page (likely `/dashboard/chef/[username]/page.tsx`
  or `/app/chef/[username]/page.tsx`)
- Read it completely before modifying anything

Inspect:
```sql
\d user_profiles
\d user_follows
\d recipes
\d techniques
\d cookbooks
```

---

## DESIGN SYSTEM

All profile UI must follow the Trattoria design system:
- Cream background: `#faf7f0`
- Pomodoro red: `#ce2b37`
- Basil green: `#009246`
- Font: Inter (existing app font)
- Pill/badge border radius: `rounded-full`
- Cards: subtle shadow, white background, rounded-lg

---

## FEATURE 1 — Verified Chef Badge Component

### Create `components/VerifiedChefBadge.tsx`

A custom SVG badge showing crossed fork & knife with a spoon
centered vertically between them. Elegant, fine-dining inspired.
Think Michelin hallmark — not cartoon, not emoji.

```tsx
// The badge renders as an SVG with these characteristics:
// - Crossed fork (left) and knife (right) at ~45° angles
// - Spoon centered vertically, slightly overlapping the cross point
// - All three utensils in pomodoro red #ce2b37
// - Thin, elegant stroke lines (strokeWidth: 1.5)
// - Circular background: white or cream with subtle red border
// - Drop shadow: subtle, like a stamp or seal
// - Sizes: 'sm' (16px inline), 'md' (24px cards), 'lg' (48px profile)

interface VerifiedChefBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean; // show "Verified Chef" on hover
}
```

SVG structure guidance:
```svg
<svg viewBox="0 0 100 100">
  <!-- Circular background -->
  <circle cx="50" cy="50" r="48" fill="white" stroke="#ce2b37" strokeWidth="2"/>
  
  <!-- Fork (left, rotated -45deg) -->
  <!-- Tines at top, handle at bottom -->
  <!-- 4 tines, narrow handle -->
  
  <!-- Knife (right, rotated +45deg) -->  
  <!-- Blade at top, handle at bottom -->
  <!-- Slightly curved blade edge -->
  
  <!-- Spoon (center, vertical) -->
  <!-- Oval bowl at top, straight handle -->
  <!-- Centered between fork and knife -->
  
  <!-- All strokes: #ce2b37, strokeWidth: 1.5, linecap: round -->
</svg>
```

When `showTooltip={true}`: hovering shows tooltip "Verified Chef · Recognized by Chefsbook"

### Badge types stored as user tags
The badge system uses the existing user tags (admin Users page Tags column):
- Tag `verified` → renders `<VerifiedChefBadge />`
- Tag `featured` → renders a ⭐ star badge (gold `#f59e0b`)
- Tag `author` → renders a 📚 book badge (basil green `#009246`)
- Tag `new` → auto-assigned if `created_at > NOW() - 30 days`, renders subtle "New" pill

Badges are read from `user_profiles.tags` (or wherever user tags are stored —
check schema). The admin assigns via the existing Tags system on the Users page.

### Create `components/UserBadges.tsx`
A component that reads a user's tags and renders the appropriate badges:

```tsx
interface UserBadgesProps {
  tags: string[];
  createdAt: string;
  size?: 'sm' | 'md' | 'lg';
}
// Returns null if no badges
// Returns badge components in order: verified, featured, author, new
```

### Where badges appear (global)
After creating the badge components, add `<UserBadges />` to:
1. Chef profile page (lg size, next to @username)
2. Recipe cards on My Recipes grid (sm size, next to @username attribution)
3. Recipe detail page — author attribution line (md size)
4. Comments — next to commenter username (sm size)
5. Search results — next to recipe author (sm size)
6. Messages — next to sender username (sm size)

---

## FEATURE 2 — Chef Public Profile Page (full redesign)

### Route
Keep existing route: `/chef/[username]` or find actual current route.

### Header section
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│         [Avatar — 96px, circular]                    │
│         @username  🍴 [verified badge if applicable] │
│         Display Name                                 │
│         Plan badge: Chef / Pro (subtle pill)         │
│                                                      │
│         "Bio text here — up to 160 chars"            │
│                                                      │
│         📍 Location (if set)                         │
│         🔗 Website/Instagram (if set)                │
│                                                      │
│    [56 Recipes]  [12 Followers]  [3 Following]       │
│                                                      │
│    [Follow] or [Following ✓] or [Edit Profile]       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Avatar:** Use the same avatar loading pattern as the sidebar fix
(fetch `avatar_url` from user_profiles, proxy through `/api/image`).
Letter initial fallback if no avatar.

**Follow/Unfollow button:**
- Viewing own profile: show **"Edit Profile"** button (links to Settings)
- Viewing another chef, not following: show **"Follow"** button (pomodoro red)
- Viewing another chef, already following: show **"Following ✓"** (green, outlined)
- Clicking Follow/Unfollow: calls existing follow/unfollow API
  (check DONE.md for existing follow system)
- Follower count updates optimistically on click

**Plan badge:**
- Free: no badge shown
- Chef: subtle grey pill "Chef"
- Family: subtle grey pill "Family"
- Pro: subtle gold/amber pill "Pro"

### Content tabs

Four tabs below the header:

**Tab 1: Recipes** (default)
- Grid of public recipe cards with images
- Same card style as search results
- Includes: image, title, cuisine, cook time, ♥ likes
- Uses `getPrimaryPhotos()` pattern for images
- Empty state: "No public recipes yet"
- Paginate: 12 per page, load more button

**Tab 2: Techniques**
- Grid of public techniques
- Card: image (or YouTube thumbnail), title, difficulty, description excerpt
- Empty state: "No public techniques yet"

**Tab 3: Cookbooks**
- Grid of public cookbooks
- Card: cover image, name, recipe count, description
- Empty state: "No public cookbooks yet"

**Tab 4: About**
- Full bio (not truncated)
- Member since date
- Cuisine specialties (from their most-used tags)
- Total likes received (sum of all recipe likes)
- Badges earned (displayed large with labels)

### Social links
Add `instagram_url`, `website_url` to user_profiles if not present:
```sql
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS instagram_url TEXT DEFAULT NULL;
ADD COLUMN IF NOT EXISTS website_url TEXT DEFAULT NULL;
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT NULL;
```
Apply migration. Add these fields to the Settings page profile section.

---

## FEATURE 3 — Settings page: Edit profile fields

The Settings page already has Display Name, Username, Email.
Add these new editable fields to the Public Profile section:

- **Bio** — textarea, max 160 chars, character counter
- **Location** — text input (e.g. "Paris, France")
- **Instagram** — text input, stores handle or full URL
- **Website** — text input, URL

All save via existing profile update mechanism.

---

## FEATURE 4 — Clickable @username everywhere

Currently @username attributions on recipe cards and detail pages
may not be clickable. Make every @username mention across the app
a link to that chef's public profile:

- Recipe card: click @username → `/chef/{username}`
- Recipe detail: click @username → `/chef/{username}`
- Comments: click @username → `/chef/{username}`
- Search results: click @username → `/chef/{username}`
- Messages (if username shown): click → `/chef/{username}`

---

## IMPLEMENTATION ORDER
1. Apply migrations (instagram_url, website_url, location on user_profiles)
2. Create `components/VerifiedChefBadge.tsx` (SVG badge)
3. Create `components/UserBadges.tsx` (badge renderer)
4. Redesign chef profile page header (avatar, bio, follow button, stats)
5. Add recipe/technique/cookbook/about tabs to profile
6. Add Follow/Unfollow functionality
7. Add badges to profile page (lg size)
8. Add badges to recipe cards (sm size)
9. Add badges to recipe detail page (md size)
10. Add badges to comments (sm size)
11. Add badges to search results (sm size)
12. Add new fields (bio, location, instagram, website) to Settings page
13. Make @username clickable everywhere (Feature 4)
14. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
15. Deploy per `deployment.md`

---

## GUARDRAILS
- Expelled users: profile page returns 404 (already implemented in V)
- Suspended users: profile page shows content but with suspension note
- Own profile: never show Follow button, always show Edit Profile
- Badges only show if the user has the corresponding tag
- `new` badge: auto-computed from created_at, never stored as a tag
- Avatar: always use `/api/image` proxy for Supabase storage URLs
- Recipe images on profile: MUST use `getPrimaryPhotos()` pattern —
  NEVER use `recipe.image_url` directly (see CLAUDE.md gotcha)
- All profile data is public — no auth required to view a chef profile
  (unless the chef is expelled)

---

## REGRESSION CHECKS — MANDATORY
1. Chef profile page loads for any valid username ✓
2. Avatar shows correctly (real photo or letter initial) ✓
3. Follow button shows for other chefs, Edit Profile for own ✓
4. Follow/Unfollow updates follower count optimistically ✓
5. Recipe tab shows public recipes with images ✓
6. Verified badge shows for users with 'verified' tag ✓
7. Badge shows on recipe cards next to @username ✓
8. Badge shows on recipe detail page ✓
9. @username links are clickable everywhere ✓
10. Settings page has new bio/location/instagram/website fields ✓
11. My Recipes images still show ✓
12. Search page still works ✓
13. Recipe detail page still works ✓

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- SVG badge description (what was rendered)
- Migrations applied confirmed
- List of all places badges were added
- Follow/Unfollow API route used
- All 13 regression checks confirmed
- tsc clean + deploy confirmed
