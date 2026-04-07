import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';

// Lazy-load non-English locales to keep bundle lean
const resources: Record<string, { translation: any }> = {
  en: { translation: en },
};

const LOCALE_LOADERS: Record<string, () => Promise<any>> = {
  fr: () => import('../locales/fr.json'),
  es: () => import('../locales/es.json'),
  it: () => import('../locales/it.json'),
  de: () => import('../locales/de.json'),
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

/**
 * Load and activate a language. Call this when the user changes language.
 */
export async function activateLanguage(code: string): Promise<void> {
  if (code === 'en') {
    await i18n.changeLanguage('en');
    return;
  }
  if (!resources[code] && LOCALE_LOADERS[code]) {
    const mod = await LOCALE_LOADERS[code]();
    resources[code] = { translation: mod.default ?? mod };
    i18n.addResourceBundle(code, 'translation', resources[code].translation);
  }
  await i18n.changeLanguage(code);
}

export default i18n;
