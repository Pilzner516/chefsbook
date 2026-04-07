# ChefsBook — Session: QA Cleanup
# Source: Issues identified during sessions 01–06 (QA Report 2026-04-07)
# Target: apps/mobile (primary)

---

## CONTEXT

Four items that were either missed, partially implemented, or incorrectly implemented during
sessions 01–06. Fix them in order. Read CLAUDE.md before starting.

---

## FIX 1 — Full app-wide i18n translation (Session 01 · Item #22)

### What was done
The agent added a flag emoji and language code to the header to give visual feedback when a
language is selected. The preferences store saves the selection and it persists.

### What is actually needed
Selecting a language must translate the entire app UI into that language. Every visible string
in the mobile app should change.

### Implementation

1. Install dependencies if not already present:
   ```
   npx expo install react-i18next i18next
   ```

2. Create a locale directory at `apps/mobile/locales/` with one JSON file per language.
   Start with these 5 as the minimum viable set:
   - `en.json` — English (base, all keys must be present here)
   - `fr.json` — French
   - `es.json` — Spanish
   - `it.json` — Italian
   - `de.json` — German

3. Populate `en.json` with keys for every UI string in the app. Organise by screen:
   ```json
   {
     "common": {
       "save": "Save",
       "cancel": "Cancel",
       "delete": "Delete",
       "confirm": "Confirm",
       "done": "Done",
       "add": "Add",
       "edit": "Edit",
       "close": "Close",
       "search": "Search",
       "loading": "Loading...",
       "error": "Something went wrong"
     },
     "nav": {
       "recipes": "Recipes",
       "search": "Search",
       "scan": "Scan",
       "shop": "Shop",
       "plan": "Plan"
     },
     "recipe": {
       "ingredients": "Ingredients",
       "steps": "Steps",
       "notes": "Notes",
       "servings": "Servings",
       "addToList": "Add to shopping list",
       "addToPlan": "Add to meal plan",
       "favorites": "Favorites",
       "tags": "Tags",
       "autoTag": "Auto-tag",
       "addTag": "Add tag",
       "versions": "versions",
       "version": "Version",
       "addVersion": "Add version"
     },
     "shop": {
       "newList": "New shopping list",
       "allStore": "All {{store}}",
       "addItem": "Add item",
       "clearCompleted": "Clear completed",
       "selectStore": "Select store",
       "newStore": "New store...",
       "listName": "List name (optional)"
     },
     "plan": {
       "addMeal": "Add meal",
       "aiPlan": "AI Plan",
       "servings": "How many servings?",
       "breakfast": "Breakfast",
       "lunch": "Lunch",
       "dinner": "Dinner",
       "snack": "Snack"
     },
     "scan": {
       "addPage": "Add another page",
       "doneScanning": "Done scanning",
       "processing": "Processing recipe...",
       "addCoverPhoto": "Add a cover photo?",
       "skip": "Skip"
     },
     "settings": {
       "language": "Language",
       "units": "Units",
       "metric": "Metric",
       "imperial": "Imperial"
     },
     "auth": {
       "signIn": "Sign in",
       "signUp": "Create account",
       "email": "Email",
       "password": "Password",
       "name": "Your name"
     },
     "notepad": {
       "title": "QA Notepad",
       "addItem": "Add item",
       "clearAll": "Clear all notes",
       "clearConfirmTitle": "Clear all notes?",
       "clearConfirmBody": "This will permanently delete all notepad entries.",
       "export": "Export"
     }
   }
   ```

4. For `fr.json`, `es.json`, `it.json`, `de.json` — use Claude to generate translations of all
   keys from `en.json`. Do not leave any key untranslated (use the English value as a fallback
   only if absolutely necessary, and flag it with a `// TODO` comment in the file).

5. Create `apps/mobile/lib/i18n.ts`:
   ```ts
   import i18n from 'i18next';
   import { initReactI18next } from 'react-i18next';
   import en from '../locales/en.json';
   import fr from '../locales/fr.json';
   import es from '../locales/es.json';
   import it from '../locales/it.json';
   import de from '../locales/de.json';

   i18n.use(initReactI18next).init({
     resources: { en: { translation: en }, fr: { translation: fr },
                  es: { translation: es }, it: { translation: it },
                  de: { translation: de } },
     lng: 'en',
     fallbackLng: 'en',
     interpolation: { escapeValue: false },
   });

   export default i18n;
   ```

