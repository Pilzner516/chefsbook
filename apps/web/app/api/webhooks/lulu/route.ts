import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';
import { validateWebhookSignature } from '@/lib/lulu';

// POST /api/webhooks/lulu - Receive Lulu order status updates
export async function POST(request: NextRequest) {
  const signature = request.headers.get('Lulu-HMAC-SHA256');
  const body = await request.text();

  // Validate webhook signature
  const webhookSecret = process.env.LULU_WEBHOOK_SECRET;
  if (webhookSecret && signature) {
    const isValid = validateWebhookSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error('Invalid Lulu webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id: printJobId, status } = payload;

  if (!printJobId || !status) {
    return NextResponse.json({ error: 'Missing print job ID or status' }, { status: 400 });
  }

  // Map Lulu status to our status
  const statusMap: Record<string, string> = {
    CREATED: 'submitted_to_lulu',
    UNPAID: 'submitted_to_lulu',
    PAYMENT_IN_PROGRESS: 'submitted_to_lulu',
    PRODUCTION_READY: 'in_production',
    PRODUCTION_DELAYED: 'in_production',
    IN_PRODUCTION: 'in_production',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELED: 'cancelled',
    ERROR: 'failed',
    REJECTED: 'failed',
  };

  const newStatus = statusMap[status.name] || 'submitted_to_lulu';

  // Find the order by Lulu print job ID
  const { data: order, error: findError } = await supabaseAdmin
    .from('printed_cookbook_orders')
    .select('id, user_id, printed_cookbook_id')
    .eq('lulu_print_job_id', String(printJobId))
    .single();

  if (findError || !order) {
    console.error('Order not found for Lulu job:', printJobId);
    // Return 200 to prevent Lulu from retrying - order may have been deleted
    return NextResponse.json({ received: true, order_found: false });
  }

  // Extract tracking info if shipped
  const updates: Record<string, unknown> = {
    status: newStatus,
    lulu_webhook_data: payload,
    updated_at: new Date().toISOString(),
  };

  if (status.name === 'SHIPPED' && payload.line_items?.[0]) {
    const lineItem = payload.line_items[0];
    updates.tracking_number = lineItem.tracking_id || null;
    updates.tracking_url = lineItem.tracking_urls?.[0] || null;
  }

  if (payload.estimated_shipping_dates?.arrival_min) {
    updates.estimated_delivery_date = payload.estimated_shipping_dates.arrival_min;
  }

  // Update the order
  const { error: updateError } = await supabaseAdmin
    .from('printed_cookbook_orders')
    .update(updates)
    .eq('id', order.id);

  if (updateError) {
    console.error('Failed to update order:', updateError);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }

  // Send notification email on shipped status
  if (newStatus === 'shipped') {
    // TODO: Send email notification via Resend
    // For now, just log it
    console.log(`Order ${order.id} shipped! Tracking: ${updates.tracking_number}`);
  }

  return NextResponse.json({ received: true, status: newStatus });
}
