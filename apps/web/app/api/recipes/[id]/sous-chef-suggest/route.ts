import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, logAiCall } from '@chefsbook/db';
import { callClaude } from '@chefsbook/ai';

interface SousChefSuggestion {
  ingredients?: Array<{
    amount: string;
    unit: string;
    name: string;
    notes?: string;
  }>;
  steps?: Array<{
    order: number;
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
      .select('amount, unit, name, notes')
      .eq('recipe_id', id)
      .order('order');

    const { data: steps } = await supabaseAdmin
      .from('recipe_steps')
      .select('order, instruction')
      .eq('recipe_id', id)
      .order('order');

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

    // Step C — Build the Haiku prompt
    let prompt = `You are a culinary assistant. Your job is to complete a recipe that has incomplete data.
You have been given everything that is already known about the recipe.
Your task is to suggest ONLY what is missing — do not replace or re-state what already exists.
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

    const ingredientCount = ingredients?.length ?? 0;
    prompt += `\n\nExisting ingredients (${ingredientCount} found, minimum 2 required):`;
    if (ingredientCount === 0) {
      prompt += `\nnone`;
    } else {
      prompt += `\n${JSON.stringify(ingredients, null, 2)}`;
    }

    const stepCount = steps?.length ?? 0;
    prompt += `\n\nExisting steps (${stepCount} found):`;
    if (stepCount === 0) {
      prompt += `\nnone`;
    } else {
      prompt += `\n${JSON.stringify(steps, null, 2)}`;
    }

    if (sourceScrape) {
      const truncated = sourceScrape.substring(0, 12000);
      prompt += `\n\nSource page content (scraped):\n${truncated}`;
    }

    prompt += `\n\nWhat is MISSING from this recipe to make it complete and accurate?
Respond with a JSON object containing only the fields that need to be filled in.
Only include a field if it is genuinely missing or insufficient.
Schema:
{
  "ingredients": [   // only if fewer than 2 exist, or clearly incomplete given the title/source
    { "amount": "2", "unit": "cups", "name": "all-purpose flour", "notes": "" }
  ],
  "steps": [         // only if 0 steps exist
    { "order": 1, "instruction": "Mix the dry ingredients together." }
  ]
}
If ingredients already look complete, omit the "ingredients" key entirely.
If steps already exist, omit the "steps" key entirely.`;

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

    // Step D — Parse and return
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
