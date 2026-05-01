import { callClaude, extractJSON } from './client';
import { logAiCall } from '@chefsbook/db';
import type { MenuCourse } from '@chefsbook/db';

export interface MenuRecipeInput {
  name: string;
  description: string | null;
  course: MenuCourse;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface GeneratedMenuRecipe {
  title: string;
  description: string;
  ingredients: { quantity: number | null; unit: string | null; ingredient: string; preparation?: string | null }[];
  steps: { step_number: number; instruction: string; timer_minutes?: number | null }[];
  cuisine: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  tags: string[];
}

const GENERATE_PROMPT_TEMPLATE = `You are a culinary sous chef. A user photographed a menu at {{restaurantName}}.
They want to recreate "{{dishName}}" at home. Based on the name, description, and any
photo provided, generate a realistic home-cook recipe. Acknowledge that this is a
reconstruction from a menu — aim for authenticity to the dish style.

{{menuDescription}}
{{userNotes}}
{{hasImage}}

Return ONLY a valid JSON object, no markdown:
{
  "title": "string",
  "description": "A 1-2 sentence description",
  "ingredients": [
    { "quantity": number|null, "unit": "string|null", "ingredient": "string", "preparation": "string|null" }
  ],
  "steps": [
    { "step_number": 1, "instruction": "string", "timer_minutes": number|null }
  ],
  "cuisine": "string|null",
  "prep_minutes": number|null,
  "cook_minutes": number|null,
  "servings": 4,
  "tags": ["lowercase-tag"]
}`;

export async function generateMenuRecipe(
  dish: MenuRecipeInput,
  restaurantName: string | null,
  userNotes: string | null,
): Promise<GeneratedMenuRecipe> {
  const prompt = GENERATE_PROMPT_TEMPLATE
    .replace('{{restaurantName}}', restaurantName || 'a restaurant')
    .replace('{{dishName}}', dish.name)
    .replace(
      '{{menuDescription}}',
      dish.description ? `Menu description: ${dish.description}` : '',
    )
    .replace(
      '{{userNotes}}',
      userNotes ? `User context: ${userNotes}` : '',
    )
    .replace(
      '{{hasImage}}',
      dish.imageBase64
        ? 'The user also photographed the actual dish — use it to inform the ingredients, plating style, and likely preparation method.'
        : '',
    );

  const startTime = Date.now();
  let text: string;

  if (dish.imageBase64) {
    text = await callClaude({
      prompt,
      imageBase64: dish.imageBase64,
      imageMimeType: dish.imageMimeType ?? 'image/jpeg',
      maxTokens: 3000,
    });
  } else {
    text = await callClaude({
      prompt,
      maxTokens: 3000,
    });
  }

  const result = extractJSON<GeneratedMenuRecipe>(text);

  const duration = Date.now() - startTime;
  const inputTokens = dish.imageBase64 ? 2000 : 500;
  const outputTokens = Math.ceil(text.length / 4);

  try {
    await logAiCall({
      action: 'menu_recipe_generate',
      model: 'sonnet',
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      durationMs: duration,
    });
  } catch {
    // non-blocking
  }

  return result;
}

export async function generateMenuRecipes(
  dishes: MenuRecipeInput[],
  restaurantName: string | null,
  userNotes: string | null,
  onProgress?: (completed: number, total: number) => void,
): Promise<GeneratedMenuRecipe[]> {
  const results: GeneratedMenuRecipe[] = [];

  for (let i = 0; i < dishes.length; i++) {
    try {
      const recipe = await generateMenuRecipe(dishes[i], restaurantName, userNotes);
      results.push(recipe);
    } catch (e) {
      console.warn(`[generateMenuRecipes] Failed to generate recipe for ${dishes[i].name}:`, e);
      // Skip failed dishes, continue with the rest
    }
    onProgress?.(i + 1, dishes.length);
  }

  return results;
}
