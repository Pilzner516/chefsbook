import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data } = await supabase.auth.getUser(token);
    return data.user?.id ?? null;
  }
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// GET /api/print-orders/[id] - Get a specific order with tracking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
        subtitle,
        author_name,
        cover_style,
        page_count,
        cover_pdf_url
      )
    `)
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({ order: data });
}
