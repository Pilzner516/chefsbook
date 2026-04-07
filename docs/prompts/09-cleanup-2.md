# ChefsBook — Session: Cleanup Pass 2
# Source: Post-session review after QA sessions 01–08
# Target: apps/mobile

---

## CONTEXT

One targeted fix identified after session 08 completed. Small scope — should be quick.
Read CLAUDE.md before starting.

---

## FIX 1 — Language selector: limit to 5 supported languages only

### Current behaviour
The language selector bottom sheet shows 28 languages. Only 5 have actual translation files
(`en`, `fr`, `es`, `it`, `de`). All other selections would silently fall back to English,
which is confusing and misleading to users.

### Fix

1. Find the language list/array in the language selector component (the bottom sheet that opens
   from the header or settings).

2. Replace the full 28-language array with exactly these 5 entries:
   ```ts
   const SUPPORTED_LANGUAGES = [
     { code: 'en', label: 'English',  flag: '🇬🇧' },
     { code: 'fr', label: 'Français', flag: '🇫🇷' },
     { code: 'es', label: 'Español',  flag: '🇪🇸' },
     { code: 'it', label: 'Italiano', flag: '🇮🇹' },
     { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
   ];
   ```

3. Remove the search input from the language selector — it is unnecessary at 5 items.
   Show all 5 as a simple flat list.

4. Remove any "priority languages" logic that was sorting or separating the list — with only
   5 options it is not needed.

### Verify
Open language selector → exactly 5 languages shown, no search bar, no other options.
Select each one → app translates correctly. Select English → reverts to English.

---

## COMPLETION CHECKLIST

- [ ] Language selector shows exactly 5 languages
- [ ] Search input removed from language selector
- [ ] Priority/sorting logic removed
- [ ] All 5 selections translate the app correctly
- [ ] No regressions in language preference persistence
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
