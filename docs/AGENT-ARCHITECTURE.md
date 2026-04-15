# ChefsBook — Agent Architecture
# Purpose: Define specialist agents to prevent recurring failure patterns
# Location: .claude/agents/

---

## PHILOSOPHY

Each agent owns a specific domain. Before writing any code it runs its pre-flight checklist.
After writing code it runs its post-flight checklist. It never touches code outside its domain
without flagging it explicitly. It reads its own AGENT.md on every session start.

Agents are not feature builders. They are domain experts who happen to build features.
The distinction matters: a feature builder stops when the feature works in isolation.
A domain expert checks that the feature works within the whole system.

---

## AGENT 1 — ui-guardian.md
### Domain: All visual UI — layout, safe area, keyboard avoidance, overflow, navigation

**Owns:**
- Every screen, modal, bottom sheet, and action sheet layout
- Android safe area insets (mandatory on every bottom-positioned element)
- Keyboard avoidance (KeyboardAvoidingView on every screen with text inputs)
- Button and text overflow (no hardcoded widths that clip on small screens)
- Navigation transitions and back-gesture behaviour
- Tab bar rendering and active states

**Pre-flight checklist (run before writing any UI code):**
```
□ List every screen this change touches
□ For each screen: does any element sit at the bottom of the screen?
  → If yes: useSafeAreaInsets() MUST be applied. No exceptions.
□ Does any screen have a text input?
  → If yes: KeyboardAvoidingView with behavior="padding" MUST wrap the screen
□ Are any buttons in a row?
  → If yes: calculate total width. Does it fit on 360px (minimum phone width)?
□ Are any strings hardcoded that could be longer in another language?
  → If yes: use numberOfLines={1} + ellipsis OR give the container flex:1
```

**Post-flight checklist (run after writing any UI code):**
```
□ Render every touched screen mentally at 360px wide (minimum Android width)
□ Render at 414px wide (iPhone Plus / large Android)
□ Check: are all buttons fully visible without scrolling?
□ Check: does opening the keyboard cover any input or button?
□ Check: does the back gesture work correctly from every new screen?
□ Check: do all new strings have i18n keys in all 5 locale files?
```

**Failure patterns this agent prevents:**
- Buttons hidden below Android nav bar (recurring × 8)
- Text wrapping mid-word in button rows (recurring × 3)
- Inputs covered by keyboard (recurring × 2)
- Missing i18n keys on new screens (recurring × 4)

---

## AGENT 2 — data-flow.md
### Domain: State management, data fetching, cache invalidation, store architecture

**Owns:**
- Zustand store actions and selectors
- useFocusEffect refresh patterns
- Recipe list, shopping list, meal plan data lifecycle
- Cache invalidation after mutations (image uploads, edits, deletes)
- Supabase query optimisation and RLS awareness
- Real-time subscription management

**Pre-flight checklist:**
```
□ What data does this feature write to the DB?
□ What screens display that data?
□ After the write, which store caches are now stale?
□ What triggers a refresh of those caches?
  → Must be: immediately after mutation OR on next screen focus via useFocusEffect
□ Is there a loading state for the fetch?
□ Is there an error state for the fetch?
```

**Post-flight checklist:**
```
□ After any write operation: navigate to the screen that shows the result
  and confirm the new data appears WITHOUT closing and reopening the app
□ After any delete: confirm the deleted item is gone from all screens that showed it
□ After any image upload: confirm recipe card, recipe detail hero, and edit gallery
  all reflect the new image immediately
□ Check: does refreshing the list screen (pull-to-refresh or focus) show correct data?
```

**Failure patterns this agent prevents:**
- Recipe card showing stale image after edit (recurring × 3)
- Shopping list not reflecting added items until app restart
- Meal plan not showing new meals after AI wizard save

---

## AGENT 3 — import-pipeline.md
### Domain: All recipe import paths — URL, scan, speak, file, Instagram, clipboard

**Owns:**
- URL scraping and JSON-LD extraction
- Camera scan + multi-page scan flow
- Claude Vision OCR prompts and response parsing
- Dish identification flow (analyseScannedImage, clarifying questions, dish options)
- Speak a Recipe voice flow
- Instagram import (share intent + manual paste)
- File import (PDF, Word, CSV)
- PostImportImageSheet
- Import routing logic (which URL goes to which handler)

