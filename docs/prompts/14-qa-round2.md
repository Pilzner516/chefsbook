# ChefsBook — Session: QA Round 2 Fixes
# Source: QA Report 2026-04-07 (second pass)
# Target: apps/mobile

---

## CRITICAL: READ THIS BEFORE WRITING ANY CODE

The single most recurring bug across all ChefsBook mobile sessions is **buttons and inputs
rendered below the Android system navigation bar**, making them unreachable. This is a
systemic issue, not a one-off.

**The rule that must apply to every screen, modal, bottom sheet, and wizard step:**

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();
// Apply to any bottom-positioned element:
paddingBottom: insets.bottom + 16   // for scroll containers
marginBottom: insets.bottom + 16    // for fixed buttons
bottom: insets.bottom + 24          // for FABs
```

**Before fixing anything else in this session, do a full audit of every screen you touch
and apply this pattern.** Do not leave any screen with a hardcoded bottom value or no
bottom inset compensation.

After this session, add the following to the top of CLAUDE.md under a new
"## Non-Negotiable UI Rules" section:

```
ANDROID SAFE AREA — MANDATORY ON EVERY SCREEN
Every bottom-positioned UI element (buttons, inputs, FABs, modal footers, wizard
navigation, bottom sheets, pin pickers, action sheets) MUST use useSafeAreaInsets()
from react-native-safe-area-context. Never use hardcoded bottom margins or padding.
Apply: paddingBottom: insets.bottom + 16 to all scroll containers and modal footers.
This rule applies to every new screen and every screen touched during a session.
```

---

## FIX 1 — Remove "Staging" pill from header (Item 5)

**Symptom:** A green pill with white text reading "Staging" is showing next to the ChefsBook
logo in the recipe detail header (and possibly other headers).

**Fix:**
1. Search the entire `apps/mobile` codebase for the string "staging" (case-insensitive).
2. Find where this pill/badge is rendered — likely a conditional based on an environment
   variable (e.g. `process.env.APP_ENV === 'staging'` or similar).
3. Remove it entirely. Do not gate it behind a flag — remove the component and the
   conditional check completely.
4. Confirm it does not appear on any screen after removal.

**This pill is also the cause of Item 3** — it is taking up header space and pushing the
kg/lb unit toggle off screen to the right.

**Verify:** Header shows only ChefsBook logo + language flag + kg/lb toggle, correctly
spaced with no overflow.

---

## FIX 2 — Safe area: Store input modal (Item 1)

**Symptom:** When creating a new shopping list, the store input section is below the Android
navigation buttons and inaccessible.

**Fix:** Apply mandatory safe area pattern (see top of prompt) to the new shopping list
modal. Specifically:
- The modal's scroll container needs `contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}`
- The confirm/create button at the bottom of the modal needs `marginBottom: insets.bottom + 16`

---

## FIX 3 — Safe area: AI Meal Plan Wizard (Item 2)

**Symptom:** Every screen in the AI Meal Plan Wizard (Days & Meals → Preferences → Sources →
Review) has navigation/confirm buttons below the Android nav bar.

**Fix:** Apply mandatory safe area pattern to every step of the `MealPlanWizard` component:
- The wizard's bottom navigation bar (Back/Next/Save buttons) needs `paddingBottom: insets.bottom + 16`
- Each step's scroll container needs `contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}` (80px to clear the wizard nav bar)
- The Review step's "Save Plan" button specifically needs `marginBottom: insets.bottom + 16`

---

## FIX 4 — Safe area: Pin picker (Item 7)

**Symptom:** The pin selection UI drops below the Android navigation buttons when pinning
a recipe.

**Fix:** Locate the pin picker component or bottom sheet. Apply the mandatory safe area
pattern to its footer/action area.

---

## FIX 5 — Language translation still not working (Item 4)

**Symptom:** Changing language to French does not translate the app UI despite session 08
claiming to implement react-i18next.

**Investigation — check each of these in order:**

1. **Is i18n actually initialised?** Check `apps/mobile/app/_layout.tsx` for
   `import '../lib/i18n'` at the top. If missing, add it.

2. **Is `changeLanguage()` actually being called?** Add a `console.log` to the language
   selector confirm handler:
   ```ts
   console.log('Changing language to:', selectedLang);
   await i18n.changeLanguage(selectedLang);
   console.log('Current language after change:', i18n.language);
   ```
   Check Metro logs to confirm it fires and the language actually changes.

3. **Are components using `useTranslation()`?** Pick one component that should translate
   (e.g. the tab bar). Check if it imports `useTranslation` and uses `t('nav.recipes')`
   etc. If it still has hardcoded strings, the replacement wasn't done.

4. **Are the locale files valid JSON?** Run:
   ```bash
   node -e "require('./apps/mobile/locales/fr.json')" && echo "valid"
   ```
   A syntax error in the JSON silently breaks the whole i18n system.

5. **Is the preferences store triggering `changeLanguage`?** Find where the language
   preference is saved and confirm `i18n.changeLanguage()` is called immediately after,
   not just on next app launch.

Fix whatever the investigation reveals. The end state must be: selecting French from the
language picker immediately changes all UI labels to French without restart.

---

## FIX 6 — Pexels returning no photos (Item 6)

**Symptom:** "Find a photo" returns "no photo found" for every recipe.

**Investigation:**

1. Find the Pexels API call. Add logging:
   ```ts
   console.log('Pexels search query:', query);
   console.log('Pexels response status:', response.status);
   console.log('Pexels response body:', JSON.stringify(data));
   ```

2. Check for these common failure causes:
   - **Missing API key:** `Authorization` header not set or env var `PEXELS_API_KEY` not
     loaded in the mobile app. Mobile apps need env vars in `app.json` under
     `expo.extra` or via `react-native-dotenv` — `process.env` alone does not work in
     Expo without configuration.
   - **Wrong endpoint:** Confirm the URL is `https://api.pexels.com/v1/search` not
     `/v1/photos/search` or any other variant.
   - **Empty query:** If `recipe.title` is undefined or empty at the time of the call,
     Pexels returns 0 results. Log the query string before the API call.
   - **CORS / network:** Pexels blocks requests without a valid `Authorization` header —
     a 403 response would show `photos: []`.

