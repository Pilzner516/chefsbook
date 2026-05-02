# Prompt: ChefsBook — Personal Versions + Ask Sous Chef (Mobile)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/sous-chef-personal-versions-mobile.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — MOBILE ONLY (continuation)

## Context — what is already built

The backend and web UI for Personal Versions are complete. This session
implements the mobile UI only. Do not touch any backend, API routes, DB migrations,
or web files — everything there is done and deployed.

**Already complete (do not re-implement):**
- DB migration 077-078: `is_personal_version`, `personal_version_of`,
  `personal_version_slot` columns on `recipes`; `recipe_modifiers` table
- `packages/db/src/queries/recipes.ts`: `getPersonalVersions()`,
  `getPersonalVersionCount()`, `getRecipeModifiers()`, `upsertRecipeModifier()`,
  `removeRecipeModifier()`
- `packages/ai/src/`: `askSousChef()` function
- API routes (all at `apps/web/app/api/`):
  - `POST /api/recipes/[id]/ask-sous-chef`
  - `GET/POST /api/recipes/[id]/personal-versions`
  - `PUT/DELETE /api/personal-versions/[versionId]`
  - `POST /api/personal-versions/[versionId]/promote`
- Web UI: `VersionTabSwitcher.tsx`, `AskSousChefModal.tsx`,
  integrated into `apps/web/app/recipe/[id]/page.tsx`
- Modifier pills on web attribution row
- Orphan cascade in `deleteRecipe()`
- Plan gating: Chef+ required

**This session's scope — mobile only:**
- Version tab switcher on recipe detail screen
- Ask Sous Chef bottom sheet
- Modifier pills on mobile attribution row
- Rename / Promote / Delete actions via action sheet
- Feature registry update
- i18n mobile locale additions

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/navigator.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read `apps/mobile/app/recipe/[id].tsx` fully — understand the full existing
   screen structure before adding anything. Note:
   - Where the attribution row is rendered
   - How the existing action sheets / modals are implemented on this screen
   - How the plan tier is checked
   - How the screen fetches recipe data and what the data shape looks like
2. Read `apps/web/components/VersionTabSwitcher.tsx` — understand the logic to port
3. Read `apps/web/components/AskSousChefModal.tsx` — understand the flow to port
4. Check `apps/mobile/locales/en.json` (or equivalent) — note existing i18n key
   structure before adding new keys
5. Run `\d recipe_modifiers` on RPi5 to confirm table columns before querying
6. Confirm `EXPO_PUBLIC_SUPABASE_URL` vs web URL — mobile uses direct Tailscale IP
   (`http://100.110.47.62:8000`), NOT `https://api.chefsbk.app`
7. Check how API calls are made in `apps/mobile/app/recipe/[id].tsx` — direct fetch
   to `https://chefsbk.app` API routes (NOT the Supabase IP)

---

## Critical mobile rules for this feature

**Safe area — MANDATORY:**
Every new bottom-positioned element (bottom sheets, modal footers, action buttons)
MUST use `useSafeAreaInsets()` from `react-native-safe-area-context`.
Apply `paddingBottom: insets.bottom + 16` to all scroll containers and modal footers.
Never hardcode bottom margins.

**Theme — MANDATORY:**
ALWAYS use `useTheme().colors` — never hardcode hex values.
The Trattoria palette: red accent `#ce2b37`, green `#009246`, cream `#faf7f0`.
Use these via theme tokens, not hardcoded hex.

**American spelling:** Favorite not Favourite, throughout.

**API base URL for mobile:** API routes live at `https://chefsbk.app/api/...`
(Cloudflare tunnel). NOT at the Supabase IP. Use `https://chefsbk.app` as the
base for all fetch calls to API routes.

**Supabase queries:** Use `supabase` from `@chefsbook/db` for direct DB queries
(modifier pills fetch). Use `fetch('https://chefsbk.app/api/...')` for API routes.

---

## Feature overview — what the mobile user sees

On a saved recipe's detail screen (user has a `recipe_saves` row for it):

1. **Version tab row** — horizontal scrollable tab strip below the recipe header,
   above the body content. Shows: `Original` | `My Version 1` | `My Version 2`.
   Only tabs for existing versions + Original are shown.

2. **Ask Sous Chef button** — a button in the recipe header action area (same zone
   as existing share/save buttons). Chef+ only. Greyed out for Free users.

