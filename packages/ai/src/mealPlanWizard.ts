import { callClaude, extractJSON } from './client';

export interface NutritionGoals {
  dailyCalories?: number;
  macroPriority?: 'none' | 'high_protein' | 'low_carb' | 'balanced';
  maxCaloriesPerMeal?: number;
}

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
  nutritionGoals?: NutritionGoals;
}

export interface MealNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
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
  estimated_nutrition?: MealNutrition;
}

export interface DailySummary {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealPlanResult {
  plan: MealPlanSlot[];
  daily_summaries?: Record<string, DailySummary>;
}

export async function generateMealPlan(
  preferences: MealPlanPreferences,
  userRecipes: { id: string; title: string; cuisine: string | null; course: string | null; tags: string[]; total_minutes: number | null }[],
): Promise<MealPlanResult> {
  const effortRange = preferences.effortLevel < 30 ? 'under 30 minutes' : preferences.effortLevel < 70 ? '30-60 minutes' : 'over 1 hour';
  const cuisineDirective = preferences.cuisineVariety < 30
    ? 'Stick to 1-2 cuisines throughout the week'
    : preferences.cuisineVariety > 70
      ? 'Vary cuisine every meal — maximum diversity'
      : 'Moderate variety — 3-4 different cuisines across the week';

  const recipeSummary = userRecipes.slice(0, 50).map((r) =>
    `{id:"${r.id}",title:"${r.title}",cuisine:"${r.cuisine ?? ''}",course:"${r.course ?? ''}",time:${r.total_minutes ?? 0}}`
  ).join('\n');

  const hasNutritionGoals = preferences.nutritionGoals && (
    preferences.nutritionGoals.dailyCalories ||
    preferences.nutritionGoals.macroPriority && preferences.nutritionGoals.macroPriority !== 'none' ||
    preferences.nutritionGoals.maxCaloriesPerMeal
  );

  const nutritionSection = hasNutritionGoals ? `
NUTRITIONAL GOALS (respect these when selecting recipes):
${preferences.nutritionGoals?.dailyCalories ? `- Daily calorie target: ${preferences.nutritionGoals.dailyCalories} kcal` : ''}
${preferences.nutritionGoals?.macroPriority && preferences.nutritionGoals.macroPriority !== 'none' ? `- Macro priority: ${preferences.nutritionGoals.macroPriority.replace('_', ' ')}` : ''}
${preferences.nutritionGoals?.maxCaloriesPerMeal ? `- Max calories per meal: ${preferences.nutritionGoals.maxCaloriesPerMeal} kcal` : ''}

When choosing recipes, prefer those whose nutrition data aligns with these goals.
If a recipe's nutrition is unknown, use your best judgement based on the recipe title and typical ingredients.
Aim for the daily target across all meals — breakfast lighter, dinner can be larger.
`.trim() : '';

  const nutritionOutputInstructions = hasNutritionGoals ? `
Each meal entry MUST include an "estimated_nutrition" object:
"estimated_nutrition": { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number }

After the plan array, include a "daily_summaries" object summing each day's totals:
"daily_summaries": {
  "monday": { "calories": 1850, "protein_g": 95, "carbs_g": 180, "fat_g": 75 },
  ...
}` : '';

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
${nutritionSection}

${preferences.source !== 'community' && userRecipes.length > 0 ? `User's recipe collection (prefer these when they match):\n${recipeSummary}` : ''}

Rules:
1. No protein repetition on consecutive days (no chicken Monday AND Tuesday dinner)
2. Balance heavy and light meals within each day
3. Breakfast should be quick unless effort=high
4. Match cuisine variety directive
5. Respect ALL dietary restrictions strictly
6. If a matching recipe exists in user's collection, use its id
7. For meals without a matching recipe: suggest a title only
${hasNutritionGoals ? '8. If nutrition goals are set, distribute calories appropriately across meals (breakfast lighter, dinner larger)\n9. Include estimated nutrition for each meal' : ''}

Return ONLY a JSON object with this structure:
{
  "plan": [{
    "day": "monday",
    "slot": "dinner",
    "recipe_id": "uuid-or-null",
    "title": "Recipe Name",
    "source": "my_recipe" | "ai_suggestion",
    "cuisine": "Italian",
    "estimated_time": 30,
    "reason": "Brief explanation"${hasNutritionGoals ? ',\n    "estimated_nutrition": { "calories": 450, "protein_g": 35, "carbs_g": 40, "fat_g": 18 }' : ''}
  }]${nutritionOutputInstructions ? `,
  "daily_summaries": { ... }` : ''}
}

Return exactly one entry per selected day+slot combination.`;

  const text = await callClaude({ prompt, maxTokens: 6000 });
  try {
    const result = extractJSON(text) as MealPlanResult | MealPlanSlot[];
    if (Array.isArray(result)) {
      return { plan: result };
    }
    return result;
  } catch {
    return { plan: [] };
  }
}
