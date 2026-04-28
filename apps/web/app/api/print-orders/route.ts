import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Use supabaseAdmin to verify JWT (anon client cannot validate tokens)
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data.user?.id ?? null;
  }
  return null;
}

// GET /api/print-orders - List user's cookbook orders
export async function GET(request: NextRequest) {
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('printed_cookbook_orders')
    .select(`
      *,
      printed_cookbooks (
        id,
        title,
        author_name,
        cover_style
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data });
}
