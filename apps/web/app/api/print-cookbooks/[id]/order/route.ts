import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin, PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';
import { calculatePrintCost, isLuluConfigured, OUR_MARGIN_CENTS } from '@/lib/lulu';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

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

// POST /api/print-cookbooks/[id]/order - Create Stripe payment intent and order record
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

  if (cookbook.status !== 'ready') {
    return NextResponse.json({ error: 'Cookbook must be generated and ready' }, { status: 400 });
  }

  if (!cookbook.page_count || !cookbook.interior_pdf_url || !cookbook.cover_pdf_url) {
    return NextResponse.json({ error: 'Cookbook PDFs not ready' }, { status: 400 });
  }

  const body = await request.json();
  const {
    quantity = 1,
    shipping_name,
    shipping_street1,
    shipping_street2,
    shipping_city,
    shipping_state,
    shipping_postcode,
    shipping_country_code,
    shipping_phone,
    shipping_level = 'GROUND',
  } = body;

  // Validate required shipping fields
  if (!shipping_name || !shipping_street1 || !shipping_city || !shipping_postcode || !shipping_country_code || !shipping_phone) {
    return NextResponse.json({ error: 'Complete shipping address required' }, { status: 400 });
  }

  if (quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: 'Quantity must be between 1 and 10' }, { status: 400 });
  }

  // Calculate pricing
  let luluCostCents: number;
  let shippingCostCents: number;
  let totalCents: number;

  if (!isLuluConfigured()) {
    // Mock pricing for development
    const mockLuluCost = 1200 + cookbook.page_count * 3;
    const mockShipping = shipping_level === 'GROUND' ? 499 : shipping_level === 'EXPEDITED' ? 899 : 1299;
    luluCostCents = mockLuluCost * quantity;
    shippingCostCents = mockShipping;
    totalCents = luluCostCents + shippingCostCents + OUR_MARGIN_CENTS;
  } else {
    try {
      const pricing = await calculatePrintCost(
        cookbook.page_count,
        quantity,
        {
          name: shipping_name,
          street1: shipping_street1,
          street2: shipping_street2,
          city: shipping_city,
          state_code: shipping_state,
          postcode: shipping_postcode,
          country_code: shipping_country_code,
          phone_number: shipping_phone,
        },
        shipping_level,
      );
      luluCostCents = pricing.luluCostCents;
      shippingCostCents = pricing.shippingCostCents;
      totalCents = pricing.totalCents;
    } catch (error) {
      console.error('Lulu price calculation error:', error);
      return NextResponse.json({ error: 'Failed to calculate price' }, { status: 500 });
    }
  }

  // Create the order record first
  const { data: order, error: orderError } = await supabaseAdmin
    .from('printed_cookbook_orders')
    .insert({
      user_id: userId,
      printed_cookbook_id: id,
      status: 'pending',
      quantity,
      lulu_print_cost_cents: luluCostCents,
      shipping_cost_cents: shippingCostCents,
      our_margin_cents: OUR_MARGIN_CENTS,
      total_charged_cents: totalCents,
      shipping_name,
      shipping_street1,
      shipping_street2: shipping_street2 || null,
      shipping_city,
      shipping_state: shipping_state || null,
      shipping_postcode,
      shipping_country_code,
      shipping_phone,
      shipping_level,
    })
    .select()
    .single();

  if (orderError || !order) {
    console.error('Order creation error:', orderError);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  // Create Stripe payment intent
  try {
    const stripe = getStripe();

    // Get user email
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = profile?.email || authUser?.user?.email;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        order_id: order.id,
        cookbook_id: id,
        user_id: userId,
        type: 'printed_cookbook',
      },
      receipt_email: email,
      description: `ChefsBook Printed Cookbook: ${cookbook.title}`,
    });

    // Update order with payment intent ID
    await supabaseAdmin
      .from('printed_cookbook_orders')
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq('id', order.id);

    return NextResponse.json({
      order_id: order.id,
      client_secret: paymentIntent.client_secret,
      total_cents: totalCents,
      breakdown: {
        print_cost: luluCostCents,
        shipping: shippingCostCents,
        service_fee: OUR_MARGIN_CENTS,
      },
    });
  } catch (error) {
    // Clean up the order on Stripe failure
    await supabaseAdmin
      .from('printed_cookbook_orders')
      .delete()
      .eq('id', order.id);

    console.error('Stripe error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Payment setup failed' },
      { status: 500 },
    );
  }
}
