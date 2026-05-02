import { callClaude, extractJSON } from './client';
import type { Recipe, RecipeIngredient, RecipeStep } from '@chefsbook/db';

export interface SousChefFeedbackResult {
  title: string;
  description: string;
  ingredients: Array<{ name: string; quantity: string; unit: string; group?: string }>;
  steps: Array<{ instruction: string; duration_minutes?: number }>;
  notes?: string;
}

export async function askSousChef(
  recipe: Recipe & { ingredients: RecipeIngredient[]; steps: RecipeStep[] },
  userFeedback: string
): Promise<SousChefFeedbackResult> {
  const ingredientList = recipe.ingredients
    .map(i => `${i.quantity ?? ''} ${i.unit ?? ''} ${i.ingredient}`.trim())
    .join('\n');

  const stepList = recipe.steps
    .map((s, idx) => `${idx + 1}. ${s.instruction}`)
    .join('\n');

  const prompt = `You are a professional recipe editor. The user has a recipe and they have identified something that is missing or incorrect.

CURRENT RECIPE:
Title: ${recipe.title}
Description: ${recipe.description ?? ''}

Ingredients:
${ingredientList}

Steps:
${stepList}

Notes: ${recipe.notes ?? 'none'}

USER FEEDBACK:
${userFeedback}

Your task: Produce a corrected and improved version of this recipe that incorporates the user's feedback fully. Keep everything that is already correct. Only change what the feedback identifies as wrong or missing.

Respond ONLY with valid JSON — no preamble, no markdown fences. Schema:
{
  "title": "string",
  "description": "string (2-3 sentences)",
  "ingredients": [
    { "name": "string", "quantity": "string", "unit": "string", "group": "string or null" }
  ],
  "steps": [
    { "instruction": "string", "duration_minutes": number or null }
  ],
  "notes": "string or null"
}`;

  const raw = await callClaude({ prompt, maxTokens: 4000 });
  const result = extractJSON(raw) as SousChefFeedbackResult;
  return result;
}
