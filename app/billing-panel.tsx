'use client';

import { useEffect, useState } from 'react';
import { CreditCard, ExternalLink, RefreshCw } from 'lucide-react';

type BillingStatus = {
  configured: boolean;
  canManage?: boolean;
  workers?: number;
  plan?: {
    tier: 'free' | 'household' | 'plus' | 'team';
    label: string;
    status: string;
    workerLimit: number;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    manageAvailable: boolean;
  };
  prices?: { tier: 'household' | 'plus' | 'team'; interval: 'month' | 'year'; priceId: string }[];
};

const TIER_INFO: Record<'household' | 'plus' | 'team', { label: string; monthly: number; annual: number; workers: string; features: string[] }> = {
  household: { label: 'Household', monthly: 15, annual: 150, workers: 'Up to 3 care workers', features: ['Task scheduling & two-week rota', 'Care plan & medication log', 'Shift handoffs & safety reporting'] },
  plus: { label: 'Household Plus', monthly: 29, annual: 290, workers: 'Up to 8 care workers', features: ['Everything in Household', 'CSIL records & reconciliation', 'Receipt capture & payroll CSV'] },
  team: { label: 'Team', monthly: 49, annual: 490, workers: 'Unlimited care workers', features: ['Everything in Household Plus', 'Priority support', 'Year-end export packages'] },
};

export function BillingPanel() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [interval_, setInterval] = useState<'month' | 'year'>('month');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/billing/status').then((response) => response.ok ? response.json() : null).then(setStatus).catch(() => setStatus(null));
  }, []);

  if (!status?.configured || !status.plan) return null;

  const plan = status.plan;

  async function go(endpoint: string, body?: Record<string, string>) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || 'Something went wrong.');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  const priceFor = (tier: 'household' | 'plus' | 'team') => status.prices?.find((price) => price.tier === tier && price.interval === interval_)?.priceId;

  return (
    <section aria-labelledby="billing-heading" className="mt-6">
      <div className="rounded-2xl border border-[#e2e8e1] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-[#287b6f]" aria-hidden />
          <h2 id="billing-heading" className="text-lg font-bold text-[#1e2f2a]">Subscription</h2>
        </div>

        <p className="mt-3 text-sm text-[#52645f]">
          Current plan: <span className="font-semibold text-[#1e2f2a]">{plan.label}</span>
          {plan.status !== 'none' && <span className="ml-2 rounded-full bg-[#e6f0eb] px-2 py-0.5 text-xs font-semibold text-[#287b6f]">{plan.status}</span>}
        </p>
        <p className="mt-1 text-sm text-[#52645f]">
          Care workers: {status.workers}{Number.isFinite(plan.workerLimit) ? ` of ${plan.workerLimit} allowed` : ' (unlimited)'}
          {plan.currentPeriodEnd && <> · renews {new Date(plan.currentPeriodEnd).toLocaleDateString()}</>}
          {plan.cancelAtPeriodEnd && <> · <span className="font-semibold">cancels at period end</span></>}
        </p>

        {status.canManage && (
          <>
            {plan.manageAvailable && (
              <button type="button" disabled={busy} onClick={() => go('/api/billing/portal')}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#287b6f] px-4 text-sm font-semibold text-white transition hover:bg-[#1f665c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f] disabled:opacity-50">
                <ExternalLink className="size-4" aria-hidden /> Manage subscription
              </button>
            )}

            <fieldset className="mt-6 flex items-center gap-2">
              <legend className="sr-only">Billing interval</legend>
              {(['month', 'year'] as const).map((value) => (
                <button key={value} type="button" onClick={() => setInterval(value)} aria-pressed={interval_ === value}
                  className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f] ${interval_ === value ? 'bg-[#287b6f] text-white' : 'bg-[#f1f5f1] text-[#52645f] hover:bg-[#e5eae4]'}`}>
                  {value === 'month' ? 'Monthly' : 'Annual (2 months free)'}
                </button>
              ))}
            </fieldset>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {(Object.keys(TIER_INFO) as ('household' | 'plus' | 'team')[]).map((tier) => {
                const info = TIER_INFO[tier];
                const active = plan.tier === tier && plan.status !== 'none' && plan.status !== 'canceled';
                const priceId = priceFor(tier);
                return (
                  <div key={tier} className={`rounded-2xl border p-4 ${active ? 'border-[#287b6f] bg-[#f4faf8]' : 'border-[#e5eae4] bg-[#fffefa]'}`}>
                    <p className="font-bold text-[#1e2f2a]">{info.label}</p>
                    <p className="mt-1 text-2xl font-bold text-[#287b6f]">${interval_ === 'month' ? info.monthly : info.annual}<span className="text-sm font-semibold text-[#52645f]"> CAD/{interval_ === 'month' ? 'mo' : 'yr'}</span></p>
                    <p className="mt-1 text-xs font-semibold text-[#52645f]">{info.workers}</p>
                    <ul className="mt-2 space-y-1 text-xs text-[#52645f]">
                      {info.features.map((feature) => <li key={feature}>· {feature}</li>)}
                    </ul>
                    <button type="button" disabled={busy || active || !priceId} onClick={() => priceId && go('/api/billing/checkout', { priceId })}
                      className={`mt-4 w-full min-h-11 rounded-xl text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f] disabled:opacity-60 ${active ? 'bg-[#e6f0eb] text-[#287b6f]' : 'bg-[#287b6f] text-white hover:bg-[#1f665c]'}`}>
                      {active ? 'Current plan' : busy ? <RefreshCw className="mx-auto size-4 animate-spin" aria-hidden /> : plan.manageAvailable ? 'Switch plan' : 'Subscribe'}
                    </button>
                  </div>
                );
              })}
            </div>
            {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
          </>
        )}
      </div>
    </section>
  );
}
