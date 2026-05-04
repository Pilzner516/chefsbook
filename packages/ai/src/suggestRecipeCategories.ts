import { callClaude, extractJSON, HAIKU } from './client';

export interface CategorySuggestion {
  category_slugs: string[];
  reasoning: string;
}

/**
 * Suggest categories for a recipe from the available category taxonomy.
 * Returns category slugs (e.g., ['chicken', 'italian-regions', 'dinner-mains', 'baked'])
 */
export async function suggestRecipeCategories(
  recipe: {
    title: string;
    description?: string | null;
    cuisine?: string | null;
    course?: string | null;
    tags?: string[];
    ingredients?: string[];
  },
  availableCategories: Array<{ slug: string; name: string; group_slug: string }>,
): Promise<CategorySuggestion> {
  // Group categories by group for better Claude comprehension
  const byGroup = availableCategories.reduce((acc, cat) => {
    if (!acc[cat.group_slug]) acc[cat.group_slug] = [];
    acc[cat.group_slug].push(`${cat.slug} (${cat.name})`);
    return acc;
  }, {} as Record<string, string[]>);

  const taxonomy = Object.entries(byGroup)
    .map(([group, cats]) => `${group}: ${cats.join(', ')}`)
    .join('\n');

  const prompt = `You are a recipe categorization expert. Given a recipe, suggest 2-6 categories from the available taxonomy that best describe it.

AVAILABLE CATEGORIES:
${taxonomy}

RECIPE:
Title: ${recipe.title}
${recipe.description ? `Description: ${recipe.description}` : ''}
${recipe.cuisine ? `Cuisine: ${recipe.cuisine}` : ''}
${recipe.course ? `Course: ${recipe.course}` : ''}
${recipe.tags?.length ? `Tags: ${recipe.tags.join(', ')}` : ''}
${recipe.ingredients?.length ? `Ingredients: ${recipe.ingredients.slice(0, 10).join(', ')}` : ''}

RULES:
- Suggest 2-6 category slugs (not names) that best match this recipe
- Include categories from different groups when appropriate (e.g., ingredient + cuisine + meal)
- Focus on the most specific matches (e.g., prefer 'chicken' over 'poultry')
- Only suggest categories from the available taxonomy above
- Return the slug (the part before the parentheses), not the display name

Return ONLY JSON:
{ "category_slugs": ["slug1", "slug2", ...], "reasoning": "brief explanation" }`;

  const text = await callClaude({ prompt, model: HAIKU, maxTokens: 400 });
  const result = extractJSON<CategorySuggestion>(text);

  // Validate that all suggested slugs exist in the available categories
  const validSlugs = new Set(availableCategories.map(c => c.slug));
  const filteredSlugs = (result.category_slugs || [])
    .filter(slug => validSlugs.has(slug))
    .slice(0, 6); // Max 6 categories per recipe

  return {
    category_slugs: filteredSlugs,
    reasoning: result.reasoning || 'No reasoning provided',
  };
}
