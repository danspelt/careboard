import 'server-only';

import Stripe from 'stripe';
import { getD1 } from '@/db';
import { PLAN_LABELS, planForPriceId, workerLimitForTier, type PlanTier } from './billing-plans';

export { PLAN_LABELS, billingConfigured, checkoutPrices, planForPriceId, priceIdFor, workerLimitForTier } from './billing-plans';
export type { BillingInterval, PlanTier } from './billing-plans';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Billing is not configured on this deployment.');
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

export type SubscriptionRow = {
  householdId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  priceId: string | null;
  planTier: PlanTier;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
};

type RawRow = {
  household_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  price_id: string | null;
  plan_tier: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: number;
  updated_at: string;
};

function normalizeTier(tier: string): PlanTier {
  return tier === 'household' || tier === 'plus' || tier === 'team' ? tier : 'free';
}

export async function getSubscription(): Promise<SubscriptionRow | null> {
  const row = await getD1()
    .prepare('SELECT * FROM household_subscriptions WHERE household_id=?')
    .bind('default')
    .first<RawRow>();
  if (!row) return null;
  return {
    householdId: row.household_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    priceId: row.price_id,
    planTier: normalizeTier(row.plan_tier),
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end === 1,
    updatedAt: row.updated_at,
  };
}

export async function saveSubscription(input: {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  priceId: string | null;
  planTier: PlanTier;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}) {
  await getD1()
    .prepare(
      `INSERT INTO household_subscriptions(household_id, stripe_customer_id, stripe_subscription_id, price_id, plan_tier, status, current_period_end, cancel_at_period_end, updated_at)
       VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(household_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id, stripe_subscription_id=excluded.stripe_subscription_id, price_id=excluded.price_id, plan_tier=excluded.plan_tier, status=excluded.status, current_period_end=excluded.current_period_end, cancel_at_period_end=excluded.cancel_at_period_end, updated_at=excluded.updated_at`,
    )
    .bind(input.stripeCustomerId, input.stripeSubscriptionId, input.priceId, input.planTier, input.status, input.currentPeriodEnd, input.cancelAtPeriodEnd ? 1 : 0, new Date().toISOString())
    .run();
}

export type HouseholdPlan = {
  tier: PlanTier;
  label: string;
  status: string;
  workerLimit: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  manageAvailable: boolean;
};

export async function currentPlan(): Promise<HouseholdPlan> {
  const sub = await getSubscription();
  const active = sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due');
  const tier = active ? sub.planTier : 'free';
  return {
    tier,
    label: PLAN_LABELS[tier],
    status: sub?.status ?? 'none',
    workerLimit: workerLimitForTier(tier),
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    manageAvailable: Boolean(sub?.stripeCustomerId),
  };
}

export async function activeWorkerCount(): Promise<number> {
  const row = await getD1()
    .prepare(`SELECT COUNT(*) AS count FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.role='worker' AND COALESCE(l.status,'active') IN ('active','invited')`)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function assertWorkerCapacity() {
  const plan = await currentPlan();
  if (!Number.isFinite(plan.workerLimit)) return;
  const count = await activeWorkerCount();
  if (count >= plan.workerLimit) {
    throw new Error(`Your ${plan.label} plan allows up to ${plan.workerLimit} care workers. Upgrade your plan in Settings to add more.`);
  }
}

export async function syncSubscriptionFromStripe(subscriptionId: string) {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const tier = priceId ? planForPriceId(priceId) ?? 'free' : 'free';
  await saveSubscription({
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    priceId,
    planTier: tier,
    status: subscription.status,
    currentPeriodEnd: subscription.items.data[0]?.current_period_end ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString() : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
  return { tier, status: subscription.status };
}
