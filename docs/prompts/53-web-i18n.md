# ChefsBook — Session 53: Web Full UI Translation (i18n)
# Source: Language selector not working on web
# Target: apps/web
# Depends on: existing locale files in apps/mobile/locales/ (en/fr/es/it/de)

---

## CONTEXT

Mobile already has full UI translation via react-i18next. The web app has a language
selector that saves to user_profiles but never actually changes the displayed language.
This session wires full i18n to the web app so all UI strings translate when the user
changes language — matching mobile behaviour exactly.

Read .claude/agents/testing.md and .claude/agents/deployment.md before starting.

---

## STEP 1 — Install next-intl

```bash
cd apps/web
npm install next-intl
```

next-intl is the standard i18n library for Next.js App Router. It handles locale
routing, string translation, and server/client component support.

---

## STEP 2 — Locale files

The 5 locale JSON files already exist in `apps/mobile/locales/`:
`en.json`, `fr.json`, `es.json`, `it.json`, `de.json`

Copy them to `apps/web/locales/` (create the folder):
```bash
cp apps/mobile/locales/*.json apps/web/locales/
```

The web app may have additional strings not present in the mobile locales. Add any
missing web-specific keys to all 5 files. Web-specific namespaces to add:

```json
{
  "web": {
    "dashboard": "Dashboard",
    "recipes": "Recipes",
    "search": "Search",
    "shopping": "Shopping",
    "plan": "Meal Plan",
    "discover": "Discover",
    "techniques": "Techniques",
    "cookbooks": "Cookbooks",
    "settings": "Settings",
    "signOut": "Sign out",
    "import": "Import & Scan",
    "speak": "Speak a Recipe"
  }
}
```

---

## STEP 3 — next-intl configuration

Create `apps/web/i18n.ts`:
```ts
import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async ({locale}) => ({
  messages: (await import(`./locales/${locale}.json`)).default
}));
```

Create `apps/web/middleware.ts` (or update if exists):
```ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'fr', 'es', 'it', 'de'],
  defaultLocale: 'en',
  localeDetection: false  // we control locale via user preference, not browser
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
```

---

## STEP 4 — Read language from user preference

Unlike standard next-intl which uses URL locale segments (/fr/dashboard),
ChefsBook stores the user's language in `user_profiles.language`.

The web app should read the language from the user's profile and apply it:

```ts
// In the root layout or a server component:
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';

export default async function Layout({ children }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let locale = 'en';
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('language')
      .eq('id', user.id)
      .single();
    locale = profile?.language ?? 'en';
  }

  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

---

## STEP 5 — Language switcher wires to i18n

When the user changes language in the sidebar language selector:
1. Save to `user_profiles.language` (already done)
2. Trigger a page reload so the new locale is picked up from the server:
   ```ts
   await updateLanguagePreference(selectedLang);
   router.refresh(); // Next.js App Router refresh
   ```

The page reload is necessary because the locale is read server-side.
Show a brief loading state during the refresh.

---

## STEP 6 — Replace hardcoded strings with useTranslations()

For client components:
```tsx
import {useTranslations} from 'next-intl';

export function Sidebar() {
  const t = useTranslations('web');
  return <nav>{t('recipes')}</nav>;
}
```

For server components:
```tsx
import {getTranslations} from 'next-intl/server';

export async function Page() {
  const t = await getTranslations('web');
  return <h1>{t('dashboard')}</h1>;
}
```

Do a full pass replacing hardcoded strings across:
- Sidebar navigation labels
- Dashboard section headers
- Recipe detail section headers (Ingredients, Steps, Notes, Comments)
- Shopping list labels
- Meal plan labels
- Settings page labels
- Auth page labels
- Any other user-visible hardcoded English strings

Reuse the same translation keys already in the mobile locale files where they
exist. Add new keys to all 5 locale files for any web-specific strings.

---

## STEP 7 — Language selector UI update

The sidebar language selector currently shows all languages or a subset.
Ensure it shows exactly the 5 supported languages (same as mobile):
- 🇬🇧 English
- 🇫🇷 Français
- 🇪🇸 Español
- 🇮🇹 Italiano
- 🇩🇪 Deutsch

No other languages. No search input needed at 5 items.

---

## TESTING

After implementing, test each language:

1. Log in at chefsbk.app
2. Open Settings/sidebar → select French
3. Confirm page reloads and UI switches to French:
   - Sidebar: "Recettes", "Recherche", "Liste de courses" etc.
   - Recipe detail headers: "Ingrédients", "Étapes", "Notes"
   - Buttons: "Enregistrer", "Partager"
4. Switch back to English → UI reverts
5. Confirm language preference persists after browser refresh

Confirm with curl that the page still loads:
```bash
curl -I https://chefsbk.app/dashboard
```

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -30
pm2 restart chefsbook-web
```

Watch for build errors — next-intl requires specific Next.js configuration.
If middleware conflicts arise, check next-intl documentation for App Router setup.

---

## COMPLETION CHECKLIST

- [ ] next-intl installed in apps/web
- [ ] Locale files copied to apps/web/locales/
- [ ] Web-specific translation keys added to all 5 locale files
- [ ] i18n.ts and middleware.ts configured
- [ ] Root layout reads language from user_profiles and provides to NextIntlClientProvider
- [ ] Language selector triggers router.refresh() after saving preference
- [ ] All sidebar nav labels translated
- [ ] All major section headers translated (Ingredients, Steps, Notes etc.)
- [ ] Auth page labels translated
- [ ] Settings page labels translated
- [ ] Language selector shows exactly 5 languages (no others)
- [ ] Tested: French selection translates entire web UI
- [ ] Tested: switching back to English reverts correctly
- [ ] Tested: preference persists after browser refresh
- [ ] Deployed to RPi5 — build succeeded, pm2 restarted
- [ ] chefsbk.app/dashboard returns HTTP 200 after deploy
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
