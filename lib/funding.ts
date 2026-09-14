import type { TimeEntry } from './time-tracking';

export type PaidWorker = { id: string; hourlyRate?: number | null };

export function monthRange(month: string) {
  const [year, mon] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}`, daysInMonth: last };
}

function entryMinutes(entry: TimeEntry, now: string) {
  return Math.max(0, (new Date(entry.endedAt ?? now).getTime() - new Date(entry.startedAt).getTime()) / 60000);
}

export function fundingSummary(options: {
  entries: TimeEntry[];
  workers: PaidWorker[];
  fundedHoursMonthly: number;
  fundingHourlyRate: number;
  month: string;
  now?: string;
}) {
  const { entries, workers, fundedHoursMonthly, fundingHourlyRate, month } = options;
  const now = options.now ?? new Date().toISOString();
  const { start, end, daysInMonth } = monthRange(month);
  const inMonth = entries.filter((entry) => entry.startedAt.slice(0, 10) >= start && entry.startedAt.slice(0, 10) <= end);
  const perWorker = workers.map((worker) => {
    const minutes = inMonth
      .filter((entry) => entry.memberId === worker.id)
      .reduce((total, entry) => total + entryMinutes(entry, now), 0);
    return { workerId: worker.id, minutes, cost: worker.hourlyRate ? (minutes / 60) * worker.hourlyRate : null };
  });
  const usedMinutes = perWorker.reduce((total, row) => total + row.minutes, 0);
  const fundedMinutes = fundedHoursMonthly * 60;
  const dayOfMonth = Math.min(daysInMonth, Math.max(1, Number(now.slice(8, 10))));
  const projectedMinutes = (usedMinutes / dayOfMonth) * daysInMonth;
  return {
    start,
    end,
    perWorker,
    usedMinutes,
    fundedMinutes,
    remainingMinutes: fundedMinutes - usedMinutes,
    projectedMinutes,
    fundedValue: fundedHoursMonthly * fundingHourlyRate,
    laborCost: perWorker.reduce((total, row) => total + (row.cost ?? 0), 0),
  };
}
