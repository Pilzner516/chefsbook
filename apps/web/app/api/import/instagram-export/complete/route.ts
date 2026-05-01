import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PLAN_LIMITS, logAiCall, getPrimaryPhotos } from '@chefsbook/db';
import { completeInstagramRecipe } from '@chefsbook/ai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface CompletedRecipe {
  recipeId: string;
  title: string;
  ingredientCount: number;
  stepCount: number;
}

interface FailedRecipe {
  recipeId: string;
  error: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('plan_tier')
      .eq('id', user.id)
      .single();

    const plan = (profile?.plan_tier ?? 'free') as keyof typeof PLAN_LIMITS;
    if (plan !== 'pro') {
      return NextResponse.json(
        { error: 'plan_required', plan: 'pro' },
        { status: 403 }
      );
    }

    const { recipeIds } = (await request.json()) as { recipeIds: string[] };
    if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
      return NextResponse.json({ error: 'No recipe IDs provided' }, { status: 400 });
    }

    if (recipeIds.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 recipes per batch' }, { status: 400 });
    }

    const completed: CompletedRecipe[] = [];
    const failed: FailedRecipe[] = [];

    for (const recipeId of recipeIds) {
      try {
        const { data: recipe, error: recipeError } = await supabaseAdmin
          .from('recipes')
          .select('id, title, notes, tags, user_id')
          .eq('id', recipeId)
          .eq('user_id', user.id)
          .single();

        if (recipeError || !recipe) {
          failed.push({ recipeId, error: 'Recipe not found' });
          continue;
        }

        const primaryPhotos = await getPrimaryPhotos([recipeId]);
        const photoUrl = primaryPhotos[recipeId];

        if (!photoUrl) {
          failed.push({ recipeId, error: 'No photo found' });
          continue;
        }

        const imageResponse = await fetch(photoUrl, {
          headers: { apikey: supabaseAnonKey },
        });

        if (!imageResponse.ok) {
          failed.push({ recipeId, error: 'Failed to fetch image' });
          continue;
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');

        const result = await completeInstagramRecipe({
          title: recipe.title,
          notes: recipe.notes,
          imageBase64,
        });

        await logAiCall({
          userId: user.id,
          action: 'instagram_recipe_complete',
          model: 'sonnet',
          tokensIn: result.tokensIn ?? 0,
          tokensOut: result.tokensOut ?? 0,
          recipeId,
          success: result.success,
          metadata: result.error ? { error: result.error } : undefined,
        });

        if (!result.success || !result.data) {
          failed.push({ recipeId, error: result.error || 'Generation failed' });
          continue;
        }

        const { data: recipeData } = result;

        const ingredientRows = recipeData.ingredients.map((ing, idx) => ({
          recipe_id: recipeId,
          user_id: user.id,
          ingredient: ing.name,
          quantity: ing.amount || '',
          unit: ing.unit || '',
          sort_order: idx,
        }));

        const { error: ingredientError } = await supabaseAdmin
          .from('recipe_ingredients')
          .insert(ingredientRows);

        if (ingredientError) {
          console.error('[instagram-export/complete] Ingredient insert error:', ingredientError);
        }

        const stepRows = recipeData.steps.map((step, idx) => ({
          recipe_id: recipeId,
          user_id: user.id,
          step_number: idx + 1,
          instruction: step.instruction,
        }));

        const { error: stepError } = await supabaseAdmin
          .from('recipe_steps')
          .insert(stepRows);

        if (stepError) {
          console.error('[instagram-export/complete] Step insert error:', stepError);
        }

        const updatedTags = (recipe.tags || []).filter((t: string) => t !== '_incomplete');

        const { error: updateError } = await supabaseAdmin
          .from('recipes')
          .update({
            description: recipeData.description,
            cuisine: recipeData.cuisine || recipe.tags?.find((t: string) =>
              ['italian', 'mexican', 'chinese', 'indian', 'french', 'japanese', 'thai', 'greek', 'mediterranean'].includes(t.toLowerCase())
            ) || null,
            is_complete: true,
            tags: updatedTags,
          })
          .eq('id', recipeId);

        if (updateError) {
          console.error('[instagram-export/complete] Recipe update error:', updateError);
        }

        try {
          await fetch('http://localhost:3000/api/recipes/finalize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ recipeId }),
          });
        } catch (finalizeError) {
          console.error('[instagram-export/complete] Finalize error:', finalizeError);
        }

        completed.push({
          recipeId,
          title: recipe.title,
          ingredientCount: recipeData.ingredients.length,
          stepCount: recipeData.steps.length,
        });
      } catch (error: any) {
        console.error(`[instagram-export/complete] Error processing ${recipeId}:`, error);
        failed.push({ recipeId, error: error.message || 'Unknown error' });
      }
    }

    return NextResponse.json({ completed, failed });
  } catch (error) {
    console.error('[instagram-export/complete] Error:', error);
    return NextResponse.json(
      { error: 'Completion failed' },
      { status: 500 }
    );
  }
}
