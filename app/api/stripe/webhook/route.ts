import { getStripe, saveSubscription, planForPriceId, syncSubscriptionFromStripe } from '@/lib/billing';
import type Stripe from 'stripe';

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return Response.json({ error: 'Webhook not configured.' }, { status: 503 });

  const signature = request.headers.get('stripe-signature');
  const body = await request.text();
  if (!signature || !body) return Response.json({ error: 'Missing signature.' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return Response.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (session.mode === 'subscription' && subscriptionId) await syncSubscriptionFromStripe(subscriptionId);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price.id ?? null;
        await saveSubscription({
          stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
          stripeSubscriptionId: subscription.id,
          priceId,
          planTier: priceId ? planForPriceId(priceId) ?? 'free' : 'free',
          status: subscription.status,
          currentPeriodEnd: subscription.items.data[0]?.current_period_end ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString() : null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionRef = invoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id;
        if (subscriptionId) await syncSubscriptionFromStripe(subscriptionId);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`stripe webhook ${event.type} failed`, error);
    return Response.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  return Response.json({ received: true });
}
