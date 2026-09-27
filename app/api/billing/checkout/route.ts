import { authenticatedAccess } from '@/lib/auth-access';
import { trustedMutationOrigin, localDevMode } from '@/lib/auth-config';
import { billingConfigured, getStripe, planForPriceId } from '@/lib/billing';

export async function POST(request: Request) {
  const access = await authenticatedAccess();
  if (!access) return Response.json({ error: 'Sign in to manage billing.' }, { status: 401 });
  if (access.mustChangePassword) return Response.json({ error: 'Change your temporary password first.' }, { status: 403 });
  if (access.role !== 'manager') return Response.json({ error: 'Only the household manager can manage billing.' }, { status: 403 });
  if (!billingConfigured()) return Response.json({ error: 'Billing is not configured on this deployment.' }, { status: 503 });
  if (!localDevMode() && !trustedMutationOrigin(request.headers.get('origin'))) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { priceId?: string };
  const priceId = typeof body.priceId === 'string' ? body.priceId.trim() : '';
  if (!priceId || !planForPriceId(priceId)) return Response.json({ error: 'Unknown plan.' }, { status: 400 });

  try {
    const origin = request.headers.get('origin') ?? new URL(request.url).origin;
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: access.email,
      client_reference_id: 'default',
      success_url: `${origin}/dashboard?billing=success`,
      cancel_url: `${origin}/dashboard?billing=cancelled`,
      allow_promotion_codes: true,
      metadata: { household_id: 'default' },
      subscription_data: { metadata: { household_id: 'default' } },
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('checkout session failed', error);
    return Response.json({ error: 'Could not start checkout. Please try again.' }, { status: 502 });
  }
}
