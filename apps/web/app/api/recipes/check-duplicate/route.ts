import { supabaseAdmin, checkAndMarkDuplicate } from '@chefsbook/db';

/**
 * POST /api/recipes/check-duplicate
 * Body: { recipeId: string }
 *
 * Runs duplicate detection on a recipe. Used before making a recipe public.
 * Returns { isDuplicate, canonicalId, canonicalTitle } if a duplicate is found.
 */
export async function POST(req: Request) {
  try {
    const { recipeId } = await req.json();
    if (!recipeId) return Response.json({ error: 'recipeId required' }, { status: 400 });

    const result = await checkAndMarkDuplicate(recipeId);

    if (result.isDuplicate && result.canonicalId) {
      // Fetch canonical recipe title for the notice
      const { data: canonical } = await supabaseAdmin
        .from('recipes')
        .select('title')
        .eq('id', result.canonicalId)
        .single();

      return Response.json({
        isDuplicate: true,
        canonicalId: result.canonicalId,
        canonicalTitle: canonical?.title ?? 'Unknown',
      });
    }

    return Response.json({ isDuplicate: false });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
