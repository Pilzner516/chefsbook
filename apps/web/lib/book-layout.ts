/**
 * BookLayout — the complete structure of a printed cookbook.
 * Stored as JSONB in printed_cookbooks.book_layout.
 * Version field allows future schema migrations.
 *
 * ARCHITECTURE NOTE:
 * This module defines the data model for the visual canvas editor at /dashboard/print-cookbook.
 * The BookLayout is a JSON structure that describes every page of the book:
 * - Cover, foreword, TOC, recipes, index, back page
 * - Each recipe can have multiple pages (image, content, custom)
 * - Cards can be reordered via drag-and-drop (except locked cards)
 * - The language field controls all auto-generated labels (TOC, Index, section headers)
 */

export type BookLocale = 'en' | 'fr' | 'es' | 'it' | 'de';

export interface BookLayout {
  version: 1;
  language: BookLocale;
  cards: BookCard[];
}

/**
 * A BookCard represents one section of the book.
 * Cards are ordered in the array = order in the book.
 * Some cards are locked (cannot be moved or deleted).
 */
export type BookCard =
  | CoverCard
  | ForewordCard
  | TocCard
  | RecipeCard
  | IndexCard
  | BackCard;

export interface CoverCard {
  id: string;
  type: 'cover';
  locked: true;
  image_url?: string;
  title: string;
  subtitle?: string;
  author: string;
  cover_style: string; // template ID (e.g., 'classic', 'modern', 'bbq')
}

export interface ForewordCard {
  id: string;
  type: 'foreword';
  locked: false;
  text?: string; // max 1000 chars
}

export interface TocCard {
  id: string;
  type: 'toc';
  locked: false;
  auto: true;
}

export interface RecipeCard {
  id: string;
  type: 'recipe';
  locked: false;
  recipe_id: string;
  display_name: string; // user-editable name for the book (defaults to recipe title)
  image_urls: string[]; // available photos from recipe_user_photos for this recipe
  pages: RecipePage[];
}

/**
 * A RecipePage is one physical page within a recipe's section.
 * Pages are ordered within their card and can be reordered by the user.
 */
export type RecipePage = ImagePage | ContentPage | CustomPage;

export interface ImagePage {
  id: string;
  kind: 'image';
  image_url?: string; // selected from recipe_user_photos; if empty, use styled placeholder
}

export interface ContentPage {
  id: string;
  kind: 'content';
  part: 1 | 2; // most recipes = 1; long recipes may need 2 content pages
}

export interface CustomPage {
  id: string;
  kind: 'custom';
  layout: 'image_only' | 'text_only' | 'image_and_text';
  image_url?: string;
  text?: string; // max 600 chars
  caption?: string; // max 100 chars
}

export interface IndexCard {
  id: string;
  type: 'index';
  locked: false;
  auto: true;
}

export interface BackCard {
  id: string;
  type: 'back';
  locked: true;
}

/**
 * Computed page numbers for TOC and Index.
 * Re-computed on every layout change.
 */
export interface PageMap {
  [cardId: string]: number;
}

/**
 * Create a default BookLayout for a new cookbook.
 */
export function createDefaultLayout(params: {
  title: string;
  subtitle?: string;
  author: string;
  cover_style: string;
  language?: BookLocale;
}): BookLayout {
  return {
    version: 1,
    language: params.language ?? 'en',
    cards: [
      {
        id: crypto.randomUUID(),
        type: 'cover',
        locked: true,
        title: params.title,
        subtitle: params.subtitle,
        author: params.author,
        cover_style: params.cover_style,
      },
      {
        id: crypto.randomUUID(),
        type: 'foreword',
        locked: false,
        text: undefined,
      },
      {
        id: crypto.randomUUID(),
        type: 'toc',
        locked: false,
        auto: true,
      },
      // Recipe cards inserted here by the user
      {
        id: crypto.randomUUID(),
        type: 'index',
        locked: false,
        auto: true,
      },
      {
        id: crypto.randomUUID(),
        type: 'back',
        locked: true,
      },
    ],
  };
}

