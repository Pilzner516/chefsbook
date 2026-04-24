import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Increment login_count
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('login_count')
    .eq('id', user.id)
    .single();

  const currentCount = profile?.login_count ?? 0;
  await supabaseAdmin
    .from('user_profiles')
    .update({ login_count: currentCount + 1 })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
}
