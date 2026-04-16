import { supabaseAdmin } from '@chefsbook/db';

export async function POST(req: Request) {
  try {
    const { recipeId, flaggedBy, flagType, reason } = await req.json();

    if (!recipeId || !flaggedBy || !flagType) {
      return Response.json({ error: 'recipeId, flaggedBy, flagType required' }, { status: 400 });
    }

    const validTypes = ['copyright', 'inappropriate', 'spam', 'misinformation', 'impersonation', 'adult_content', 'other'];
    if (!validTypes.includes(flagType)) {
      return Response.json({ error: 'Invalid flag type' }, { status: 400 });
    }

    // Insert flag (UNIQUE constraint prevents duplicates)
    const { data: flag, error: flagError } = await supabaseAdmin
      .from('recipe_flags')
      .insert({
        recipe_id: recipeId,
        flagged_by: flaggedBy,
        flag_type: flagType,
        reason: reason || null,
      })
      .select()
      .single();

    if (flagError) {
      if (flagError.code === '23505') {
        return Response.json({ error: 'You have already flagged this recipe for this reason' }, { status: 409 });
      }
      throw flagError;
    }

    // Increment flagger's flag count (manual — no RPC)
    try {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('recipes_flagged_count')
        .eq('id', flaggedBy)
        .single();
      await supabaseAdmin
        .from('user_profiles')
        .update({ recipes_flagged_count: (profile?.recipes_flagged_count ?? 0) + 1 })
        .eq('id', flaggedBy);
    } catch { /* non-critical */ }

    // Notify admins — NO content changes. Users report, admins act.
    const { data: admins } = await supabaseAdmin
      .from('admin_users')
      .select('user_id');

    if (admins) {
      for (const admin of admins) {
        try {
          await supabaseAdmin.from('notifications').insert({
            user_id: admin.user_id,
            type: 'recipe_flag',
            recipe_id: recipeId,
            message: `A recipe has been flagged as ${flagType}`,
          });
        } catch { /* non-critical */ }
      }
    }

    return Response.json({ success: true, flagId: flag.id });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
