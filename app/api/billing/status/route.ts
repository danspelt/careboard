import { authenticatedAccess } from '@/lib/auth-access';
import { activeWorkerCount, billingConfigured, checkoutPrices, currentPlan } from '@/lib/billing';

export async function GET() {
  const access = await authenticatedAccess();
  if (!access) return Response.json({ error: 'Sign in to view billing.' }, { status: 401 });
  if (!billingConfigured()) return Response.json({ configured: false });

  const [plan, workers] = await Promise.all([currentPlan(), activeWorkerCount()]);
  return Response.json(
    {
      configured: true,
      plan,
      workers,
      prices: checkoutPrices(),
      canManage: access.role === 'manager',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
