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
