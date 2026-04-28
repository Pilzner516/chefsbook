import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';
import { calculatePrintCost, isLuluConfigured, OUR_MARGIN_CENTS } from '@/lib/lulu';

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

async function checkProPlan(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('plan_tier')
    .eq('id', userId)
    .single();
  const plan = (profile?.plan_tier as PlanTier) ?? 'free';
  return PLAN_LIMITS[plan]?.canPrintCookbook ?? false;
}

// POST /api/print-cookbooks/[id]/price - Get Lulu price estimate
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

  // Get the cookbook
  const { data: cookbook, error: cookbookError } = await supabaseAdmin
    .from('printed_cookbooks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (cookbookError || !cookbook) {
    return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
  }

  if (!cookbook.page_count) {
    return NextResponse.json({ error: 'Cookbook must be generated first' }, { status: 400 });
  }

  const body = await request.json();
  const {
    quantity = 1,
    shipping_name,
    shipping_street1,
    shipping_city,
    shipping_postcode,
    shipping_country_code,
    shipping_phone,
    shipping_level = 'GROUND',
  } = body;

  // Validate required shipping fields
  if (!shipping_name || !shipping_street1 || !shipping_city || !shipping_postcode || !shipping_country_code || !shipping_phone) {
    return NextResponse.json({ error: 'Complete shipping address required' }, { status: 400 });
  }

  if (!isLuluConfigured()) {
    // Return mock pricing when Lulu is not configured (sandbox/development)
    const mockLuluCost = 1200 + cookbook.page_count * 3; // ~$12 base + $0.03/page
    const mockShipping = shipping_level === 'GROUND' ? 499 : shipping_level === 'EXPEDITED' ? 899 : 1299;
    return NextResponse.json({
      pricing: {
        lulu_cost_cents: mockLuluCost * quantity,
        shipping_cost_cents: mockShipping,
        our_margin_cents: OUR_MARGIN_CENTS,
        total_cents: mockLuluCost * quantity + mockShipping + OUR_MARGIN_CENTS,
        quantity,
        page_count: cookbook.page_count,
        mock: true,
      },
    });
  }

  try {
    const pricing = await calculatePrintCost(
      cookbook.page_count,
      quantity,
      {
        name: shipping_name,
        street1: shipping_street1,
        street2: body.shipping_street2,
        city: shipping_city,
        state_code: body.shipping_state,
        postcode: shipping_postcode,
        country_code: shipping_country_code,
        phone_number: shipping_phone,
      },
      shipping_level,
    );

    return NextResponse.json({
      pricing: {
        lulu_cost_cents: pricing.luluCostCents,
        shipping_cost_cents: pricing.shippingCostCents,
        our_margin_cents: pricing.ourMarginCents,
        total_cents: pricing.totalCents,
        quantity,
        page_count: cookbook.page_count,
      },
    });
  } catch (error) {
    console.error('Lulu price calculation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Price calculation failed' },
      { status: 500 },
    );
  }
}
