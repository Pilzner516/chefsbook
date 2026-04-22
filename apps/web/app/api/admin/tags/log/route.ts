import { supabaseAdmin } from '@chefsbook/db';
import { NextRequest } from 'next/server';

/**
 * GET /api/admin/tags/log
 * Get recent tag removals (last 100)
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

    // Get recent removals with recipe and user info
    const { data: logs, error } = await supabaseAdmin
      .from('tag_moderation_log')
      .select(`
        id,
        recipe_id,
        tag,
        removed_by,
        reason,
        created_at,
        reinstated,
        recipes!inner(title, user_id, user_profiles!inner(username))
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Format response
    const formatted = (logs ?? []).map(log => ({
      id: log.id,
      tag: log.tag,
      recipeId: log.recipe_id,
      recipeTitle: (log.recipes as any).title,
      recipeOwner: (log.recipes as any).user_profiles?.username,
      removedBy: log.removed_by,
      reason: log.reason,
      createdAt: log.created_at,
      reinstated: log.reinstated,
    }));

    return Response.json({ logs: formatted });
  } catch (err: any) {
    console.error('Admin tag log error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
