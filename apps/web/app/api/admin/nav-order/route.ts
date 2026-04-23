import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';

/** Verify the request is from an admin user. Returns userId or null. */
async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data } = await supabaseAdmin.from('admin_users').select('role').eq('user_id', user.id).single();
  if (!data) return null;
  return user.id;
}

export async function PATCH(req: NextRequest) {
  try {
    // Verify admin status
    const userId = await verifyAdmin(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { adminNavOrder } = await req.json();

    // Validate adminNavOrder format
    if (adminNavOrder !== null && (!Array.isArray(adminNavOrder) || !adminNavOrder.every(item => typeof item === 'string'))) {
      return NextResponse.json({ error: 'Invalid adminNavOrder format' }, { status: 400 });
    }

    console.log('[admin/nav-order] Updating admin_nav_order for user:', userId, 'with order:', adminNavOrder);

    // Update admin_nav_order in user_profiles using service role client
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update({ admin_nav_order: adminNavOrder })
      .eq('id', userId);

    if (error) {
      console.error('[admin/nav-order] Failed to update admin nav order:', error);
      return NextResponse.json({ error: 'Failed to update admin nav order', details: error.message }, { status: 500 });
    }

    console.log('[admin/nav-order] Successfully updated admin_nav_order');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[admin/nav-order] Error in PATCH:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