3. **Ask Sous Chef bottom sheet** — slides up from bottom. Contains:
   - Base version pill selector: `[Original]` `[V1]` `[V2]` (only shows existing)
   - When both slots full, Original pill is hidden
   - Multiline text input: "What did the Sous Chef miss?"
   - "Generate" button → calls API → shows regenerated content in a review sheet
   - Review sheet: scrollable preview of title, description, ingredients, steps
   - "Save" button at bottom of review → saves/updates the version

4. **Version actions (long press or "···" button on version tab)** — action sheet:
   - Rename
   - Save as My Recipe (promote)
   - Delete

5. **Modifier pills** — in the existing attribution row, after the original_submitter
   and shared_by pills, render up to 3 purple modifier pills showing `@username`.

---

## Implementation

### Step 1 — Add DB query calls

The query functions already exist in `packages/db/src/queries/recipes.ts`.
Confirm they are exported from `packages/db/src/index.ts`. If not, add exports.

In `apps/mobile/app/recipe/[id].tsx`, add a `useEffect` to fetch personal versions
and modifiers when the screen loads (only when user is authenticated and has saved
the recipe):

```typescript
const [personalVersions, setPersonalVersions] = useState<Recipe[]>([]);
const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
// null = showing original
const [modifiers, setModifiers] = useState<
  { modifier_user_id: string; modifier_username: string }[]
>([]);

useEffect(() => {
  if (!user || !hasSaved) return;
  loadPersonalVersions();
  loadModifiers();
}, [recipe.id, user?.id, hasSaved]);

async function loadPersonalVersions() {
  const versions = await getPersonalVersions(recipe.id, user.id);
  setPersonalVersions(versions);
}

async function loadModifiers() {
  const mods = await getRecipeModifiers(recipe.id);
  setModifiers(mods);
}
```

`hasSaved` — check how the web version determines if the user has saved the recipe,
and replicate the same check on mobile (likely from the existing recipe save state
already tracked on this screen).

### Step 2 — Displayed recipe content

When `activeVersionId` is set, render the personal version's content instead of the
original. Fetch the full version content from `personalVersions` array by ID.

```typescript
const displayedRecipe = activeVersionId
  ? personalVersions.find(v => v.id === activeVersionId) ?? recipe
  : recipe;
```

Pass `displayedRecipe` to all content-rendering sections (ingredients, steps, notes,
etc.) that currently receive `recipe`. Do not change the recipe header (title image,
author info) — always show the original's header.

### Step 3 — Version tab strip component

Create `apps/mobile/components/VersionTabStrip.tsx`:

```typescript
// Props
interface VersionTabStripProps {
  versions: Recipe[];                    // personal versions (0, 1, or 2)
  activeVersionId: string | null;        // null = original
  onSelectOriginal: () => void;
  onSelectVersion: (versionId: string) => void;
  onVersionAction: (versionId: string, action: 'rename' | 'promote' | 'delete') => void;
}
```

Layout: horizontal `ScrollView` (horizontal, showsHorizontalScrollIndicator=false).
Tab items are `TouchableOpacity` pills with:
- Active state: red border + red text (using theme red)
- Inactive: gray border + secondary text

Each version tab has a small "···" `TouchableOpacity` on its right that opens the
action sheet for that version.

Only render this component when `versions.length > 0` — don't show a single
"Original" tab by itself; that's just the default state.

### Step 4 — Ask Sous Chef button

In the recipe detail header/action area, add the Ask Sous Chef button.
Check how plan tier is verified on this screen and use the same pattern.

```typescript
{hasSaved && (
  <TouchableOpacity
    onPress={planTier === 'free' ? showUpgradePrompt : openAskSousChef}
    style={[styles.souschefButton, planTier === 'free' && styles.souschefButtonDisabled]}
  >
    <Text style={styles.souschefButtonText}>✦ Ask Sous Chef</Text>
  </TouchableOpacity>
)}
```

If Free tier: show an `Alert.alert` or `ChefsDialog` prompting upgrade. Do not open
the bottom sheet.

### Step 5 — Ask Sous Chef bottom sheet

Create `apps/mobile/components/AskSousChefSheet.tsx`.

Use the existing bottom sheet pattern on this screen (check how other sheets are
implemented — likely a `Modal` with a slide-up animated view, or a third-party
bottom sheet if already used).

