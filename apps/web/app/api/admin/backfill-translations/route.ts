import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, saveTitleOnlyTranslations } from '@chefsbook/db';
import { translateRecipeTitle } from '@chefsbook/ai';

export const maxDuration = 300; // 5 minutes

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data } = await supabaseAdmin.from('admin_users').select('role').eq('user_id', user.id).single();
  return data ? user.id : null;
}

export async function POST(req: NextRequest) {
  try {
    const adminId = await verifyAdmin(req);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get all recipes without French translations
    const { data: allRecipes } = await supabaseAdmin
      .from('recipes')
      .select('id, title');

    if (!allRecipes) {
      return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 });
    }

    // Get all recipe IDs that have French translations
    const { data: translatedRecipes } = await supabaseAdmin
      .from('recipe_translations')
      .select('recipe_id')
      .eq('language', 'fr');

    const translatedIds = new Set((translatedRecipes ?? []).map((r: any) => r.recipe_id));
    const recipesNeedingTranslation = allRecipes.filter(r => !translatedIds.has(r.id));

    if (recipesNeedingTranslation.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All recipes already have translations',
        translated: 0,
        failed: 0,
      });
    }

    let translated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipe of recipesNeedingTranslation) {
      try {
        // Translate title into all 4 languages
        const titles = await translateRecipeTitle(recipe.title);

        // Save to database
        await saveTitleOnlyTranslations(recipe.id, titles);

        translated++;
      } catch (error: any) {
        console.error(`Failed to translate "${recipe.title}":`, error);
        errors.push(`${recipe.title}: ${error.message}`);
        failed++;
      }

      // Delay to avoid rate limits
      if (translated % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfill complete: ${translated} translated, ${failed} failed`,
      total: recipesNeedingTranslation.length,
      translated,
      failed,
      errors: errors.slice(0, 10), // Return first 10 errors only
      estimatedCost: `$${(translated * 0.0002).toFixed(4)}`,
    });
  } catch (error: any) {
    console.error('Backfill error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
