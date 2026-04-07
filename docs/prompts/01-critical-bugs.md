# ChefsBook — Session: Critical Bug Fixes
# Source: QA Report 2026-04-07 · Items 6, 11, 12, 14, 15, 16, 21, 22
# Target: apps/mobile (primary), apps/web (where noted)

---

## CONTEXT

Fix 8 confirmed bugs found during QA on the mobile app. Work through them in the order listed below — each is independent and must not break adjacent functionality. Read CLAUDE.md before starting. Do not refactor anything outside the scope of each fix.

---

## BUG 1 — Recipe save fails when editing title (Item 6)

**Symptom:** Saving a recipe after editing the title throws an error related to `dietary_restrictions` column.

**Investigation steps:**
1. Locate the recipe edit save handler in `apps/mobile` (likely in a recipe detail screen or store action).
2. Find where the PATCH/upsert payload is constructed for a recipe update.
3. Identify if `dietary_restrictions` is being sent as `undefined` or an unexpected type when the user has only edited the `title` field.

**Fix:**
- Ensure the save payload only includes fields that are present and valid.
- `dietary_restrictions` should default to its existing DB value if not explicitly changed — never send `undefined` or `null` unless the user cleared it.
- Apply a safe default (e.g. `[]` or `null`) if the column expects a specific type and the value is missing.
- Confirm no other columns have the same issue by auditing the full save payload.

**Verify:** Edit only the title of a recipe → save → no error → recipe title updated in DB.

---

## BUG 2 — App requires sign-in on every launch (Item 11)

**Symptom:** User must sign in each time they open the app. Session is not persisted.

**Investigation steps:**
1. Check how the Supabase session is being initialized on app launch (likely in `_layout.tsx` or `AuthProvider`).
2. Check if `supabase.auth.getSession()` is being called on mount to restore a cached session.
3. Check if the session token is being stored in `SecureStore` or equivalent persistent storage, or if it's only in memory.

**Fix:**
- On app launch, call `supabase.auth.getSession()` and use the result to restore the user session without prompting sign-in.
- If using `supabase-js` v2, confirm `AsyncStorage` or `SecureStore` is wired as the storage adapter in the Supabase client constructor in `@chefsbook/db`. This is the most common cause of this issue.
- The `useProtectedRoute()` hook should wait for session resolution before redirecting — add a loading state if not present.

**Verify:** Sign in → close app completely → reopen → user is already signed in, no sign-in screen shown.

---

## BUG 3 — Empty meal plan week shows no day cards, no way to add (Item 12)

**Symptom:** When a week has no planned meals, no day cards render, leaving no UI affordance to add meals.

**Investigation steps:**
1. Find the meal plan week view component in `apps/mobile`.
2. Check if day cards are derived from existing `meal_plans` rows — if so, empty weeks produce zero cards.

**Fix:**
- Day cards for Mon–Sun must always render for the selected week, regardless of whether any meals exist for those days.
- Generate the 7-day card list from the week date range, not from DB rows.
- Each empty day card shows an "Add meal" button or a `+` tap target.

**Verify:** Navigate to a week with no meals → 7 day cards render → tapping a day card opens the meal add flow.

---

## BUG 4 — Favorites button requires extra tap to filter (Item 14)

**Symptom:** Tapping the Favorites button shows a secondary prompt ("show just favorites") instead of immediately filtering to favorites.

**Fix:**
- The Favorites button in the recipe list/search view should directly apply the favorites filter on first tap.
- Remove the intermediate confirmation or sub-option step.
- Toggle behavior is acceptable: first tap = show favorites only, second tap = clear filter.

**Verify:** Tap Favorites → recipe list immediately filters to favorited recipes only.

---

## BUG 5 — App icon is blank (Item 15)

**Symptom:** The app icon on the Android home screen and drawer is blank/white instead of showing the ChefsBook chef's hat logo.

**Fix:**
1. Locate `app.json` → `expo.icon` field. Confirm it points to a valid image file (e.g. `./assets/icon.png`).
2. Confirm the referenced image file exists, is a valid PNG, and is at least 1024×1024px (Expo requirement).
3. If the file is missing or wrong, replace it with the chef's hat asset already used on the landing page.
4. Also check `expo.android.adaptiveIcon.foregroundImage` for Android-specific icon.
5. After fixing, run `npx expo prebuild --clean` to regenerate native assets.

**Verify:** Build and install APK → app icon shows chef's hat on home screen.

---

## BUG 6 — Three dots visible below tagline on landing page (Item 16)

**Symptom:** Three decorative dots appear below the tagline text on the mobile landing/splash screen and should not be there.

**Fix:**
1. Find the landing page component (`apps/mobile/app/index.tsx` or similar).
2. Locate and remove the three-dot element (likely a `<Text>` with `...` or a pagination-style dot row component, or leftover from a swiper/carousel).

**Verify:** Landing page renders without any dots below the tagline.

---

## BUG 7 — Dry ingredients converting to ml when metric is selected (Item 21)

**Symptom:** Dry ingredients (e.g. flour, sugar) are being converted to `ml` when the user switches to metric, instead of staying in weight units (`g`, `kg`).

**Investigation steps:**
1. Find the unit conversion logic — likely in a `convertUnit()` or `convertIngredient()` utility in `@chefsbook/shared` or within the mobile app.
2. Find where dry vs. liquid classification is determined.

**Fix:**
- Dry ingredients must convert to weight units: `tsp/Tbsp/cup → g`, `oz → g`, `lb → kg`.
- Liquid ingredients convert to volume units: `tsp/Tbsp/cup/fl oz → ml`, `qt/pt → L`.
- The dry classification list should include at minimum: flour, sugar, salt, spices, baking powder, baking soda, cocoa, oats, rice, cornstarch, and any ingredient flagged as `dry: true`.
- Refer to the existing `isDryIngredient()` classification already present in the codebase — if it's missing or incomplete, expand it.
- This fix applies to both mobile and web (same shared utility).

**Verify:** Add a recipe with "2 cups flour" and "1 cup water" → switch to metric → flour shows in grams, water shows in ml.

---

## BUG 8 — Language selection not applying (Item 22)

**Symptom:** Selecting a new language (e.g. French) in the language selector does not change the app language.

**Investigation steps:**
1. Find the language selector bottom sheet and the handler that runs when a language is confirmed.
2. Check if the selected language is being saved to the preferences store (Zustand + SecureStore) and to Supabase `user_profiles`.
3. Check if the i18n system is reacting to the preferences store change — is there a `useEffect` or store subscription that updates the active locale?

**Fix:**
- On language select → save to preferences store → trigger locale update immediately.
- If the i18n translation files are not yet wired (stubs only), the fix is still to ensure the store updates and the UI re-renders with the correct locale key — even if most strings are still in English, the selection must persist and take effect.
- Add a `console.log` trace if helpful during dev to confirm the value is flowing through.

**Note:** Full translation content is a separate backlog item. This fix is about ensuring the plumbing works end-to-end.

**Verify:** Open language selector → select French → close → re-open selector → French is shown as selected → preference persists after app restart.

---

## COMPLETION CHECKLIST

Before wrapping:
- [ ] All 8 bugs fixed and verified
- [ ] No TypeScript errors introduced
- [ ] No regressions in adjacent screens (recipe list, shopping list, auth flow)
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
