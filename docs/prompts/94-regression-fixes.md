# ChefsBook — Session 94: Regression Fixes
# Source: Live review — features that were working are now broken
# Target: apps/web + apps/mobile
# Priority: REGRESSIONS ONLY — do not add new features in this session

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching a single file.

This session fixes features that were previously working and have regressed.
For each fix: find the root cause, fix it properly, verify it works.
Do NOT patch around the problem — find and fix the actual cause.

After fixing each item, update feature-registry.md with the current status.

---

## FIX 1 — Comments not showing on all recipe pages

Comments should appear on EVERY recipe detail page. Currently they only
show on some recipes.

Investigate:
- Check if comments query is filtering by something that excludes most recipes
- The session 92 fix changed visibility to IN ('public','shared_link') —
  verify this did not break the comments join or query
- Check recipe_comments RLS — can the current user read comments on
  recipes they did not create?
- Verify the RecipeComments component renders even when comment count = 0
  (empty state should show "Be the first to comment" not disappear entirely)

Fix: every recipe detail page must show a comments section regardless of
whether it has comments. The empty state must be visible and inviting.

---

## FIX 2 — Notification bell position wrong

The notification bell should be to the LEFT of the "Add Recipe" button
in the top header of the dashboard. It is currently on the wrong side.

Find the dashboard layout header component in apps/web and correct the
order of elements. The bell was correctly positioned in session 77 —
check what changed it.

---

## FIX 3 — Onboarding bubbles not working

This was a major feature (session 65). It must work for new accounts.

Check:
1. Is OnboardingOverlay actually mounted in the dashboard layout?
2. Is useOnboarding() hook reading/writing onboarding_seen_pages correctly?
3. Does the migration 025 table exist on RPi5? Run: \d onboarding_seen_pages
4. Is the Help Tips toggle in settings correctly wired to reset seen pages?
5. Do bubbles appear on a fresh account that has never seen them?

Fix all broken parts. Bubbles must appear for new users on first visit
to each of the 6 pages (dashboard, recipe, scan, shop, plan, settings).
The settings toggle must enable/disable and reset them correctly.

---

## FIX 4 — Metric/Imperial toggle does nothing

The kg/lb unit toggle in the web sidebar used to convert units across
recipe detail and shopping list. It is now non-functional.

Check:
- Is preferencesStore still wired to the toggle?
- Is unitConversion.ts being called where it should be?
- Did any recent session change the sidebar and break the toggle handler?

Fix: toggle must convert units in recipe ingredient quantities and
shopping list quantities. Uses unitConversion.ts in packages/ui —
never duplicate conversion logic.

---

## FIX 5 — Language selector broken + showing more than 5 languages

The language selector must show ONLY these 5 languages:
English, French, Spanish, Italian, German (en/fr/es/it/de)

It was restricted to 5 in session 09 and must never show more.

Check:
- LanguagePickerModal on mobile — is it filtered to 5?
- Language dropdown on web settings — is it filtered to 5?
- Is activateLanguage() still wired to preferencesStore.setLanguage()?
- Does switching language actually translate the UI instantly?

Fix: enforce exactly 5 languages in both mobile and web selectors.
Verify translation actually applies when a language is selected.

---

## FIX 6 — "Got an Idea?" feedback card missing + submit broken

This card (FeedbackCard component, session 69) must:
- Always be visible on the recipe list page (web: pinned at position 1 in grid; mobile: FlashList header)
- Show on accounts with zero recipes
- Submit button must post to help_requests table and show a thank-you

Check:
- Is FeedbackCard still in the recipe grid/list?
- Was it accidentally removed during a recent session?
- Does the submit handler call the correct API route?
- Does the API route use supabaseAdmin to bypass RLS?
- Does the thank-you state show after successful submit?

Fix all broken parts. The card must always be visible and functional.

---

## FIX 10 — Adding public recipe to "My Recipes" fails silently

When a non-owner views a public/shared_link recipe, they see a
"Save to my ChefsBook" sticky bar. Tapping it should clone the recipe
to their account. It is not working.

Check:
- Is cloneRecipe() in packages/db working correctly?
- Does the API route that handles the clone use the authenticated user's
  session correctly?
- Is there an RLS issue preventing the insert?
- Does the success state show after cloning?

Fix: any authenticated user must be able to save a public or shared_link
recipe to their own collection. Verify the cloned recipe appears in
their My Recipes list after saving.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Only restart PM2 if build exits with code 0.

---

## COMPLETION CHECKLIST

- [ ] Comments visible on ALL recipe detail pages, empty state shown when no comments
- [ ] Notification bell to the LEFT of Add Recipe button in header
- [ ] Onboarding bubbles appear for new accounts on first visit to each page
- [ ] Help Tips toggle in settings works (enable/disable/reset)
- [ ] Metric/Imperial toggle converts units in recipes and shopping list
- [ ] Language selector shows exactly 5 languages, switching applies instantly
- [ ] "Got an Idea?" card visible on recipe list even with zero recipes
- [ ] Feedback card submit posts to help_requests and shows thank-you
- [ ] Save to My Recipes (clone) works for public/shared_link recipes
- [ ] feature-registry.md updated with current status of all fixed features
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5 — all pages return 200
- [ ] Run /wrapup
