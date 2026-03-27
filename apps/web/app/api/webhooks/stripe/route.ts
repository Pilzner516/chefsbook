import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const supabase = getServiceSupabase();
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return Response.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  if (
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.created'
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const tier = sub.items.data[0]?.price.lookup_key as 'pro' | 'family';
    await supabase
      .from('user_profiles')
      .update({ plan_tier: tier, stripe_subscription_id: sub.id })
      .eq('stripe_customer_id', sub.customer);
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    await supabase
      .from('user_profiles')
      .update({ plan_tier: 'free', stripe_subscription_id: null })
      .eq('stripe_customer_id', sub.customer);
  }

  return Response.json({ received: true });
}
