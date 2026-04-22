import { supabaseAdmin } from '@chefsbook/db';
import { NextRequest } from 'next/server';

/**
 * GET /api/admin/flags
 * List all recipes with pending flags (Feature 3: Admin flagged queue)
 * Requires admin authentication
 */
export async function GET(req: NextRequest) {
  try {
    // Verify admin status
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!adminUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get recipes with pending flags, grouped by recipe
    const { data: flaggedRecipes, error } = await supabaseAdmin.rpc('get_flagged_recipes');

    if (error) {
      console.error('Get flagged recipes error:', error);
      // Fallback to manual query if RPC doesn't exist

      // First get recipe IDs with pending flags
      const { data: flaggedRecipeIds, error: flagsError } = await supabaseAdmin
        .from('recipe_flags')
        .select('recipe_id')
        .eq('status', 'pending');

      if (flagsError) throw flagsError;
      if (!flaggedRecipeIds || flaggedRecipeIds.length === 0) {
        return Response.json({ recipes: [] });
      }

      const recipeIds = [...new Set(flaggedRecipeIds.map(f => f.recipe_id))];

      const { data: recipes, error: recipesError } = await supabaseAdmin
        .from('recipes')
        .select(`
          id,
          title,
          visibility,
          moderation_status,
          image_url,
          user_id,
          user_profiles!inner(username)
        `)
        .in('id', recipeIds);

      if (recipesError) throw recipesError;

      // Get flags for each recipe
      const recipesWithFlags = await Promise.all(
        (recipes || []).map(async (recipe) => {
          const { data: flags } = await supabaseAdmin
            .from('recipe_flags')
            .select(`
              id,
              flag_type,
              reason,
              created_at,
              flagged_by,
              user_profiles(username)
            `)
            .eq('recipe_id', recipe.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

          return {
            ...recipe,
            flags: flags || [],
            flag_count: flags?.length || 0,
            latest_flag_at: flags?.[0]?.created_at || null,
          };
        })
      );

      // Sort by flag count DESC, then latest flag DESC
      const sorted = recipesWithFlags.sort((a, b) => {
        if (a.flag_count !== b.flag_count) {
          return b.flag_count - a.flag_count;
        }
        if (!a.latest_flag_at) return 1;
        if (!b.latest_flag_at) return -1;
        return new Date(b.latest_flag_at).getTime() - new Date(a.latest_flag_at).getTime();
      });

      return Response.json({ recipes: sorted });
    }

    return Response.json({ recipes: flaggedRecipes });
  } catch (err: any) {
    console.error('Admin flags list error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
