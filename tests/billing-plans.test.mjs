import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLAN_LABELS, checkoutPrices, planForPriceId, priceIdFor, workerLimitForTier } from '../lib/billing-plans.ts';

const PRICES = {
  STRIPE_PRICE_HOUSEHOLD_MONTHLY: 'price_household_m',
  STRIPE_PRICE_HOUSEHOLD_ANNUAL: 'price_household_y',
  STRIPE_PRICE_PLUS_MONTHLY: 'price_plus_m',
  STRIPE_PRICE_PLUS_ANNUAL: 'price_plus_y',
  STRIPE_PRICE_TEAM_MONTHLY: 'price_team_m',
  STRIPE_PRICE_TEAM_ANNUAL: 'price_team_y',
};

function withPrices(run) {
  const saved = {};
  for (const key of Object.keys(PRICES)) { saved[key] = process.env[key]; process.env[key] = PRICES[key]; }
  try { run(); } finally { for (const key of Object.keys(PRICES)) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } }
}

test('plan tiers map to worker limits', () => {
  assert.equal(workerLimitForTier('free'), 2);
  assert.equal(workerLimitForTier('household'), 3);
  assert.equal(workerLimitForTier('plus'), 8);
  assert.equal(workerLimitForTier('team'), Number.POSITIVE_INFINITY);
  assert.equal(workerLimitForTier('unknown'), 2);
});

test('price ids resolve to plan tiers for both intervals', () => {
  withPrices(() => {
    assert.equal(planForPriceId('price_household_m'), 'household');
    assert.equal(planForPriceId('price_household_y'), 'household');
    assert.equal(planForPriceId('price_plus_m'), 'plus');
    assert.equal(planForPriceId('price_team_y'), 'team');
    assert.equal(planForPriceId('price_unrelated'), null);
  });
});

test('priceIdFor returns the configured price for a tier and interval', () => {
  withPrices(() => {
    assert.equal(priceIdFor('household', 'month'), 'price_household_m');
    assert.equal(priceIdFor('team', 'year'), 'price_team_y');
    assert.equal(priceIdFor('free', 'month'), null);
  });
});

test('checkoutPrices lists every configured tier and interval', () => {
  withPrices(() => {
    const prices = checkoutPrices();
    assert.equal(prices.length, 6);
    assert.deepEqual(prices.find((item) => item.tier === 'plus' && item.interval === 'year'), { tier: 'plus', interval: 'year', priceId: 'price_plus_y' });
  });
});

test('checkoutPrices omits tiers whose env vars are unset', () => {
  assert.equal(checkoutPrices().length, 0);
});

test('every plan tier has a display label', () => {
  assert.deepEqual(Object.keys(PLAN_LABELS).sort(), ['free', 'household', 'plus', 'team']);
});
