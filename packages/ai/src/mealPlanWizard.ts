import { callClaude, extractJSON } from './client';

export interface MealPlanPreferences {
  days: string[];
  slots: string[];
  dietary: string[];
  likesDislikesText: string;
  cuisineVariety: number; // 0-100
  preferredCuisines: string[];
  effortLevel: number; // 0-100
  adventurousness: number; // 0-100
  servings: number;
  source: 'my_recipes' | 'mix' | 'community';
}

export interface MealPlanSlot {
  day: string;
  slot: string;
  recipe_id: string | null;
  title: string;
  source: 'my_recipe' | 'community' | 'ai_suggestion';
  cuisine: string;
  estimated_time: number;
  reason: string;
}

export async function generateMealPlan(
  preferences: MealPlanPreferences,
  userRecipes: { id: string; title: string; cuisine: string | null; course: string | null; tags: string[]; total_minutes: number | null }[],
): Promise<MealPlanSlot[]> {
  const effortRange = preferences.effortLevel < 30 ? 'under 30 minutes' : preferences.effortLevel < 70 ? '30-60 minutes' : 'over 1 hour';
  const cuisineDirective = preferences.cuisineVariety < 30
    ? 'Stick to 1-2 cuisines throughout the week'
    : preferences.cuisineVariety > 70
      ? 'Vary cuisine every meal — maximum diversity'
      : 'Moderate variety — 3-4 different cuisines across the week';

  const recipeSummary = userRecipes.slice(0, 50).map((r) =>
    `{id:"${r.id}",title:"${r.title}",cuisine:"${r.cuisine ?? ''}",course:"${r.course ?? ''}",time:${r.total_minutes ?? 0}}`
  ).join('\n');

  const prompt = `Generate a meal plan for these preferences:

Days: ${preferences.days.join(', ')}
Meal slots: ${preferences.slots.join(', ')}
Dietary restrictions: ${preferences.dietary.join(', ') || 'none'}
Likes/dislikes: ${preferences.likesDislikesText || 'none specified'}
Cuisine: ${cuisineDirective}${preferences.preferredCuisines.length ? ` Preferred: ${preferences.preferredCuisines.join(', ')}` : ''}
Effort level: ${effortRange}
Adventurousness: ${preferences.adventurousness < 30 ? 'comfort food, familiar dishes' : preferences.adventurousness > 70 ? 'surprise me, try new things' : 'balanced mix'}
Servings: ${preferences.servings}
Source preference: ${preferences.source}

${preferences.source !== 'community' && userRecipes.length > 0 ? `User's recipe collection (prefer these when they match):\n${recipeSummary}` : ''}

Rules:
1. No protein repetition on consecutive days (no chicken Monday AND Tuesday dinner)
2. Balance heavy and light meals within each day
3. Breakfast should be quick unless effort=high
4. Match cuisine variety directive
5. Respect ALL dietary restrictions strictly
6. If a matching recipe exists in user's collection, use its id
7. For meals without a matching recipe: suggest a title only

Return ONLY a JSON array:
[{
  "day": "monday",
  "slot": "dinner",
  "recipe_id": "uuid-or-null",
  "title": "Recipe Name",
  "source": "my_recipe" | "ai_suggestion",
  "cuisine": "Italian",
  "estimated_time": 30,
  "reason": "Brief explanation"
}]

Return exactly one entry per selected day+slot combination.`;

  const text = await callClaude({ prompt, maxTokens: 6000 });
  try {
    return extractJSON(text) as MealPlanSlot[];
  } catch {
    return [];
  }
}
