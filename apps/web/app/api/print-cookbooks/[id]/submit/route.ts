import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';
import { createPrintJob, isLuluConfigured } from '@/lib/lulu';

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

async function checkProPlan(userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan_tier')
    .eq('id', userId)
    .single();
  const plan = (profile?.plan_tier as PlanTier) ?? 'free';
  return PLAN_LIMITS[plan]?.canPrintCookbook ?? false;
}

// POST /api/print-cookbooks/[id]/submit - Submit to Lulu after payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canPrint = await checkProPlan(userId);
  if (!canPrint) {
    return NextResponse.json({ error: 'Pro plan required' }, { status: 403 });
  }

  const body = await request.json();
  const { order_id } = body;

  if (!order_id) {
    return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
  }

  // Get the order
  const { data: order, error: orderError } = await supabaseAdmin
    .from('printed_cookbook_orders')
    .select('*')
    .eq('id', order_id)
    .eq('user_id', userId)
    .eq('printed_cookbook_id', id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.status !== 'payment_complete') {
    return NextResponse.json({ error: 'Payment not yet confirmed' }, { status: 400 });
  }

  // Get the cookbook
  const { data: cookbook, error: cookbookError } = await supabaseAdmin
    .from('printed_cookbooks')
    .select('*')
    .eq('id', id)
    .single();

  if (cookbookError || !cookbook) {
    return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
  }

  if (!cookbook.interior_pdf_url || !cookbook.cover_pdf_url) {
    return NextResponse.json({ error: 'Cookbook PDFs not available' }, { status: 400 });
  }

  // Get user email for Lulu contact
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const contactEmail = authUser?.user?.email ?? 'orders@chefsbk.app';

  if (!isLuluConfigured()) {
    // Mock submission for development
    const mockJobId = `MOCK-${Date.now()}`;

    await supabaseAdmin
      .from('printed_cookbook_orders')
      .update({
        lulu_print_job_id: mockJobId,
        status: 'submitted_to_lulu',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id);

    await supabaseAdmin
      .from('printed_cookbooks')
      .update({ status: 'ordered' })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      lulu_print_job_id: mockJobId,
      mock: true,
    });
  }

  try {
    const printJob = await createPrintJob(
      cookbook.title,
      cookbook.cover_pdf_url,
      cookbook.interior_pdf_url,
      order.quantity,
      {
        name: order.shipping_name,
        street1: order.shipping_street1,
        street2: order.shipping_street2 || undefined,
        city: order.shipping_city,
        state_code: order.shipping_state || undefined,
        postcode: order.shipping_postcode,
        country_code: order.shipping_country_code,
        phone_number: order.shipping_phone,
      },
      order.shipping_level as 'MAIL' | 'PRIORITY_MAIL' | 'GROUND' | 'EXPEDITED' | 'EXPRESS',
      contactEmail,
      order_id,
    );

    // Update order with Lulu job ID
    await supabaseAdmin
      .from('printed_cookbook_orders')
      .update({
        lulu_print_job_id: String(printJob.id),
        status: 'submitted_to_lulu',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id);

    // Update cookbook status
    await supabaseAdmin
      .from('printed_cookbooks')
      .update({ status: 'ordered' })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      lulu_print_job_id: printJob.id,
    });
  } catch (error) {
    console.error('Lulu submission error:', error);

    // Update order status to failed
    await supabaseAdmin
      .from('printed_cookbook_orders')
      .update({
        status: 'failed',
        lulu_webhook_data: { error: error instanceof Error ? error.message : 'Unknown error' },
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit to Lulu' },
      { status: 500 },
    );
  }
}
