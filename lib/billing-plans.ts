export type PlanTier = 'free' | 'household' | 'plus' | 'team';
export type BillingInterval = 'month' | 'year';

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  household: 'Household',
  plus: 'Household Plus',
  team: 'Team',
};

export function workerLimitForTier(tier: PlanTier): number {
  switch (tier) {
    case 'household': return 3;
    case 'plus': return 8;
    case 'team': return Number.POSITIVE_INFINITY;
    default: return 2;
  }
}

export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function envPriceIds(): Partial<Record<PlanTier, Partial<Record<BillingInterval, string>>>> {
  return {
    household: { month: process.env.STRIPE_PRICE_HOUSEHOLD_MONTHLY, year: process.env.STRIPE_PRICE_HOUSEHOLD_ANNUAL },
    plus: { month: process.env.STRIPE_PRICE_PLUS_MONTHLY, year: process.env.STRIPE_PRICE_PLUS_ANNUAL },
    team: { month: process.env.STRIPE_PRICE_TEAM_MONTHLY, year: process.env.STRIPE_PRICE_TEAM_ANNUAL },
  };
}

export function planForPriceId(priceId: string): PlanTier | null {
  for (const [tier, prices] of Object.entries(envPriceIds())) {
    if (prices.month === priceId || prices.year === priceId) return tier as PlanTier;
  }
  return null;
}

export function priceIdFor(tier: PlanTier, interval: BillingInterval): string | null {
  return envPriceIds()[tier]?.[interval] ?? null;
}

export function checkoutPrices(): { tier: PlanTier; interval: BillingInterval; priceId: string }[] {
  const result: { tier: PlanTier; interval: BillingInterval; priceId: string }[] = [];
  for (const [tier, prices] of Object.entries(envPriceIds())) {
    for (const interval of ['month', 'year'] as const) {
      const priceId = prices[interval];
      if (priceId) result.push({ tier: tier as PlanTier, interval, priceId });
    }
  }
  return result;
}