3. **Expo env var setup** — if the API key is the issue, wire it correctly:
   In `app.json`:
   ```json
   {
     "expo": {
       "extra": {
         "pexelsApiKey": "YOUR_KEY_HERE"
       }
     }
   }
   ```
   In code:
   ```ts
   import Constants from 'expo-constants';
   const PEXELS_KEY = Constants.expoConfig?.extra?.pexelsApiKey;
   ```

Fix the root cause. The end state: searching for a recipe titled "Chocolate Cake" returns
3 relevant food photos in the picker.

---

## FULL SAFE AREA AUDIT

While working through fixes 1–4, audit ALL screens and modals in the app for the same
safe area issue. For every screen you open in the codebase:
- Check if any bottom-positioned element lacks `insets.bottom`
- If found, fix it in the same session
- Log what you fixed in DONE.md

Do not leave any known safe area violation unfixed after this session.

---

## COMPLETION CHECKLIST

- [ ] "Staging" pill removed from all headers
- [ ] kg/lb toggle visible and correctly positioned after pill removal
- [ ] New store modal: input and confirm button above Android nav bar
- [ ] AI Meal Plan Wizard: all step buttons above Android nav bar
- [ ] Pin picker above Android nav bar
- [ ] Language selector: French (and other languages) translate UI immediately
- [ ] Pexels: root cause identified and fixed, photos return for recipe searches
- [ ] CLAUDE.md updated with mandatory Android safe area rule
- [ ] Full safe area audit completed — no remaining violations
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