**Pre-flight checklist:**
```
□ Which import paths does this change touch?
□ For each path: trace the full flow from user action to recipe saved in DB
□ Does the routing logic correctly distinguish between:
  - Instagram URLs (instagram.com/p/ or /reel/)
  - Recipe page URLs (everything else)
  - Search queries (no http:// prefix)
  - Local file URIs (file:// prefix)
□ Is the PostImportImageSheet shown after every import path that could have an image?
□ Does the scan flow correctly classify dish_photo vs recipe_document vs unclear?
```

**Post-flight checklist:**
```
□ Test each import path that was touched:
  - Paste an Instagram URL → confirm import flow starts (not search)
  - Paste a recipe URL → confirm URL import flow starts
  - Scan a recipe document → confirm existing scan flow unchanged
  - Scan a dish photo → confirm dish identification flow starts
□ After any import: confirm title, description, ingredients, steps all populated
□ Confirm PostImportImageSheet appears with correct options for each path
□ Confirm the imported recipe appears in the recipe list immediately after save
```

**Failure patterns this agent prevents:**
- Instagram paste routing to search (recurring × 2)
- Description missing after photo scan (recurring × 1)
- PostImportImageSheet not shown on some import paths
- Dish identification flow not triggering for unclear images

---

## AGENT 4 — image-system.md
### Domain: All image handling — upload, display, storage, Pexels, camera, gallery

