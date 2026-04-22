import { supabaseAdmin } from '@chefsbook/db';
import { NextRequest } from 'next/server';

/**
 * POST /api/admin/flags/[recipeId]/action
 * Take action on a flagged recipe (Feature 3: Admin actions)
 * Body: { action: 'make_private' | 'hide' | 'delete' | 'dismiss', adminNotes?: string }
 * Requires admin authentication
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  try {
    const { recipeId } = await params;
    const { action, adminNotes } = await req.json();

    if (!action || !['make_private', 'hide', 'delete', 'dismiss'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
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

    // Execute the action
    switch (action) {
      case 'make_private':
        // Set recipe visibility to private
        await supabaseAdmin
          .from('recipes')
          .update({ visibility: 'private' })
          .eq('id', recipeId);

        // Mark all pending flags as reviewed
        await supabaseAdmin
          .from('recipe_flags')
          .update({
            status: 'reviewed',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            admin_notes: adminNotes || 'Made private',
          })
          .eq('recipe_id', recipeId)
          .eq('status', 'pending');
        break;

      case 'hide':
        // Set moderation_status to hidden
        await supabaseAdmin
          .from('recipes')
          .update({ moderation_status: 'hidden' })
          .eq('id', recipeId);

        // Mark all pending flags as reviewed
        await supabaseAdmin
          .from('recipe_flags')
          .update({
            status: 'reviewed',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            admin_notes: adminNotes || 'Hidden',
          })
          .eq('recipe_id', recipeId)
          .eq('status', 'pending');
        break;

      case 'delete':
        // Permanently delete the recipe (CASCADE will delete flags)
        await supabaseAdmin
          .from('recipes')
          .delete()
          .eq('id', recipeId);
        break;

      case 'dismiss':
        // Just mark flags as reviewed, no recipe changes
        await supabaseAdmin
          .from('recipe_flags')
          .update({
            status: 'reviewed',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            admin_notes: adminNotes || 'Dismissed',
          })
          .eq('recipe_id', recipeId)
          .eq('status', 'pending');
        break;
    }

    return Response.json({ success: true });
  } catch (err: any) {
    console.error('Admin flag action error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
