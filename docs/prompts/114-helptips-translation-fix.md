# ChefsBook — Session 114: Help Tips Regression + Language Translation Fix
# Items 9, 10: onboarding bubbles not showing, translation only applies to menu
# Target: apps/web + apps/mobile

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, ui-guardian.md, data-flow.md
and ALL mandatory agents per SESSION START sequence before touching anything.

Two regression fixes. Diagnose with real evidence before touching code.
Do NOT assume anything is working — verify every step.

---

## FIX 1 — Help Tips (onboarding bubbles) not showing

The onboarding bubble system (session 65) is not displaying bubbles for
any user. The Settings toggle engages with a confirmation message but
bubbles never appear.

### Required behaviour
- New accounts: bubbles appear automatically on first visit to each of
  the 6 pages (dashboard, recipe, scan, shop, plan, settings)
- Returning users who reset: same behaviour after reset
- The toggle in settings must visually show ON/OFF state clearly
  (not just a white pill — see toggle style fix below)

### Diagnose
1. SSH to RPi5 and check the onboarding_seen_pages table exists:
```sql
\d onboarding_seen_pages;
SELECT * FROM onboarding_seen_pages LIMIT 5;
```

2. Check if OnboardingOverlay is mounted in the dashboard layout:
   Read apps/web/app/dashboard/layout.tsx — is OnboardingOverlay present?

3. Check useOnboarding() hook:
   - Does it correctly read onboarding_seen_pages from DB?
   - Does it correctly determine which pages have NOT been seen?
   - Is there a condition that prevents bubbles from showing?

4. Check the data-onboard attributes:
   - Are `data-onboard` attributes still present on sidebar nav items?
   - Did any recent sidebar changes (sessions 87-110) remove them?

5. Test with a fresh account:
   - Create a test account, log in, navigate to dashboard
   - Do bubbles appear?
   - Check browser console for errors

### Toggle style fix

The Settings Help Tips toggle must clearly show its state:
- ON state: toggle switch slides to the right, green/red background
- OFF state: toggle switch slides to the left, grey background
- Replace the current white pill button with a proper toggle switch
  component that changes visual state
- Use Trattoria theme colors — never hardcode hex
- Label: "Help Tips" with ON/OFF text or icon next to it

### Fix
Based on diagnosis, fix the root cause. Do not patch — find why
bubbles are not mounting or not visible and fix it properly.

---

## FIX 2 — Language translation only applies to menu, not content

Switching language translates the sidebar nav and UI labels but
recipe content (ingredients, notes, steps, comments) does not translate.

### Clarification on what should translate

There are TWO translation systems in ChefsBook:

**System A — UI translation (react-i18next)**
Translates: nav labels, buttons, settings, page titles, error messages
Does NOT translate: recipe content (this is correct)

**System B — Recipe content translation (Claude API)**
Translates: recipe title, ingredients, steps, notes
Triggered: when user switches language AND views a recipe
Cached in: recipe_translations table

### The bug
System B (recipe content translation) is not triggering when the user
switches language. The recipe detail page is not calling translateRecipe()
or not displaying the cached translation.

### Diagnose
1. Read the recipe detail page (web + mobile) — find where it checks
   the user's preferred_language and fetches/applies translations
2. Check getRecipeTranslation() in packages/db — does it query correctly?
3. Check if translateRecipe() is being called when language ≠ 'en'
4. Check recipe_translations table on RPi5:
```sql
SELECT recipe_id, language, created_at FROM recipe_translations LIMIT 10;
```
5. Is the "Translating…" pill showing while translation happens?
6. Is the translated content being rendered or is the original always shown?

### Fix
Ensure the recipe detail page:
1. Reads current user language from preferencesStore or user_profiles
2. If language ≠ 'en': checks recipe_translations for a cached translation
3. If cached: displays translated title/ingredients/steps/notes
4. If not cached: calls translateRecipe() (Claude Sonnet), shows "Translating…"
   pill, saves to recipe_translations, then displays
5. If language = 'en': always shows original content

Apply the fix on BOTH web and mobile recipe detail.

Note: comments are NOT translated — only recipe content.
Note: this uses Claude Sonnet — check ai-cost.md, cost is ~$0.011/translation.
Translations are cached per recipe+language — only charged once per recipe.

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

- [ ] onboarding_seen_pages table confirmed on RPi5
- [ ] OnboardingOverlay confirmed mounted in dashboard layout
- [ ] data-onboard attributes confirmed on sidebar nav items
- [ ] Bubbles appear for a fresh/reset account on first visit
- [ ] Bubbles appear on all 6 pages: dashboard, recipe, scan, shop, plan, settings
- [ ] Settings Help Tips toggle is a proper ON/OFF switch with visual state change
- [ ] Toggle ON → bubbles enabled; Toggle OFF → bubbles disabled
- [ ] Recipe content translates when language is changed (web)
- [ ] Recipe content translates when language is changed (mobile)
- [ ] "Translating…" pill shows while in progress
- [ ] Translation cached in recipe_translations — not re-translated on revisit
- [ ] English always shows original content
- [ ] Comments are NOT translated (correct — leave as-is)
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
