# ChefsBook — Session 32: Share Links + Guest Access
# Depends on: Sessions 26, 27, 31
# Target: apps/mobile + apps/web + packages/db

---

## CROSS-PLATFORM REQUIREMENT — READ FIRST

Every feature in this session MUST be implemented on BOTH platforms:
- `apps/mobile` — React Native / Expo
- `apps/web` — Next.js

Both must be fully working before /wrapup. Do not leave either platform with a TODO.

---

## CONTEXT

Share button on recipe detail generates a chefsbk.app link. Recipients hit a sign-in
wall with guest option. App deep linking opens ChefsBook if installed.
Read all applicable agents, especially import-pipeline.md.

---

## SHARE BUTTON FLOW (mobile)

When user taps the share icon (existing share icon in action bar):

```
┌─────────────────────────────────────────┐
│  Share this recipe                      │
│─────────────────────────────────────────│
│  ┌─────────────────────────────────┐    │
│  │  🔗 Share via ChefsBook link    │    │
│  │  Anyone with the link can view  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  📄 Share as PDF                │    │  ← Pro only
│  │  Send a formatted PDF           │    │
│  └─────────────────────────────────┘    │
│                                         │
│              [Cancel]                   │
└─────────────────────────────────────────┘
```

**PDF option** shown only if user is Pro. Non-Pro sees it greyed with "Pro plan" badge.

### Privacy warning
Before generating the share link, check recipe visibility:

If `visibility = 'private'`:
```
┌─────────────────────────────────────────┐
│  ⚠️  This recipe is private             │
│                                         │
│  Sharing will allow anyone with the     │
│  link to view this recipe. It will not  │
│  appear in public search.               │
│                                         │
│  [Cancel]      [Share anyway]           │
└─────────────────────────────────────────┘
```

If user proceeds: update recipe `visibility` to `shared_link` (not fully public).

If `visibility = 'public'` or `shared_link'`: no warning, generate link immediately.

### Link generation
```
chefsbk.app/recipe/[recipe_id]?ref=[sharer_username]
```

Copy to clipboard + open Android share sheet so user can paste into any app.
Toast: "Link copied to clipboard"

---

## PUBLIC RECIPE PAGE (web)

Route: `chefsbk.app/recipe/[id]`

This is a publicly accessible Next.js page (no auth required to render).

### Sign-in wall
Before showing recipe content, check if viewer is authenticated:

**Not authenticated → show sign-in wall overlay:**
```
┌─────────────────────────────────────────┐
│           [ChefsBook Logo]              │
│                                         │
│   @chefA shared a recipe with you       │
│   "Belgian Waffles"                     │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Sign in                  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Create account           │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  📱 Download the app            │    │
│  └─────────────────────────────────┘    │
│                                         │
│         Continue as guest →             │
│    (enter email, no password needed)    │
└─────────────────────────────────────────┘
```

**"Continue as guest" flow:**
- Shows an email input field
- User enters email → stored in `guest_sessions` table (no auth account created)
- User can now view the recipe
- Persistent banner at top: "Viewing as guest · Sign up to save recipes"
- Guest can: view recipe, see comments, like (stored locally, not DB)
- Guest cannot: save recipe, comment, follow, share

```sql
CREATE TABLE IF NOT EXISTS guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  recipe_id UUID REFERENCES recipes(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Authenticated → show recipe directly** (no wall).

### Recipe page layout
Full recipe detail: title, image, ingredients, steps, notes, comments.
At bottom: persistent CTA card:
```
┌─────────────────────────────────────────┐
│  Love this recipe?                      │
│  Save it to your ChefsBook collection  │
│                                         │
│  [Sign up free]    [Download the app]   │
└─────────────────────────────────────────┘
```

---

## ANDROID APP LINKS (deep linking)

When the share link is tapped on Android and ChefsBook is installed, it should open
the app directly to that recipe.

### Setup required:

**1. Asset links file** — create at `apps/web/public/.well-known/assetlinks.json`:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.chefsbook.app",
    "sha256_cert_fingerprints": ["[APK_SIGNING_KEY_FINGERPRINT]"]
  }
}]
```

Note: The SHA256 fingerprint of the release APK signing key is needed here.
Get it with: `keytool -list -v -keystore [keystore.jks]`
Add the fingerprint to this file and to CLAUDE.md.

**2. App intent filters** — already added in session 1 (April 6) for `http/https VIEW`
intents. Verify `app.json` includes:
```json
"intentFilters": [
  {
    "action": "VIEW",
    "autoVerify": true,
    "data": [
      { "scheme": "https", "host": "chefsbk.app", "pathPrefix": "/recipe" }
    ],
    "category": ["BROWSABLE", "DEFAULT"]
  }
]
```

`autoVerify: true` is what triggers Android App Links (vs regular deep links).

**3. In-app handler** — when app opens from a chefsbk.app/recipe/[id] URL:
```ts
// In _layout.tsx expo-linking handler:
if (url.includes('chefsbk.app/recipe/')) {
  const recipeId = url.split('/recipe/')[1].split('?')[0];
  const ref = new URL(url).searchParams.get('ref');
  router.push(`/recipe/${recipeId}?ref=${ref}`);
}
```

**4. In-app recipe view from share link:**
- Opens recipe detail for that recipe ID
- If recipe belongs to another user: show "Save to my collection" button
- On save: uses attribution flow from session 31 with ?ref= param

---

## SAVE FROM SHARE LINK (mobile)

When viewing another user's recipe via share link in the app:

```
┌─────────────────────────────────────────┐
│  ← Recipe from @chefA                  │
│─────────────────────────────────────────│
│  [Full recipe detail]                   │
│                                         │
│  ┌─────────────────────────────────┐    │  ← sticky bottom bar
│  │  💾 Save to my ChefsBook        │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

- Save requires Chef plan or above (Free users see upgrade prompt)
- On save: creates copy in user's collection with attribution tags (session 31)
- Toast: "Saved to your collection"
- The "Save" button changes to "Saved ✓" after saving

---

## COMPLETION CHECKLIST

- [ ] Share button opens action sheet (ChefsBook link + PDF)
- [ ] Privacy warning shown for private recipes before sharing
- [ ] Recipe visibility updated to shared_link when private recipe is shared
- [ ] Share link: chefsbk.app/recipe/[id]?ref=[username]
- [ ] Link copied to clipboard + Android share sheet opened
- [ ] Public recipe page at chefsbk.app/recipe/[id]
- [ ] Sign-in wall with Sign in / Create account / Download app / Guest options
- [ ] Guest email capture stored in guest_sessions table
- [ ] Guest can view recipe with persistent "Sign up" banner
- [ ] CTA card at bottom of recipe for unauthenticated/guest users
- [ ] assetlinks.json created at /.well-known/assetlinks.json
- [ ] Intent filter in app.json with autoVerify: true for chefsbk.app
- [ ] App opens to recipe detail when share link tapped with ChefsBook installed
- [ ] "Save to my collection" button shown on shared recipes in app
- [ ] Attribution tags applied on save (session 31 integration)
- [ ] Safe area insets on all new modals and bottom bars
- [ ] i18n keys for all new strings
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
