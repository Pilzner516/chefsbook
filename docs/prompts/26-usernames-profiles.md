# ChefsBook — Session 26: Usernames + Profiles + Searchability
# Depends on: nothing (foundation)
# Target: apps/mobile + apps/web + packages/db

---

## CONTEXT

Every social and sharing feature depends on users having usernames. This session adds
usernames to the platform, makes accounts searchable, and builds the public profile page.
Read all applicable agents before starting.

---

## DB CHANGES

Migration `017_usernames_profiles.sql`:

```sql
-- Add username and profile fields to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS is_searchable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recipe_count INTEGER DEFAULT 0;

-- Username index for fast search
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username
  ON user_profiles (lower(username));

-- Username validation: lowercase letters, numbers, underscores, 3-20 chars
ALTER TABLE user_profiles
  ADD CONSTRAINT username_format
  CHECK (username ~ '^[a-z0-9_]{3,20}$');

-- Set Pilzner as username for seblux100@gmail.com
-- (Run after migration, replace UUID with actual user ID)
-- UPDATE user_profiles SET username = 'pilzner' WHERE id = '[seblux_user_id]';
```

Apply to RPi5. Note the Pilzner username update needs to be run manually with the
actual user UUID — query it first:
```sql
SELECT id FROM auth.users WHERE email = 'seblux100@gmail.com';
UPDATE user_profiles SET username = 'pilzner', is_searchable = true
  WHERE id = '[result from above]';
```

---

## SIGNUP FLOW — username required

### Mobile (apps/mobile)
On the sign-up screen, add a username field between name and email:
- Label: "Username"
- Placeholder: "e.g. homechef42"
- Validation (real-time as they type):
  - 3-20 characters
  - Lowercase letters, numbers, underscores only
  - No spaces
  - Auto-lowercase as they type
  - Check availability via debounced Supabase query
  - Show ✓ green when available, ✗ red when taken, spinner while checking
- Username is permanent — add helper text: "Choose carefully — this cannot be changed later"
- Required field — cannot proceed without a valid available username

### Web (apps/web)
Same username field on the web signup page with identical validation.

---

## SEARCHABILITY SETTING

### Default: searchable = true
When `is_searchable = false`:
- User does not appear in username search results
- User cannot post new comments (existing comments remain visible)
- Show warning when toggling to private:
  ```
  ┌─────────────────────────────────────────┐
  │  Switch to Private mode?                │
  │                                         │
  │  • You won't appear in user search      │
  │  • You won't be able to post comments   │
  │  • Your existing comments stay visible  │
  │                                         │
  │  [Cancel]           [Switch to Private] │
  └─────────────────────────────────────────┘
  ```

### Settings location
- Mobile: Settings screen → "Account Privacy" toggle
- Web: Settings page → Privacy section → "Make my account searchable" toggle

---

## PUBLIC PROFILE PAGE

### Web route: `chefsbk.app/u/[username]`
### Mobile: navigable from anywhere a username appears

Profile page shows:
```
┌─────────────────────────────────────────┐
│  [Avatar]  @username                    │
│            Display name                 │
│            Bio (if set)                 │
│                                         │
│  [Followers N] [Following N] [Recipes N]│
│                                         │
│  [Follow]  [Message - future]           │
│─────────────────────────────────────────│
│  Public Recipes                         │
│  [Recipe cards grid]                    │
└─────────────────────────────────────────┘
```

- Only shows public recipes
- Follow button (wired in session 29)
- Tapping a recipe card opens that recipe
- If viewing own profile: shows Edit Profile button instead of Follow

### Profile editing (own profile only)
- Display name (changeable)
- Bio (max 200 chars)
- Avatar (upload photo — uses same image upload system)
- Username: shown as read-only with lock icon and "Cannot be changed" label

---

## USERNAME SEARCH

In the Search tab, add username search capability:
- When search query starts with `@` → search usernames only
- When search query is plain text → search recipes AND usernames
- Username results show in a "People" section above recipe results
- Each person result shows: avatar/initials, @username, display name, follower count
- Tapping opens their public profile
- Only shows users where `is_searchable = true`

---

## RECIPE ATTRIBUTION TAGS (foundation — full wiring in session 31)

Add to `recipes` table:
```sql
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS original_submitter_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS original_submitter_username TEXT,
  ADD COLUMN IF NOT EXISTS shared_by_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS shared_by_username TEXT;
```

When a user saves their own recipe (import, scan, speak):
- `original_submitter_id` = current user
- `original_submitter_username` = current user's username

When a user saves someone else's recipe:
- `original_submitter_id` = original creator (preserved from source recipe)
- `shared_by_id` = the user who shared it to them
- These never chain — full wiring in session 31

---

## COMPLETION CHECKLIST

- [ ] Migration 017 applied to RPi5
- [ ] Username added to signup flow (mobile + web) with real-time availability check
- [ ] Username is permanent — shown as read-only after set
- [ ] Pilzner username set for seblux100@gmail.com
- [ ] is_searchable toggle in settings with privacy warning modal
- [ ] Private mode blocks new comments (warning shown)
- [ ] Public profile page at /u/[username] (web + mobile navigation)
- [ ] Profile shows public recipes, bio, follower/following counts
- [ ] @ search in Search tab returns user results
- [ ] Attribution columns added to recipes table
- [ ] Safe area insets on all new modals
- [ ] i18n keys added for all new strings (all 5 locales)
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
