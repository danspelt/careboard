'use client';

import { AlertTriangle, Check, CircleDollarSign, FileDown, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { HouseholdState, Member } from '@/lib/household-data';
import { CSIL_EXPENSE_CATEGORIES, csilMonthSummary, csilReadiness } from '@/lib/csil';

const fieldClass = 'mt-1 min-h-11 w-full rounded-xl border border-[#d7dfd7] bg-white px-3 py-2 text-sm';
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

export function CsilPanel({ state, mutate, busy }: { state: HouseholdState; mutate: (payload: Record<string, unknown>, message?: string) => Promise<unknown>; busy: boolean }) {
  const month = new Date().toISOString().slice(0, 7);
  const settings = state.settings;
  const workers = state.members.filter((member: Member) => member.role === 'worker');
  const summary = csilMonthSummary({
    month, entries: state.timeEntries ?? [], workers: workers.map((worker) => ({ id: worker.id, hourlyRate: worker.hourlyRate })),
    expenses: state.csilExpenses ?? [], fundedHoursMonthly: settings?.fundedHoursMonthly ?? 0,
    fundingHourlyRate: settings?.fundingHourlyRate ?? 0, clientContribution: settings?.csilClientContribution ?? 0,
    dueDays: settings?.csilReportDueDays ?? 45,
  });
  const readiness = csilReadiness({
    healthAuthority: settings?.csilHealthAuthority, agreementStart: settings?.csilAgreementStart,
    accountLastFour: settings?.csilAccountLastFour, fundedHoursMonthly: settings?.fundedHoursMonthly ?? 0,
    fundingHourlyRate: settings?.fundingHourlyRate ?? 0, activeWorkerCount: workers.filter((worker) => worker.status === 'active').length,
    missingReceipts: summary.missingReceipts,
  });
  const report = (state.csilMonthlyReports ?? []).find((item) => item.reportMonth === month);
  return (
    <section className="mt-6 space-y-6" aria-labelledby="csil-heading">
      <div className="rounded-2xl border border-[#bcd4c9] bg-[#f2f7f1] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 id="csil-heading" className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="size-5 text-[#287b6f]" />CSIL accountability</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-[#52645f]">Manager-only records for the CSIL agreement, dedicated account, expenses, evidence and monthly health-authority reporting. Confirm eligibility against your own agreement.</p></div>
          <a href={`/api/csil-report?month=${month}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#287b6f] px-4 text-sm font-semibold text-white"><FileDown className="size-4" />Export {month}</a>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[['Available', summary.available], ['Payroll', summary.laborCost], ['Confirmed expenses', summary.confirmedExpenses], ['Pending review', summary.pendingExpenses], ['Balance', summary.balance]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-white p-3"><p className="text-xs font-semibold text-[#687873]">{label}</p><p className="mt-1 font-bold tabular-nums">{money.format(Number(value))}</p></div>)}
        </div>
        <p className="mt-3 text-xs text-[#687873]">Report due {summary.dueDate} using the default {settings?.csilReportDueDays ?? 45}-day window · {summary.missingReceipts} expense{summary.missingReceipts === 1 ? '' : 's'} missing evidence.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#dfe5dc] bg-white p-5">
          <h3 className="font-bold">Employer readiness</h3>
          <ul className="mt-3 space-y-2">{readiness.map((item) => <li key={item.id} className="flex items-center gap-2 text-sm">{item.complete ? <Check className="size-4 text-[#287b6f]" /> : <AlertTriangle className="size-4 text-[#b4532a]" />}<span>{item.label}</span></li>)}</ul>
          <p className="mt-4 text-xs leading-5 text-[#687873]">CareBoard also provides worker onboarding checklists, credential expiry alerts, scheduling, time records, payroll inputs, safety reporting, backup-shift coverage, policy acknowledgements and an append-only audit history.</p>
        </div>
        <form className="rounded-2xl border border-[#dfe5dc] bg-white p-5" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; void mutate({ action: 'saveCsilMonthlyReport', ...Object.fromEntries(new FormData(form)) }, 'CSIL report status saved.').then(() => form.reset()).catch(() => {}); }}>
          <h3 className="font-bold">Monthly filing</h3>
          <input type="hidden" name="reportMonth" value={month} />
          <label htmlFor="csil-report-status" className="mt-3 block text-sm font-semibold">Status</label><select id="csil-report-status" name="status" defaultValue={report?.status ?? 'draft'} className={fieldClass}><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="accepted">Accepted</option><option value="returned">Returned for changes</option></select>
          <label htmlFor="csil-report-notes" className="mt-3 block text-sm font-semibold">Submission notes</label><textarea id="csil-report-notes" name="notes" defaultValue={report?.notes ?? ''} rows={3} className={fieldClass} />
          <Button type="submit" disabled={busy} className="mt-3 min-h-11 bg-[#287b6f]">Save filing status</Button>
        </form>
      </div>

      <div className="rounded-2xl border border-[#dfe5dc] bg-white p-5">
        <h3 className="font-bold">Expense and receipt register</h3>
        <p className="mt-1 text-sm text-[#687873]">Record non-payroll spending and whether your health-authority agreement confirms it. Receipt/reference can be a bank transaction, invoice number, or secure document reference.</p>
        <form className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; void mutate({ action: 'saveCsilExpense', ...Object.fromEntries(new FormData(form)) }, 'CSIL expense saved.').then(() => form.reset()).catch(() => {}); }}>
          <div><label htmlFor="csil-expense-date" className="text-sm font-semibold">Date</label><Input id="csil-expense-date" name="expenseDate" type="date" required defaultValue={`${month}-01`} className="mt-1 min-h-11" /></div>
          <div><label htmlFor="csil-expense-vendor" className="text-sm font-semibold">Vendor</label><Input id="csil-expense-vendor" name="vendor" required maxLength={160} className="mt-1 min-h-11" /></div>
          <div><label htmlFor="csil-expense-category" className="text-sm font-semibold">Category</label><select id="csil-expense-category" name="category" className={fieldClass}>{CSIL_EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select></div>
          <div><label htmlFor="csil-expense-amount" className="text-sm font-semibold">Amount</label><Input id="csil-expense-amount" name="amount" type="number" min="0.01" step="0.01" required className="mt-1 min-h-11" /></div>
          <div><label htmlFor="csil-expense-status" className="text-sm font-semibold">Agreement status</label><select id="csil-expense-status" name="eligibilityStatus" defaultValue="pending" className={fieldClass}><option value="confirmed">Confirmed eligible</option><option value="pending">Needs confirmation</option><option value="ineligible">Not CSIL-funded</option></select></div>
          <div><label htmlFor="csil-expense-receipt" className="text-sm font-semibold">Receipt/reference</label><Input id="csil-expense-receipt" name="receiptReference" maxLength={240} className="mt-1 min-h-11" /></div>
          <div className="md:col-span-2"><label htmlFor="csil-expense-description" className="text-sm font-semibold">Description</label><Input id="csil-expense-description" name="description" maxLength={500} className="mt-1 min-h-11" /></div>
          <Button type="submit" disabled={busy} className="min-h-11 bg-[#287b6f] md:col-span-2 lg:col-span-4"><Plus className="size-4" />Add expense</Button>
        </form>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs text-[#687873]"><th className="p-2">Date</th><th className="p-2">Vendor</th><th className="p-2">Category</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Evidence</th><th className="p-2"><span className="sr-only">Actions</span></th></tr></thead><tbody>{summary.monthExpenses.map((expense) => <tr key={expense.id} className="border-b border-[#edf0eb]"><td className="p-2">{expense.expenseDate}</td><td className="p-2 font-medium">{expense.vendor}</td><td className="p-2">{expense.category.replaceAll('_', ' ')}</td><td className="p-2 tabular-nums">{money.format(expense.amount)}</td><td className="p-2">{expense.eligibilityStatus}</td><td className="p-2">{expense.receiptReference || 'Missing'}</td><td className="p-2"><button type="button" className="grid size-10 place-items-center rounded-lg hover:bg-[#f1f5f1]" aria-label={`Delete expense from ${expense.vendor}`} onClick={() => void mutate({ action: 'deleteCsilExpense', expenseId: expense.id }, 'CSIL expense removed.')}><Trash2 className="size-4" /></button></td></tr>)}</tbody></table>{summary.monthExpenses.length === 0 && <p className="p-4 text-center text-sm text-[#687873]">No non-payroll expenses recorded for this month.</p>}</div>
      </div>
      <p className="text-xs leading-5 text-[#687873]"><CircleDollarSign className="mr-1 inline size-4" />CareBoard is an operational record, not legal, accounting, payroll or eligibility advice. Keep original statements and receipts according to your agreement and health authority’s instructions.</p>
    </section>
  );
}
