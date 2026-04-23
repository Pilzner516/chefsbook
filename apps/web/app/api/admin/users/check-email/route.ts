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

    // Get email from query params
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
    }

    // Check if email exists in auth.users using service role
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = users.some((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    return NextResponse.json({ available: !emailExists });
  } catch (err: any) {
    console.error('[admin/users/check-email] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