**Owns:**
- Supabase Storage upload flow (FileSystem.uploadAsync + JWT header + apikey header)
- recipe_user_photos table operations (insert, delete, set_primary, list)
- HeroGallery component (swipeable pager, dot indicators, chef's hat fallback)
- EditImageGallery component (thumbnails, add, delete, long-press primary)
- RecipeImage component (card image with fallback)
- Pexels API integration (search, 3-image picker, pre-fetch)
- PostImportImageSheet (website image, scan image, Pexels, camera, library options)
- All Image components must use apikey header for Supabase storage URLs

**Pre-flight checklist:**
```
□ Does this change involve uploading an image?
  → Confirm: FileSystem.uploadAsync with Authorization + apikey headers
  → Confirm: supabase_storage_admin has SUPERUSER role on RPi5 (one-time, already done)
  → Confirm: public URL uses Tailscale IP 100.110.47.62, not hostname rpi5-eth
□ Does this change display an image from Supabase storage?
  → Confirm: <Image source={{ uri, headers: { apikey: SUPABASE_ANON_KEY } }} />
□ Does this change affect recipe_user_photos?
  → Confirm: recipe card, recipe detail hero, edit gallery all refreshed after change
□ Is Pexels search used?
  → Confirm: PEXELS_API_KEY loaded from expo-constants (not process.env)
  → Confirm: pre-fetched in parallel with import, not sequentially
```

**Post-flight checklist:**
```
□ Upload an image → confirm it appears in recipe detail hero immediately
□ Confirm file exists in storage.objects on RPi5 after upload
□ Confirm recipe card shows updated image without app restart
□ Confirm chef's hat shows ONLY when recipe has zero images
□ Confirm Pexels returns 3 results for a common recipe name (e.g. "chocolate cake")
□ Confirm all Image components for Supabase URLs have the apikey header
```

**Failure patterns this agent prevents:**
- Upload hanging (Tailscale IP vs hostname)
- Images not displaying after upload (missing apikey header)
- Chef's hat showing alongside real images (hero logic checking wrong field)
- Pexels returning empty (API key not loaded in mobile env)
- Recipe card stale after image edit

---

## AGENT 5 — recipe-detail.md
### Domain: Recipe detail screen — read mode, edit mode, cook mode

**Owns:**
- Recipe detail screen layout (read-only)
- Edit mode (inline editing of all fields)
- Action bar (heart, share, pin, edit — exactly these 4, no others)
- Edit menu options (Save a Copy, Add version, Delete)
- Cook Mode
- Version switcher and version indicator
- Tag management (add, remove, auto-tag multi-select)
- Unit conversion display (metric/imperial toggle)
- Language translation display (UI labels + recipe content via recipe_translations)
- Cooking notes (user annotations, separate from recipe notes)

**Pre-flight checklist:**
```
□ Does this change add or remove anything from the action bar?
  → Action bar must be exactly: heart · share · pin · edit. No additions.
□ Does this change add a new edit option?
  → Must go in the edit menu, not the action bar
□ Does this change affect how recipe content is displayed?
  → Confirm metric/imperial conversion still works
  → Confirm language translation still works (check recipe_translations cache)
□ Does this change affect the hero image area?
  → Confirm HeroGallery still renders correctly with 0, 1, and 2+ images
```

**Post-flight checklist:**
```
□ Open a recipe with images → hero shows images (not chef's hat)
□ Open a recipe with no images → chef's hat shows
□ Switch metric/imperial → ingredients update immediately
□ Switch language → UI labels AND recipe content translate
□ Edit a field → save → detail shows updated content
□ Navigate back to recipe list → card shows correct updated data
□ Action bar has exactly 4 icons: heart, share, pin, edit
```

---

## AGENT 6 — shopping-system.md
### Domain: Shopping lists — creation, store grouping, items, units, department grouping

**Owns:**
- Shopping list creation flow (store-first, name optional)
- Store grouping and concatenated list view
- StoreAvatar component (logo.dev API + initials fallback)
- List detail (department grouping, view modes, inline edit, check/delete)
- Add to shopping list from recipe (unit conversion, quantity merging)
- Meal plan day → shopping list (servings multiplier)
- Purchase unit suggestions (Claude AI)
- Font size toggle, view mode persistence

**Pre-flight checklist:**
```
□ Does this change create or modify a shopping list?
  → Confirm store_name is captured and stored
  → Confirm safe area insets on all bottom buttons in the flow
□ Does this change add items to a list?
  → Confirm addItemsWithPipeline() is used (single source of truth for web + mobile)
  → Confirm quantity merging works for duplicate ingredients
  → Confirm dry ingredients stay in weight units (g/kg), liquids in volume (ml/L)
□ Does this change display store logos?
  → Confirm logo.dev URL format: https://img.logo.dev/[domain]?token=pk_EXpCeGY3QxS0VKVRKTr_pw
  → Confirm initials fallback renders when logo unavailable
```

---

## HOW TO USE THESE AGENTS

### In Claude Code, start a session with:
```
Read .claude/agents/[agent-name].md before starting. Run the pre-flight checklist
and confirm each item before writing any code. Run the post-flight checklist before
running /wrapup.
```

### For cross-domain features (e.g. importing a recipe that needs image handling):
```
Read .claude/agents/import-pipeline.md AND .claude/agents/image-system.md before
starting. Run both pre-flight checklists. Run both post-flight checklists before /wrapup.
```

### For any new screen or UI change:
```
Read .claude/agents/ui-guardian.md before starting. Always.
```

---

## MASTER PRE-FLIGHT (run at start of every session regardless of agent)

```
□ Read CLAUDE.md fully
□ Read DONE.md to understand what was last built
□ Identify every screen this session will touch
□ Confirm: does this session touch any UI? → read ui-guardian.md
□ Confirm: does this session touch any image? → read image-system.md
□ Confirm: does this session touch any import? → read import-pipeline.md
□ Confirm: does this session touch any store/state? → read data-flow.md
□ Confirm: does this session touch recipe detail? → read recipe-detail.md
□ Confirm: does this session touch shopping? → read shopping-system.md
```

---

## MASTER POST-FLIGHT (run before every /wrapup)

```
□ Every screen touched: mentally render at 360px width. All elements visible?
□ Every bottom button: useSafeAreaInsets() applied?
□ Every text input screen: KeyboardAvoidingView applied?
□ Every mutation: corresponding cache/store invalidated?
□ Every new feature: does it work the same way on all import paths that are relevant?
□ Every new i18n string: added to all 5 locale files (en, fr, es, it, de)?
□ No console.log or console.warn left in production code?
□ TypeScript: npx tsc --noEmit passes with no errors?
```
