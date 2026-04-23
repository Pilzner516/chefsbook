import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@chefsbook/db';

export async function PATCH(req: NextRequest) {
  try {
    // Get authenticated user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { navOrder } = await req.json();

    // Validate navOrder: must be null or an array of strings
    if (navOrder !== null && (!Array.isArray(navOrder) || !navOrder.every(item => typeof item === 'string'))) {
      return NextResponse.json({ error: 'Invalid navOrder format' }, { status: 400 });
    }

    // Update user profile
    const { error } = await supabase
      .from('user_profiles')
      .update({ nav_order: navOrder })
      .eq('id', session.user.id);

    if (error) {
      console.error('Failed to update nav_order:', error);
      return NextResponse.json({ error: 'Failed to update nav order' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in PATCH /api/user/nav-order:', err);
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}
