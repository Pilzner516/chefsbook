import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';
import { translateRecipe } from '@chefsbook/ai';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { recipe, recipeId, targetLanguage } = body;

    if (!recipe || !targetLanguage || targetLanguage === 'en') {
      return NextResponse.json({ error: 'Missing recipe or targetLanguage' }, { status: 400 });
    }

    // Check if full translation already cached
    if (recipeId) {
      const { data: existing } = await supabaseAdmin
        .from('recipe_translations')
        .select('*')
        .eq('recipe_id', recipeId)
        .eq('language', targetLanguage)
        .eq('is_title_only', false)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({
          title: existing.translated_title,
          description: existing.translated_description,
          ingredients: existing.translated_ingredients,
          steps: existing.translated_steps,
          notes: existing.translated_notes,
        });
      }
    }

    const result = await translateRecipe(recipe, targetLanguage);

    // Save full translation to DB (overwrites title-only)
    if (recipeId) {
      await supabaseAdmin
        .from('recipe_translations')
        .upsert({
          recipe_id: recipeId,
          language: targetLanguage,
          translated_title: result.title,
          translated_description: result.description,
          translated_ingredients: result.ingredients,
          translated_steps: result.steps,
          translated_notes: result.notes,
          is_title_only: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'recipe_id,language' });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[api/recipes/translate] Error:', err);
    return NextResponse.json({ error: err.message || 'Translation failed' }, { status: 500 });
  }
}
