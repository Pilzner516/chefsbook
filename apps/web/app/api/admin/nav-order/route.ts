import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@chefsbook/db';

export async function PATCH(req: NextRequest) {
  try {
    // Get current user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is an admin
    const { data: adminData } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (!adminData) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const { adminNavOrder } = await req.json();

    // Validate adminNavOrder format
    if (adminNavOrder !== null && (!Array.isArray(adminNavOrder) || !adminNavOrder.every(item => typeof item === 'string'))) {
      return NextResponse.json({ error: 'Invalid adminNavOrder format' }, { status: 400 });
    }

    // Update admin_nav_order in user_profiles
    const { error } = await supabase
      .from('user_profiles')
      .update({ admin_nav_order: adminNavOrder })
      .eq('id', session.user.id);

    if (error) {
      console.error('Failed to update admin nav order:', error);
      return NextResponse.json({ error: 'Failed to update admin nav order' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in PATCH /api/admin/nav-order:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