6. Import and initialise in `apps/mobile/app/_layout.tsx`:
   ```ts
   import '../lib/i18n';
   ```

7. Wire the preferences store to i18n — when `language` changes in the Zustand preferences
   store, call `i18n.changeLanguage(newLang)`. Add this in the preferences store action or in a
   `useEffect` in the root layout that watches the language preference.

8. Replace hardcoded strings throughout the app with `useTranslation()`:
   ```ts
   import { useTranslation } from 'react-i18next';
   const { t } = useTranslation();
   // Usage:
   <Text>{t('common.save')}</Text>
   ```
   Prioritise high-visibility strings: tab bar labels, recipe detail section headers, shopping
   list actions, meal plan buttons, auth screen labels. Do a full pass — do not leave any
   user-visible hardcoded English string unreplaced.

9. The language selector bottom sheet already saves to the preferences store. Ensure it also
   calls `i18n.changeLanguage(selectedLang)` immediately on confirm so the UI updates without
   requiring an app restart.

**Verify:** Select French → entire app UI switches to French including tab bar, recipe detail
headers, buttons, and action labels. Switch back to English → reverts correctly.

---

## FIX 2 — Shopping list button uses dynamic safe area inset (Session 02 · Item #19)

### What was done
A hardcoded `marginBottom` was added to the "New Shopping List" button.

### Fix
Replace the hardcoded margin with `useSafeAreaInsets()`:

```ts
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();
// Apply to the button container:
style={{ marginBottom: insets.bottom + 16 }}
```

Locate the shopping list screen's add button and apply this pattern. Remove the hardcoded value.

**Verify:** Button is fully visible and tappable on both gesture-navigation (large inset) and
3-button navigation (small inset) Android devices.

---

## FIX 3 — plan.tsx modal safe area (Session 02 · Audit flag)

### What was flagged
Two modal bottom issues in `plan.tsx` were identified during the safe area audit but not fixed:
- Recipe picker modal footer
- Shopping list picker modal footer

### Fix
Apply `useSafeAreaInsets()` → `insets.bottom` to the bottom action area of both modals in
`plan.tsx`, using the same pattern as Fix 2 above.

**Verify:** Open meal plan → "Add meal" → recipe picker modal — confirm button is above Android
nav bar. Same for the shopping list picker modal.

---

## FIX 4 — Store logos: update to logo.dev API (Session 03)

### What was done
`StoreAvatar` uses `https://logo.clearbit.com/` URLs which are no longer reliable (Clearbit was
acquired and rebranded as logo.dev).

### Fix

1. In `StoreAvatar` (and wherever `KNOWN_STORE_LOGOS` map is defined), update all logo URLs
   from:
   ```
   https://logo.clearbit.com/wholefoodsmarket.com
   ```
   to:
   ```
   https://img.logo.dev/wholefoodsmarket.com?token=pk_EXpCeGY3QxS0VKVRKTr_pw
   ```

2. Update the base URL construction for any dynamic logo lookups (not just the hardcoded map)
   to use the same `https://img.logo.dev/[domain]?token=pk_EXpCeGY3QxS0VKVRKTr_pw` pattern.

3. The API key `pk_EXpCeGY3QxS0VKVRKTr_pw` is a publishable key — safe to include in client
   code. Store it as a constant in the `StoreAvatar` file or in `apps/mobile/lib/constants.ts`.

4. Clear any cached logo URLs in AsyncStorage so stale Clearbit URLs are not served from cache.
   On first load after this fix, the cache miss will trigger a fresh logo.dev fetch.

**Verify:** Create or view a shopping list for "Whole Foods" → Whole Foods logo loads correctly
from logo.dev. Create a list for an unknown store → initials badge renders as fallback.

---

## COMPLETION CHECKLIST

Before wrapping:
- [ ] i18n installed and initialised in root layout
- [ ] `en.json` complete with all UI strings
- [ ] `fr.json`, `es.json`, `it.json`, `de.json` fully translated
- [ ] All user-visible hardcoded strings replaced with `t()` calls
- [ ] Language selection triggers immediate UI translation without restart
- [ ] Language preference persists across app restarts
- [ ] Shopping list button uses `insets.bottom` (not hardcoded margin)
- [ ] Both plan.tsx modals (recipe picker + shopping list picker) have correct bottom insets
- [ ] StoreAvatar updated to logo.dev URLs with API key
- [ ] Stale Clearbit cache cleared from AsyncStorage
- [ ] No TypeScript errors introduced
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
