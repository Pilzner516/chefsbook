import { supabaseAdmin, unblockTag } from '@chefsbook/db';
import { NextRequest } from 'next/server';

/**
 * DELETE /api/admin/tags/blocked/[id]
 * Remove a tag from the blocked list
 * Requires admin authentication
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Remove from blocked list
    await unblockTag(id);

    return Response.json({ success: true });
  } catch (err: any) {
    console.error('Admin unblock tag error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