**Sheet structure (top to bottom):**
1. Drag handle bar
2. Title: "Ask Sous Chef"
3. Base version pill selector row:
   - Pills: `[Original]` `[My Version 1]` `[My Version 2]`
   - Only render pills for versions that exist
   - When both V1 and V2 exist: hide Original pill
   - Active pill: red background + white text
   - Inactive pill: gray border + primary text
4. `TextInput` multiline, minHeight 100, placeholder: "What did the Sous Chef miss?"
5. "Generate" `TouchableOpacity` button (full width, red)
6. Safe area padding at bottom

**After "Generate" is tapped:**
- Disable button, show ActivityIndicator inside it
- POST to `https://chefsbk.app/api/recipes/[id]/ask-sous-chef` with auth token
- On success: replace the input view with a review view (same sheet, scrollable)
- Review view shows: Title, Description, Ingredients list, Steps list (read-only)
- "Save" button at bottom → POST or PUT to appropriate API route
- "← Edit" link to go back and refine the feedback

**Auth token:** Follow the existing pattern for authenticated API calls on mobile —
read the Supabase session token and pass as `Authorization: Bearer <token>` header.

### Step 6 — Version action handlers

```typescript
async function handleRenameVersion(versionId: string) {
  Alert.prompt(
    'Rename Version',
    'Enter a new name for this version',
    async (newTitle) => {
      if (!newTitle?.trim()) return;
      await fetch(`https://chefsbk.app/api/personal-versions/${versionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      await loadPersonalVersions();
    },
    'plain-text',
    personalVersions.find(v => v.id === versionId)?.title ?? ''
  );
}