/**
 * Compute page numbers for every card in the layout.
 * Cover = page 1 (no printed number). TOC starts at page 2.
 * Each recipe card's page count = pages.length.
 * Index and Back follow after all recipes.
 */
export function computePageMap(layout: BookLayout): PageMap {
  const map: PageMap = {};
  let currentPage = 1;

  for (const card of layout.cards) {
    map[card.id] = currentPage;

    switch (card.type) {
      case 'cover':
        currentPage += 1;
        break;
      case 'foreword':
        currentPage += 1;
        break;
      case 'toc':
        currentPage += 1;
        break;
      case 'recipe':
        currentPage += card.pages.length;
        break;
      case 'index':
        currentPage += 1;
        break;
      case 'back':
        currentPage += 1;
        break;
    }
  }

  return map;
}

/**
 * Get total page count from a layout
 */
export function getTotalPageCount(layout: BookLayout): number {
  const pageMap = computePageMap(layout);
  const lastCard = layout.cards[layout.cards.length - 1];
  if (!lastCard) return 0;
  // Last card's page + 1 for that card's content
  return pageMap[lastCard.id] ?? 0;
}

/**
 * Create a default RecipeCard for a given recipe.
 * Determines how many content pages based on step count.
 */
export function createRecipeCard(recipe: {
  id: string;
  title: string;
  image_urls: string[];
  step_count: number;
}): RecipeCard {
  const pages: RecipePage[] = [
    {
      id: crypto.randomUUID(),
      kind: 'image',
      image_url: recipe.image_urls[0],
    },
    {
      id: crypto.randomUUID(),
      kind: 'content',
      part: 1,
    },
  ];

  // Long recipes (12+ steps) get a second content page
  if (recipe.step_count >= 12) {
    pages.push({
      id: crypto.randomUUID(),
      kind: 'content',
      part: 2,
    });
  }

  return {
    id: crypto.randomUUID(),
    type: 'recipe',
    locked: false,
    recipe_id: recipe.id,
    display_name: recipe.title,
    image_urls: recipe.image_urls,
    pages,
  };
}

/**
 * Insert a recipe card at the correct position (before Index card)
 */
export function insertRecipeCard(layout: BookLayout, card: RecipeCard): BookLayout {
  const cards = [...layout.cards];
  // Find the index card and insert before it
  const indexIdx = cards.findIndex((c) => c.type === 'index');
  if (indexIdx === -1) {
    // No index card, insert at end before back
    const backIdx = cards.findIndex((c) => c.type === 'back');
    if (backIdx === -1) {
      cards.push(card);
    } else {
      cards.splice(backIdx, 0, card);
    }
  } else {
    cards.splice(indexIdx, 0, card);
  }
  return { ...layout, cards };
}

/**
 * Remove a recipe card by id
 */
export function removeRecipeCard(layout: BookLayout, cardId: string): BookLayout {
  return {
    ...layout,
    cards: layout.cards.filter((c) => c.id !== cardId),
  };
}

/**
 * Get all recipe cards from a layout
 */
export function getRecipeCards(layout: BookLayout): RecipeCard[] {
  return layout.cards.filter((c): c is RecipeCard => c.type === 'recipe');
}

/**
 * Check if a card can be moved (not locked)
 */
export function canMoveCard(card: BookCard): boolean {
  return !card.locked;
}

/**
 * Move a card to a new position, respecting locked constraints
 */
export function moveCard(
  layout: BookLayout,
  sourceIndex: number,
  destIndex: number
): BookLayout {
  const cards = [...layout.cards];
  const card = cards[sourceIndex];

  // Cannot move locked cards
  if (card.locked) return layout;

  // Cannot move before cover (index 0) or after back (last index)
  const coverIdx = cards.findIndex((c) => c.type === 'cover');
  const backIdx = cards.findIndex((c) => c.type === 'back');

  if (destIndex <= coverIdx || destIndex >= backIdx) {
    return layout;
  }

  // Perform the move
  cards.splice(sourceIndex, 1);
  cards.splice(destIndex, 0, card);

  return { ...layout, cards };
}
