/**
 * Localized strings for PDF cookbook templates.
 * React-pdf renders server-side — it cannot use react-i18next hooks.
 * This static lookup provides all labels in the 5 supported locales.
 */

export type BookLocale = 'en' | 'fr' | 'es' | 'it' | 'de';

export interface BookStrings {
  foreword: string;
  contents: string;
  index: string;
  ingredients: string;
  steps: string;
  notes: string;
  servings: string;
  timerPrefix: string;
  createdWith: string;
  tagline: string;
  pageLabel: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  serves: string;
}

export const BOOK_STRINGS: Record<BookLocale, BookStrings> = {
  en: {
    foreword: 'Foreword',
    contents: 'Contents',
    index: 'Index',
    ingredients: 'Ingredients',
    steps: 'Steps',
    notes: 'Notes',
    servings: 'servings',
    timerPrefix: '',
    createdWith: 'Created with ChefsBook',
    tagline: 'Your recipes, beautifully collected.',
    pageLabel: 'Page',
    prepTime: 'Prep',
    cookTime: 'Cook',
    totalTime: 'Total',
    serves: 'Serves',
  },
  fr: {
    foreword: 'Avant-propos',
    contents: 'Table des matières',
    index: 'Index',
    ingredients: 'Ingrédients',
    steps: 'Étapes',
    notes: 'Notes',
    servings: 'portions',
    timerPrefix: '',
    createdWith: 'Créé avec ChefsBook',
    tagline: 'Vos recettes, magnifiquement rassemblées.',
    pageLabel: 'Page',
    prepTime: 'Préparation',
    cookTime: 'Cuisson',
    totalTime: 'Total',
    serves: 'Pour',
  },
  es: {
    foreword: 'Prólogo',
    contents: 'Índice',
    index: 'Índice',
    ingredients: 'Ingredientes',
    steps: 'Pasos',
    notes: 'Notas',
    servings: 'porciones',
    timerPrefix: '',
    createdWith: 'Creado con ChefsBook',
    tagline: 'Tus recetas, bellamente reunidas.',
    pageLabel: 'Página',
    prepTime: 'Preparación',
    cookTime: 'Cocción',
    totalTime: 'Total',
    serves: 'Porciones',
  },
  it: {
    foreword: 'Prefazione',
    contents: 'Sommario',
    index: 'Indice',
    ingredients: 'Ingredienti',
    steps: 'Procedimento',
    notes: 'Note',
    servings: 'porzioni',
    timerPrefix: '',
    createdWith: 'Creato con ChefsBook',
    tagline: 'Le tue ricette, meravigliosamente raccolte.',
    pageLabel: 'Pagina',
    prepTime: 'Preparazione',
    cookTime: 'Cottura',
    totalTime: 'Totale',
    serves: 'Porzioni',
  },
  de: {
    foreword: 'Vorwort',
    contents: 'Inhalt',
    index: 'Register',
    ingredients: 'Zutaten',
    steps: 'Zubereitung',
    notes: 'Hinweise',
    servings: 'Portionen',
    timerPrefix: '',
    createdWith: 'Erstellt mit ChefsBook',
    tagline: 'Deine Rezepte, wunderschön gesammelt.',
    pageLabel: 'Seite',
    prepTime: 'Vorbereitung',
    cookTime: 'Kochen',
    totalTime: 'Gesamt',
    serves: 'Portionen',
  },
};

export function getStrings(locale: BookLocale | string): BookStrings {
  if (locale in BOOK_STRINGS) {
    return BOOK_STRINGS[locale as BookLocale];
  }
  return BOOK_STRINGS.en;
}