async function handleDeleteVersion(versionId: string) {
  Alert.alert(
    'Delete Version',
    "Delete this version? This can't be undone.",
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await fetch(`https://chefsbk.app/api/personal-versions/${versionId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          // If deleted version was active, reset to original
          if (activeVersionId === versionId) setActiveVersionId(null);
          await loadPersonalVersions();
          await loadModifiers();
        },
      },
    ]
  );
}

async function handlePromoteVersion(versionId: string) {
  Alert.alert(
    'Save as My Recipe',
    'This will create a standalone recipe in your collection. The version slot will be freed.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save as My Recipe',
        onPress: async () => {
          const res = await fetch(
            `https://chefsbk.app/api/personal-versions/${versionId}/promote`,
            { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
          );
          const { promotedRecipe } = await res.json();
          // Reset to original tab
          setActiveVersionId(null);
          await loadPersonalVersions();
          await loadModifiers();
          // Navigate to the promoted recipe
          router.push(`/recipe/${promotedRecipe.id}`);
        },
      },
    ]
  );
}
```

Note: `Alert.prompt` is iOS only. For Android, use a Modal with a TextInput for
the rename flow. Check how other rename flows work on mobile in this codebase and
use the same pattern.

### Step 7 — Modifier pills on attribution row

In `apps/mobile/app/recipe/[id].tsx`, find the attribution row (where
`original_submitter` and `shared_by` pills are rendered).

After the existing pills, render modifier pills:

```typescript
{/* Modifier pills — last 3 shown, oldest-to-newest left-to-right */}
{modifiers.slice(-3).map((mod) => (
  <View key={mod.modifier_user_id} style={styles.modifierPill}>
    <Text style={styles.modifierPillText}>@{mod.modifier_username}</Text>
  </View>
))}
```

Styling — add to stylesheet:
```typescript
modifierPill: {
  backgroundColor: '#EDE9FE',  // purple-100 equivalent — use theme token if available
  borderWidth: 1,
  borderColor: '#C4B5FD',      // purple-300 equivalent
  borderRadius: 12,
  paddingHorizontal: 8,
  paddingVertical: 3,
  marginRight: 4,
},
modifierPillText: {
  color: '#5B21B6',             // purple-800 equivalent
  fontSize: 12,
  fontWeight: '500',
},
```

If `useTheme().colors` exposes a purple token, use it instead of hardcoded hex.
Check the theme definition before hardcoding.

---

## i18n — mobile locales

Add to all 5 mobile locale files. English first, then translate the others.

Locale files are at `apps/mobile/locales/*.json` (or wherever the existing files live —
check the actual path from `apps/mobile/locales/` before writing).

```json
{
  "personalVersions": {
    "askSousChef": "Ask Sous Chef",
    "askSousChefPlaceholder": "What did the Sous Chef miss? Add any corrections or extra details.",
    "generating": "Your Sous Chef is reviewing this recipe…",
    "saveVersion": "Save Version",
    "myVersion": "My Version {{number}}",
    "original": "Original",
    "rename": "Rename",
    "promote": "Save as My Recipe",
    "delete": "Delete Version",
    "deleteTitle": "Delete Version",
    "deleteMessage": "Delete this version? This can't be undone.",
    "promoteTitle": "Save as My Recipe",
    "promoteMessage": "This will create a standalone recipe in your collection. The version slot will be freed.",
    "slotsFull": "Both version slots are in use. Refine V1 or V2, or delete one to free a slot.",
    "promoted": "Recipe added to your collection",
    "planRequired": "Ask Sous Chef requires Chef plan or above"
  }
}
```

Wire through `t('personalVersions.askSousChef')` etc. in components — follow the
existing `useTranslation()` pattern from the file.

---

## Feature registry update

Add to `.claude/agents/feature-registry.md` — find the PERSONAL VERSIONS section
added by the previous session and mark mobile as complete:

| Feature | Status | Platform | Session |
|---------|--------|----------|---------|
| Personal versions (2 slots per saved recipe) | LIVE | Web + **Mobile** | [prev + this session] |
| Ask Sous Chef on saved recipe | LIVE | Web + **Mobile** | [prev + this session] |
| Modifier pills on original recipe | LIVE | Web + **Mobile** | [prev + this session] |
| Promote version to standalone recipe | LIVE | Web + **Mobile** | [prev + this session] |
| Orphan cascade on original deletion | LIVE | Web | [prev session] |

---

## Testing

### TypeScript
```bash
cd apps/mobile && npx tsc --noEmit
```
Must pass with 0 errors before wrapping up.

### Mobile UI verification (use emulator or device)

**Setup:** Ensure test account is Chef+ tier and has at least one saved public recipe.

1. Open a saved recipe — confirm version tab strip is NOT visible (no versions yet)
2. Tap "Ask Sous Chef" — confirm bottom sheet opens
3. Confirm "Original" pill is selected by default
4. Type feedback, tap "Generate" — confirm loading state, then review panel appears
5. Tap "Save" — confirm V1 tab appears in the version strip, sheet closes
6. Tap V1 tab — confirm recipe content switches to the version content
7. Tap "Original" tab — confirm content switches back to original
8. Open V1 "···" menu — confirm Rename / Save as My Recipe / Delete options
9. Rename V1 — confirm tab label updates
10. Tap "Ask Sous Chef" again with V1 selected — regenerate — save → V2 appears
11. Tap "Ask Sous Chef" with both V1 and V2 filled — confirm Original pill is hidden
12. Check attribution row on original recipe — confirm purple modifier pill with your @username
13. Delete V1 — confirm slot freed, V2 remains
14. Promote V2 — confirm it disappears from version strip, navigates to standalone recipe
15. Check modifier pill — confirm it is gone (no more versions)

**Free tier check:**
- Log in as Free user who has saved a recipe
- Confirm "Ask Sous Chef" button is absent or disabled with upgrade prompt

**Other user check:**
- Open any public recipe you have NOT saved — confirm no version strip, no Ask Sous Chef button
- Open your own recipe (not saved by another user) — confirm no version strip

### Regression checks
- Recipe detail screen loads normally for all existing recipes
- Attribution row still shows original_submitter and shared_by pills correctly
- Saving/unsaving a recipe still works
- No safe-area issues on recipe detail (existing bottom elements still correct)

---

## Build and deploy

After TypeScript passes:

```bash
# Build staging APK
cd apps/mobile
rm -f android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle
EXPO_PUBLIC_APP_VARIANT=staging npx expo run:android --variant release

# Install
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Run through the mobile UI verification above on the installed APK.

---

## Wrapup

Follow `.claude/agents/wrapup.md` fully.

In DONE.md, log:
- Mobile: VersionTabStrip component created
- Mobile: AskSousChefSheet component created
- Mobile: Integrated into recipe/[id].tsx (version state, modifiers, handlers)
- Mobile: Modifier pills added to attribution row
- Mobile: i18n personalVersions namespace added to all 5 locale files
- Mobile: Alert.prompt (iOS) + Modal TextInput (Android) for rename
- feature-registry.md updated — personal versions marked complete on both platforms
- TypeScript: 0 errors
- Staging APK built and tested
