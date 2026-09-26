type TimeEntry = { memberId: string; startedAt: string; endedAt: string | null };
type PaidWorker = { id: string; hourlyRate?: number | null };

export const CSIL_EXPENSE_CATEGORIES = [
  'wages', 'statutory_costs', 'bookkeeping', 'recruitment', 'training', 'backup_agency', 'insurance', 'other',
] as const;
export type CsilExpenseCategory = (typeof CSIL_EXPENSE_CATEGORIES)[number];
export type CsilEligibilityStatus = 'confirmed' | 'pending' | 'ineligible';
export type CsilReportStatus = 'draft' | 'submitted' | 'accepted' | 'returned';

export type CsilExpense = {
  id: string; expenseDate: string; vendor: string; category: CsilExpenseCategory; description: string;
  amount: number; eligibilityStatus: CsilEligibilityStatus; receiptReference: string; createdBy: string;
  createdAt: string; updatedAt: string;
};

export type CsilMonthlyReport = {
  id: string; reportMonth: string; status: CsilReportStatus; submittedAt: string | null;
  notes: string; createdBy: string; createdAt: string; updatedAt: string;
};

export function reportDueDate(month: string, dueDays = 45) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  date.setUTCDate(date.getUTCDate() + Math.max(1, Math.min(90, dueDays)) - 1);
  return date.toISOString().slice(0, 10);
}

export function csilMonthSummary(options: {
  month: string; entries: TimeEntry[]; workers: PaidWorker[]; fundedHoursMonthly: number; fundingHourlyRate: number;
  clientContribution?: number; expenses: CsilExpense[]; dueDays?: number; now?: string;
}) {
  const [year, monthNumber] = options.month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const start = `${options.month}-01`;
  const end = `${options.month}-${String(daysInMonth).padStart(2, '0')}`;
  const now = options.now ?? new Date().toISOString();
  const perWorker = options.workers.map((worker) => {
    const minutes = options.entries.filter((entry) => entry.memberId === worker.id && entry.startedAt.slice(0, 10) >= start && entry.startedAt.slice(0, 10) <= end).reduce((total, entry) => total + Math.max(0, (new Date(entry.endedAt ?? now).getTime() - new Date(entry.startedAt).getTime()) / 60000), 0);
    return { workerId: worker.id, minutes, cost: worker.hourlyRate ? (minutes / 60) * worker.hourlyRate : null };
  });
  const usedMinutes = perWorker.reduce((sum, row) => sum + row.minutes, 0);
  const fundedMinutes = options.fundedHoursMonthly * 60;
  const dayOfMonth = Math.min(daysInMonth, Math.max(1, Number(now.slice(8, 10))));
  const funding = { start, end, perWorker, usedMinutes, fundedMinutes, remainingMinutes: fundedMinutes - usedMinutes, projectedMinutes: (usedMinutes / dayOfMonth) * daysInMonth, fundedValue: options.fundedHoursMonthly * options.fundingHourlyRate, laborCost: perWorker.reduce((sum, row) => sum + (row.cost ?? 0), 0) };
  const monthExpenses = options.expenses.filter((expense) => expense.expenseDate.startsWith(`${options.month}-`));
  const confirmedExpenses = monthExpenses.filter((expense) => expense.eligibilityStatus === 'confirmed').reduce((sum, expense) => sum + expense.amount, 0);
  const pendingExpenses = monthExpenses.filter((expense) => expense.eligibilityStatus === 'pending').reduce((sum, expense) => sum + expense.amount, 0);
  const ineligibleExpenses = monthExpenses.filter((expense) => expense.eligibilityStatus === 'ineligible').reduce((sum, expense) => sum + expense.amount, 0);
  const available = funding.fundedValue + Math.max(0, options.clientContribution ?? 0);
  const accountableSpend = funding.laborCost + confirmedExpenses;
  const missingReceipts = monthExpenses.filter((expense) => expense.eligibilityStatus !== 'ineligible' && !expense.receiptReference.trim()).length;
  const dueDate = reportDueDate(options.month, options.dueDays);
  return { ...funding, monthExpenses, confirmedExpenses, pendingExpenses, ineligibleExpenses, available, accountableSpend, balance: available - accountableSpend, missingReceipts, dueDate };
}

export function csilReadiness(options: {
  healthAuthority?: string; agreementStart?: string | null; accountLastFour?: string; fundedHoursMonthly: number;
  fundingHourlyRate: number; activeWorkerCount: number; missingReceipts: number;
}) {
  return [
    { id: 'agreement', label: 'CSIL agreement details recorded', complete: Boolean(options.healthAuthority && options.agreementStart) },
    { id: 'account', label: 'Dedicated CSIL account confirmed', complete: /^\d{4}$/.test(options.accountLastFour ?? '') },
    { id: 'funding', label: 'Assessed hours and funding rate recorded', complete: options.fundedHoursMonthly > 0 && options.fundingHourlyRate > 0 },
    { id: 'workers', label: 'At least one active care worker is set up', complete: options.activeWorkerCount > 0 },
    { id: 'receipts', label: 'Every reportable expense has evidence', complete: options.missingReceipts === 0 },
  ];
}
