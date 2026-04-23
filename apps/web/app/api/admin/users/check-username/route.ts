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

export async function GET(req: NextRequest) {
  try {
    // Verify admin status
    const adminId = await verifyAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get username from query params
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'Username parameter required' }, { status: 400 });
    }

    // Check if username exists in user_profiles
    const { data: existingUser } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .single();

    return NextResponse.json({ available: !existingUser });
  } catch (err: any) {
    console.error('[admin/users/check-username] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
