import { authenticatedAccess } from '@/lib/auth-access';
import { trustedMutationOrigin, localDevMode } from '@/lib/auth-config';
import { billingConfigured, getStripe, getSubscription } from '@/lib/billing';

export async function POST(request: Request) {
  const access = await authenticatedAccess();
  if (!access) return Response.json({ error: 'Sign in to manage billing.' }, { status: 401 });
  if (access.mustChangePassword) return Response.json({ error: 'Change your temporary password first.' }, { status: 403 });
  if (access.role !== 'manager') return Response.json({ error: 'Only the household manager can manage billing.' }, { status: 403 });
  if (!billingConfigured()) return Response.json({ error: 'Billing is not configured on this deployment.' }, { status: 503 });
  if (!localDevMode() && !trustedMutationOrigin(request.headers.get('origin'))) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });

  const subscription = await getSubscription();
  if (!subscription?.stripeCustomerId) return Response.json({ error: 'No subscription exists yet.' }, { status: 404 });

  try {
    const origin = request.headers.get('origin') ?? new URL(request.url).origin;
    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${origin}/dashboard`,
    });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('portal session failed', error);
    return Response.json({ error: 'Could not open the billing portal. Please try again.' }, { status: 502 });
  }
}
