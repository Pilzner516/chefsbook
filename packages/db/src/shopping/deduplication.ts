import { supabase } from '../client';
import type { ShoppingListItem } from '../types';

// --- Preparation and size words to strip ---
const PREP_WORDS = [
  'fresh', 'chopped', 'minced', 'diced', 'sliced', 'grated', 'peeled',
  'roughly', 'finely', 'crushed', 'ground', 'melted', 'softened',
  'frozen', 'dried', 'toasted', 'roasted', 'shredded', 'cubed',
  'halved', 'quartered', 'torn', 'trimmed', 'deveined', 'boneless',
  'skinless', 'packed', 'sifted', 'beaten', 'whisked',
];
const SIZE_WORDS = ['large', 'small', 'medium', 'extra-large', 'jumbo', 'thin', 'thick'];

// --- Synonym map ---
const SYNONYMS: Record<string, string> = {
  'scallions': 'green onion',
  'spring onions': 'green onion',
  'spring onion': 'green onion',
  'coriander': 'cilantro',
  'aubergine': 'eggplant',
  'courgette': 'zucchini',
  'capsicum': 'bell pepper',
  'plain flour': 'all-purpose flour',
  'bicarbonate of soda': 'baking soda',
  'double cream': 'heavy cream',
  'single cream': 'light cream',
  'caster sugar': 'superfine sugar',
  'icing sugar': 'powdered sugar',
  'rocket': 'arugula',
  'prawns': 'shrimp',
  'mince': 'ground meat',
  'cornflour': 'cornstarch',
  'rapeseed oil': 'canola oil',
};

// --- Simple plurals ---
const PLURAL_MAP: Record<string, string> = {
  'tomatoes': 'tomato', 'potatoes': 'potato', 'onions': 'onion',
  'carrots': 'carrot', 'peppers': 'pepper', 'mushrooms': 'mushroom',
  'cloves': 'clove', 'lemons': 'lemon', 'limes': 'lime',
  'oranges': 'orange', 'apples': 'apple', 'eggs': 'egg',
  'bananas': 'banana', 'avocados': 'avocado', 'olives': 'olive',
  'shallots': 'shallot', 'anchovies': 'anchovy', 'berries': 'berry',
  'cherries': 'cherry', 'peaches': 'peach', 'leaves': 'leaf',
  'stalks': 'stalk', 'sprigs': 'sprig', 'strips': 'strip',
  'breasts': 'breast', 'thighs': 'thigh', 'fillets': 'fillet',
};

/**
 * Normalize an ingredient name for matching purposes.
 */
export function normalizeIngredient(name: string): string {
  let n = name.toLowerCase().trim();

  // Remove parenthetical notes like "(about 2 cups)"
  n = n.replace(/\([^)]*\)/g, '').trim();

  // Remove prep words
  for (const w of PREP_WORDS) {
    n = n.replace(new RegExp(`\\b${w}\\b`, 'g'), '');
  }
  // Remove size words
  for (const w of SIZE_WORDS) {
    n = n.replace(new RegExp(`\\b${w}\\b`, 'g'), '');
  }

  // Collapse whitespace
  n = n.replace(/\s+/g, ' ').trim();

  // Apply synonym mapping (check multi-word first)
  for (const [from, to] of Object.entries(SYNONYMS)) {
    if (n === from || n.includes(from)) {
      n = n.replace(from, to);
    }
  }

  // Singularize
  const words = n.split(' ');
  const last = words[words.length - 1]!;
  if (PLURAL_MAP[last]) {
    words[words.length - 1] = PLURAL_MAP[last]!;
    n = words.join(' ');
  } else if (last.endsWith('s') && !last.endsWith('ss') && last.length > 3) {
    words[words.length - 1] = last.slice(0, -1);
    n = words.join(' ');
  }

  return n.trim();
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

/**
 * Score how similar two ingredient names are (0-1).
 * 1.0 = exact match after normalization
 * 0.8+ = same base ingredient
 * 0.6+ = related ingredient
 */
export function ingredientMatchScore(a: string, b: string): number {
  const na = normalizeIngredient(a);
  const nb = normalizeIngredient(b);

  if (na === nb) return 1.0;

  // Check if one contains the other (e.g. "chicken breast" vs "chicken thigh" share "chicken")
  const aWords = na.split(' ');
  const bWords = nb.split(' ');
  const shared = aWords.filter(w => bWords.includes(w));
  const totalUnique = new Set([...aWords, ...bWords]).size;
  const overlapRatio = shared.length / totalUnique;

  // Levenshtein-based similarity
  const maxLen = Math.max(na.length, nb.length);
  const levSim = maxLen === 0 ? 1 : 1 - levenshtein(na, nb) / maxLen;

  // Combine: weight overlap more for multi-word ingredients
  const score = aWords.length > 1 || bWords.length > 1
    ? overlapRatio * 0.6 + levSim * 0.4
    : levSim;

  return Math.round(score * 100) / 100;
}

