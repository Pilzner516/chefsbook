import { supabase } from '../client';

export interface CookingActionTiming {
  canonical_key: string;
  technique: string;
  ingredient_category: string | null;
  duration_min: number | null;
  duration_max: number | null;
  is_passive: boolean;
  uses_oven: boolean;
  oven_temp_celsius: number | null;
  phase: 'prep' | 'cook' | 'rest' | 'plate';
  confidence: 'low' | 'medium' | 'high';
  source: 'wikipedia' | 'epicurious' | 'inferred' | 'observed';
  observed_count: number;
  observed_avg_minutes: number | null;
}

/**
 * Lookup cooking action timing from the knowledge graph.
 * Tries exact match first (technique:category), then falls back to technique-only.
 * Returns null if not found.
 */
export async function lookupCookingTiming(
  technique: string,
  ingredientCategory?: string
): Promise<CookingActionTiming | null> {
  const keys = ingredientCategory
    ? [`${technique}:${ingredientCategory}`, technique]
    : [technique];

  const { data } = await supabase
    .from('cooking_action_timings')
    .select('*')
    .in('canonical_key', keys)
    .order('observed_count', { ascending: false }) // prefer observed data
    .limit(1)
    .single();

  return data;
}

/**
 * Extract technique keyword from a recipe step instruction.
 * Returns null if no recognized technique found.
 */
export function extractTechnique(instruction: string): string | null {
  const lower = instruction.toLowerCase();

  // Common techniques in priority order (most specific first)
  const techniques = [
    'sear', 'braise', 'simmer', 'blanch', 'reduce', 'proof', 'knead',
    'roast', 'bake', 'grill', 'fry', 'sauté', 'steam', 'poach',
    'whisk', 'fold', 'caramelize', 'deglaze', 'marinate', 'rest'
  ];

  for (const tech of techniques) {
    if (lower.includes(tech)) return tech;
  }

  return null;
}

/**
 * Extract ingredient category from a recipe step instruction.
 * Returns null if no clear category found.
 */
export function extractIngredientCategory(instruction: string): string | null {
  const lower = instruction.toLowerCase();

  // Common categories
  const categories: Record<string, string[]> = {
    fish: ['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'scallop'],
    beef: ['beef', 'steak', 'brisket'],
    pork: ['pork', 'bacon', 'ham'],
    chicken: ['chicken', 'poultry'],
    dough: ['dough', 'bread'],
    sauce: ['sauce', 'gravy', 'reduction'],
    vegetables: ['vegetable', 'carrot', 'onion', 'potato'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }

  return null;
}
