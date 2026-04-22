import { supabaseAdmin } from '@chefsbook/db';

/**
 * POST /api/recipes/flag
 * Submit a flag for a recipe (Prompt K)
 * Body: { recipeId, reasons[], details? }
 * Reasons must be from the allowed list, at least one required
 */
export async function POST(req: Request) {
  try {
    const { recipeId, reasons, details, aiGenerated } = await req.json();

    if (!recipeId || !reasons || !Array.isArray(reasons) || reasons.length === 0) {
      return Response.json({ error: 'recipeId and at least one reason required' }, { status: 400 });
    }

    const validReasons = [
      'Inappropriate content',
      'Copyright violation',
      'Missing or incorrect information',
      'Spam or self-promotion',
      'Duplicate recipe',
      'Other',
    ];

    const invalidReasons = reasons.filter((r: string) => !validReasons.includes(r));
    if (invalidReasons.length > 0) {
      return Response.json({ error: `Invalid reasons: ${invalidReasons.join(', ')}` }, { status: 400 });
    }

    let flaggedBy: string | null = null;

    // If not AI-generated, require authenticated user
    if (!aiGenerated) {
      const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(
        req.headers.get('authorization')?.replace('Bearer ', '') || ''
      );

      flaggedBy = authUser?.id ?? null;
      if (!flaggedBy) {
        return Response.json({ error: 'Not authenticated' }, { status: 401 });
      }

      // Check if user already flagged this recipe
      const { data: existingFlag } = await supabaseAdmin
        .from('recipe_flags')
        .select('id')
        .eq('recipe_id', recipeId)
        .eq('flagged_by', flaggedBy)
        .maybeSingle();

      if (existingFlag) {
        return Response.json({ error: 'You have already flagged this recipe' }, { status: 409 });
      }
    }

    // Insert flag (flaggedBy will be null for AI-generated flags)
    const { data: flag, error: flagError } = await supabaseAdmin
      .from('recipe_flags')
      .insert({
        recipe_id: recipeId,
        flagged_by: flaggedBy,
        reasons,
        details: details || null,
        status: 'pending',
      })
      .select()
      .single();

    if (flagError) throw flagError;

    return Response.json({ success: true, flagId: flag.id });
  } catch (err: any) {
    console.error('Flag recipe error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
