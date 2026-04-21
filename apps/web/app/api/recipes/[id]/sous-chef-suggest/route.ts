import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, logAiCall } from '@chefsbook/db';
import { callClaude } from '@chefsbook/ai';

interface SousChefSuggestion {
  ingredients?: Array<{
    quantity: string;
    unit: string;
    ingredient: string;
    preparation?: string;
  }>;
  steps?: Array<{
    step_number: number;
    instruction: string;
  }>;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step A — Load existing recipe data
    const { data: recipe, error: recipeError } = await supabaseAdmin
      .from('recipes')
      .select('id, user_id, title, description, source_url, cuisine, tags, cook_minutes, prep_minutes, servings')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (recipeError || !recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Fetch ingredients and steps
    const { data: ingredients } = await supabaseAdmin
      .from('recipe_ingredients')
      .select('quantity, unit, ingredient, preparation')
      .eq('recipe_id', id)
      .order('sort_order');

    const { data: steps } = await supabaseAdmin
      .from('recipe_steps')
      .select('step_number, instruction')
      .eq('recipe_id', id)
      .order('step_number');

    // Step B — Attempt source re-fetch (best-effort, 8 second timeout)
    let sourceScrape: string | null = null;
    let hadSourceScrape = false;

    if (recipe.source_url) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(recipe.source_url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChefsBook/1.0)' }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const html = await response.text();
          // Strip HTML tags and extract text
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          sourceScrape = text.substring(0, 15000);
          hadSourceScrape = true;
        }
      } catch (e) {
        // Timeout or fetch error — continue without source scrape
        sourceScrape = null;
      }
    }

    // Step C — Determine what is missing SERVER-SIDE
    const needsIngredients = !ingredients || ingredients.length < 2;
    const needsSteps = !steps || steps.length === 0;

    if (!needsIngredients && !needsSteps) {
      return NextResponse.json({ suggestions: {}, hadSourceScrape });
    }

    // Step D — Build the Haiku prompt with explicit tasks
    let prompt = `You are a culinary assistant. Your job is to complete a recipe that has incomplete data.
You have been given everything that is already known about the recipe.
Maintain strict fidelity to THIS specific recipe. Do not invent a different recipe.
Use the recipe title, description, cuisine, and any scraped source content as your primary signals.
Respond ONLY with a valid JSON object — no markdown, no preamble, no explanation.

Recipe title: ${recipe.title || 'Untitled'}`;

    if (recipe.description) {
      prompt += `\nDescription: ${recipe.description}`;
    }
    if (recipe.cuisine) {
      prompt += `\nCuisine: ${recipe.cuisine}`;
    }
    if (recipe.tags && recipe.tags.length > 0) {
      prompt += `\nTags: ${recipe.tags.join(', ')}`;
    }
    if (recipe.cook_minutes) {
      prompt += `\nCook time: ${recipe.cook_minutes} min`;
    }
    if (recipe.prep_minutes) {
      prompt += `\nPrep time: ${recipe.prep_minutes} min`;
    }
    if (recipe.servings) {
      prompt += `\nServings: ${recipe.servings}`;
    }

    if (sourceScrape) {
      const truncated = sourceScrape.substring(0, 12000);
      prompt += `\n\nSource page content (scraped):\n${truncated}`;
    }

    // Build explicit task instructions
    const tasks: string[] = [];

    if (needsIngredients) {
      const ingredientCount = ingredients?.length ?? 0;
      prompt += `\n\nExisting ingredients (${ingredientCount} found, minimum 2 required):`;
      if (ingredientCount === 0) {
        prompt += `\nnone`;
      } else {
        prompt += `\n${JSON.stringify(ingredients, null, 2)}`;
      }
      tasks.push(
        `Generate a complete and accurate ingredients list for this recipe. ` +
        `Include ALL ingredients needed — do not stop at 2. ` +
        `Return them under the "ingredients" key.`
      );
    }

    if (needsSteps) {
      const stepCount = steps?.length ?? 0;
      prompt += `\n\nExisting steps (${stepCount} found):`;
      if (stepCount === 0) {
        prompt += `\nnone`;
      } else {
        prompt += `\n${JSON.stringify(steps, null, 2)}`;
      }
      tasks.push(
        `Generate complete step-by-step instructions for this recipe. ` +
        `Return them under the "steps" key.`
      );
    }

    prompt += `\n\n${tasks.join('\n')}

Respond with a JSON object containing only the requested fields.
Schema:
{`;

    if (needsIngredients) {
      prompt += `
  "ingredients": [
    { "quantity": "2", "unit": "cups", "ingredient": "all-purpose flour", "preparation": "" }
  ]`;
      if (needsSteps) prompt += ',';
    }

    if (needsSteps) {
      prompt += `
  "steps": [
    { "step_number": 1, "instruction": "Mix the dry ingredients together." }
  ]`;
    }

    prompt += `
}`;

    // Call Claude with Haiku model
    const HAIKU = 'claude-haiku-4-5-20251001';
    const claudeResponse = await callClaude({
      prompt,
      model: HAIKU,
      maxTokens: 2000,
    });

    // Log the AI call
    await logAiCall({
      userId: user.id,
      action: 'sous_chef_suggest',
      model: 'haiku',
      tokensIn: 0, // Estimated based on prompt size
      tokensOut: 0, // Estimated based on response size
      recipeId: id,
    });

    // Step E — Parse and return
    let suggestions: SousChefSuggestion;
    try {
      // Extract JSON from response
      const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      suggestions = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', claudeResponse);
      return NextResponse.json(
        { error: 'Failed to parse AI suggestions' },
        { status: 500 }
      );
    }

    // Step F — Post-processing guard: strip unwanted keys
    if (!needsIngredients) delete suggestions.ingredients;
    if (!needsSteps) delete suggestions.steps;

    return NextResponse.json({
      suggestions,
      hadSourceScrape,
    });
  } catch (error: any) {
    console.error('Sous Chef suggest error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
