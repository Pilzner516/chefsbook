import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';

const LOCALES: Record<string, () => Promise<any>> = {
  fr: () => import('../locales/fr.json'),
  es: () => import('../locales/es.json'),
  it: () => import('../locales/it.json'),
  de: () => import('../locales/de.json'),
};

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export async function activateLanguage(lang: string) {
  if (lang === 'en') {
    i18n.changeLanguage('en');
    return;
  }
  if (!i18n.hasResourceBundle(lang, 'translation')) {
    const loader = LOCALES[lang];
    if (loader) {
      const mod = await loader();
      i18n.addResourceBundle(lang, 'translation', mod.default ?? mod, true, true);
    }
  }
  i18n.changeLanguage(lang);
}

export default i18n;
