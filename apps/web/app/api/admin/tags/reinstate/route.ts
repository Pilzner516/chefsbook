import { supabaseAdmin, reinstateTag } from '@chefsbook/db';
import { NextRequest } from 'next/server';

/**
 * POST /api/admin/tags/reinstate
 * Reinstate a removed tag
 * Body: { logId: string, recipeId: string, tag: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { logId, recipeId, tag } = await req.json();

    if (!logId || !recipeId || !tag) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

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

    // Reinstate the tag
    await reinstateTag(logId, recipeId, tag, user.id);

    return Response.json({ success: true });
  } catch (err: any) {
    console.error('Admin reinstate tag error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
