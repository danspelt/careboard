/** Pay period math and wage-statement helpers (pure). */

export type PeriodBounds = { startOn: string; endOn: string };

export function addDaysISO(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Align a date into a pay period using an anchor Sunday-or-any start and period length. */
export function periodContaining(today: string, anchor: string, periodDays: number): PeriodBounds {
  const length = Math.max(1, Math.min(62, Math.floor(periodDays) || 14));
  const todayMs = Date.parse(`${today}T12:00:00Z`);
  const anchorMs = Date.parse(`${anchor}T12:00:00Z`);
  if (!Number.isFinite(todayMs) || !Number.isFinite(anchorMs)) {
    return { startOn: today, endOn: addDaysISO(today, length - 1) };
  }
  const dayMs = 86_400_000;
  const deltaDays = Math.floor((todayMs - anchorMs) / dayMs);
  const offset = ((deltaDays % length) + length) % length;
  const startOn = addDaysISO(today, -offset);
  return { startOn, endOn: addDaysISO(startOn, length - 1) };
}

export function nextPeriod(bounds: PeriodBounds, periodDays: number): PeriodBounds {
  const length = Math.max(1, Math.min(62, Math.floor(periodDays) || 14));
  const startOn = addDaysISO(bounds.endOn, 1);
  return { startOn, endOn: addDaysISO(startOn, length - 1) };
}

/** Period is ready to close when today is on or after endOn and status is open/review. */
export function payPeriodReadyToClose(period: { endOn: string; status: string } | null | undefined, today: string) {
  if (!period) return false;
  if (period.status !== 'open' && period.status !== 'review') return false;
  return today >= period.endOn;
}

export type WageLineInput = {
  workerName: string;
  hours: number;
  hourlyRate: number | null;
  grossAmount: number;
};

export function wageStatementRows(
  workerName: string,
  period: PeriodBounds,
  line: { hours: number; hourlyRate: number | null; grossAmount: number },
): unknown[][] {
  return [
    ['Wage statement (gross)'],
    ['Worker', workerName],
    ['Pay period', `${period.startOn} to ${period.endOn}`],
    [],
    ['Hours', line.hours.toFixed(2)],
    ['Hourly rate', line.hourlyRate != null ? line.hourlyRate.toFixed(2) : ''],
    ['Gross pay', line.hourlyRate != null ? line.grossAmount.toFixed(2) : ''],
    [],
    ['Note', 'Deductions, net pay, and remittances are handled by your bookkeeper or payroll software.'],
  ];
}

export function aggregateWorkerHours(
  entries: Array<{ id: string; startedAt: string; endedAt: string | null }>,
  from: string,
  to: string,
  nowIso = new Date().toISOString(),
) {
  let hours = 0;
  const entryIds: string[] = [];
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T23:59:59.999Z`);
  for (const entry of entries) {
    const startMs = Date.parse(entry.startedAt);
    if (!Number.isFinite(startMs) || startMs < fromMs || startMs > toMs) continue;
    const endMs = Date.parse(entry.endedAt ?? nowIso);
    hours += Math.max(0, (endMs - startMs) / 3_600_000);
    entryIds.push(entry.id);
  }
  return { hours, entryIds };
}

export function grossFor(hours: number, hourlyRate: number | null) {
  if (hourlyRate == null) return 0;
  return hours * hourlyRate;
}
