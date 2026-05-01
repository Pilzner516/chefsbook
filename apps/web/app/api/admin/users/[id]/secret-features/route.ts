import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, setMenuScanEnabled } from '@chefsbook/db';

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await verifyAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId } = await params;

    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('menu_scan_enabled, plan_tier')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      menu_scan_enabled: profile.menu_scan_enabled ?? false,
      plan_tier: profile.plan_tier,
    });
  } catch (err: any) {
    console.error('[secret-features GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await verifyAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId } = await params;
    const { menu_scan_enabled } = await req.json();

    if (typeof menu_scan_enabled !== 'boolean') {
      return NextResponse.json({ error: 'menu_scan_enabled must be a boolean' }, { status: 400 });
    }

    await setMenuScanEnabled(userId, menu_scan_enabled);

    return NextResponse.json({ success: true, menu_scan_enabled });
  } catch (err: any) {
    console.error('[secret-features POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
