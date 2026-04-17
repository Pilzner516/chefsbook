import { callClaude, extractJSON, HAIKU } from './client';

export interface TagSuggestion {
  cuisine: string | null;
  course: string | null;
  tags: string[];
}

const TAG_PROMPT = `Analyze this recipe and return cuisine, course, and tags.

Rules for course:
- Waffles, pancakes, eggs, french toast, oatmeal, granola → breakfast
- Sandwiches, wraps, light soups, salads → lunch
- Pasta, roasts, stews, grills, curries, heavy proteins → dinner
- Lamb, beef roast, whole chicken, prime rib → dinner
- Cakes, cookies, pies, ice cream, pudding → dessert
- Chips, dips, nuts, energy bites → snack
- Smoothies, cocktails, coffee drinks → drink
- Rice dishes, potato dishes, vegetable sides → side
- Appetizers, bruschetta, small bites → starter
- Breads, rolls, focaccia, biscuits, pretzels → bread
- If lunch/dinner ambiguous, pick the more likely one

Return ONLY JSON:
{ "cuisine": "string", "course": "string", "tags": ["string"] }

Tags should be 5-8 lowercase strings covering: main protein (chicken, beef, fish, vegetarian, vegan), cooking method (baked, grilled, fried, slow-cooked, no-knead), characteristics (quick, one-pot, meal-prep, comfort-food), diet flags (gluten-free, dairy-free) if applicable.`;

/**
 * Suggest cuisine, course, and 5-8 tags for a single recipe using Claude Haiku.
 * Cheap (~$0.0002 per call). Safe to fire-and-forget in import pipelines.
 * Throws on API failure — callers should wrap in try/catch.
 */
export async function suggestTagsForRecipe(recipe: {
  title: string;
  description?: string | null;
  ingredients?: string[];
}): Promise<TagSuggestion> {
  const ingList = (recipe.ingredients ?? []).slice(0, 10).join(', ');
  const prompt = `${TAG_PROMPT}\n\nTitle: ${recipe.title}\nDescription: ${recipe.description ?? ''}\nIngredients: ${ingList}`;

  const text = await callClaude({ prompt, model: HAIKU, maxTokens: 300 });
  const result = extractJSON<TagSuggestion>(text);

  const rawCourse = Array.isArray((result as any).course) ? (result as any).course[0] : result.course;
  const normCourse = rawCourse ? String(rawCourse).toLowerCase() : null;
  const normTags = Array.isArray(result.tags)
    ? result.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean)
    : [];

  return {
    cuisine: result.cuisine ? String(result.cuisine) : null,
    course: normCourse,
    tags: normTags,
  };
}