// --- Merge types ---

export type MergeAction = 'skip' | 'increase' | 'add' | 'confirm';

export type MergeResult = {
  action: MergeAction;
  existingItem?: ShoppingListItem;
  delta?: { quantity: number; unit: string };
  message?: string;
};

export type IncomingIngredient = {
  name: string;
  quantity: number;
  unit: string;
};

/**
 * Determine how to merge a single incoming ingredient with existing items.
 */
export function determineMergeAction(
  incoming: IncomingIngredient,
  existingItems: ShoppingListItem[],
): MergeResult {
  let bestScore = 0;
  let bestItem: ShoppingListItem | undefined;

  for (const item of existingItems) {
    const score = ingredientMatchScore(incoming.name, item.ingredient);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  // Exact match → silently increase quantity
  if (bestScore >= 1.0 && bestItem) {
    return {
      action: 'increase',
      existingItem: bestItem,
      delta: { quantity: incoming.quantity, unit: incoming.unit },
    };
  }

  // Fuzzy match → ask user
  if (bestScore >= 0.6 && bestItem) {
    return {
      action: 'confirm',
      existingItem: bestItem,
      delta: { quantity: incoming.quantity, unit: incoming.unit },
      message: `"${bestItem.ingredient}" is already in your list. Add ${incoming.quantity} ${incoming.unit} of "${incoming.name}" or is the existing enough?`,
    };
  }

  // No match → add new
  return { action: 'add' };
}

export type BatchMergeResult = {
  added: IncomingIngredient[];
  increased: { item: ShoppingListItem; delta: number }[];
  needsConfirmation: { incoming: IncomingIngredient; existing: ShoppingListItem }[];
  skipped: IncomingIngredient[];
};

/**
 * Merge a batch of ingredients into a shopping list.
 * Auto-applies exact matches (increase) and new items (add).
 * Returns fuzzy matches for user confirmation.
 */
export async function mergeIngredientsIntoList(
  listId: string,
  incomingIngredients: IncomingIngredient[],
  userId: string,
): Promise<BatchMergeResult> {
  // Fetch all current items
  const { data: existingItems } = await supabase
    .from('shopping_list_items')
    .select('*')
    .eq('list_id', listId);

  const items = (existingItems ?? []) as ShoppingListItem[];

  const result: BatchMergeResult = {
    added: [],
    increased: [],
    needsConfirmation: [],
    skipped: [],
  };

  for (const incoming of incomingIngredients) {
    const merge = determineMergeAction(incoming, items);

    switch (merge.action) {
      case 'increase':
        if (merge.existingItem) {
          const newQty = (merge.existingItem.quantity ?? 0) + incoming.quantity;
          await supabase
            .from('shopping_list_items')
            .update({ quantity: newQty })
            .eq('id', merge.existingItem.id);
          result.increased.push({ item: merge.existingItem, delta: incoming.quantity });
        }
        break;

      case 'confirm':
        if (merge.existingItem) {
          result.needsConfirmation.push({ incoming, existing: merge.existingItem });
        }
        break;

      case 'add':
        await supabase.from('shopping_list_items').insert({
          list_id: listId,
          user_id: userId,
          ingredient: incoming.name,
          quantity: incoming.quantity,
          unit: incoming.unit,
          is_checked: false,
          manually_added: false,
          sort_order: items.length + result.added.length,
          recipe_ids: [],
        });
        result.added.push(incoming);
        break;

      case 'skip':
        result.skipped.push(incoming);
        break;
    }
  }

  return result;
}

/**
 * Compute a hash of ingredient names+quantities for sync tracking.
 */
export function computeIngredientsHash(
  ingredients: { ingredient: string; quantity?: number | null; unit?: string | null }[],
): string {
  const sorted = ingredients
    .map(i => `${normalizeIngredient(i.ingredient)}:${i.quantity ?? 0}:${i.unit ?? ''}`)
    .sort()
    .join('|');
  // Simple hash — not crypto, just for change detection
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    hash = ((hash << 5) - hash + sorted.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}
