import { cycleWeekOf } from '@/lib/shifts';

export type PayrollEntry = { startedAt: string; endedAt: string | null };
export type PayrollWorker = { name: string; hourlyRate: number | null; entries: PayrollEntry[] };

function fmt(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Pay periods follow the two-week shift cycle: week 1 + week 2 = one period
// ending on the Sunday of each even ISO week.
export function lastCompletePeriod(today: string): { start: string; end: string } {
  const day = new Date(`${today}T12:00:00Z`);
  const dow = day.getUTCDay() || 7;
  const monday = new Date(day.getTime() - (dow - 1) * 864e5);
  const end = new Date(monday.getTime() - (cycleWeekOf(today) === 1 ? 1 : 8) * 864e5);
  const start = new Date(end.getTime() - 13 * 864e5);
  return { start: fmt(start), end: fmt(end) };
}

export function payrollRows(workers: PayrollWorker[], from: string, to: string): unknown[][] {
  const rows: unknown[][] = [
    ['Pay period', `${from} to ${to}`],
    [],
    ['Worker', 'Date', 'Day', 'Clock in (UTC)', 'Clock out (UTC)', 'Hours', 'Rate', 'Gross pay'],
  ];
  let grandHours = 0;
  let grandGross = 0;
  for (const worker of workers) {
    let workerHours = 0;
    let workerGross = 0;
    for (const entry of worker.entries) {
      const end = entry.endedAt ?? new Date().toISOString();
      const hours = Math.max(0, (new Date(end).getTime() - new Date(entry.startedAt).getTime()) / 3_600_000);
      const gross = worker.hourlyRate ? hours * worker.hourlyRate : 0;
      workerHours += hours;
      workerGross += gross;
      const day = new Date(`${entry.startedAt.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      rows.push([worker.name, entry.startedAt.slice(0, 10), day, entry.startedAt, entry.endedAt ?? 'in progress', hours.toFixed(2), worker.hourlyRate ?? '', worker.hourlyRate ? gross.toFixed(2) : '']);
    }
    grandHours += workerHours;
    grandGross += workerGross;
    rows.push([`${worker.name} — total`, '', '', '', '', workerHours.toFixed(2), '', worker.hourlyRate ? workerGross.toFixed(2) : '']);
    rows.push([]);
  }
  rows.push(['Grand total', '', '', '', '', grandHours.toFixed(2), '', grandGross.toFixed(2)]);
  return rows;
}
