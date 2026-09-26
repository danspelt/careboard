/** Household hours of operation — the regular weekly window care usually runs. */

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidClockTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** Parse "1,2,3,4,5" into unique weekday ints 0–6. */
export function parseOperatingWeekdays(raw: string | null | undefined): number[] {
  if (!raw || typeof raw !== 'string') return [1, 2, 3, 4, 5];
  const days = [...new Set(
    raw.split(',')
      .map((part) => Number(part.trim()))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  )].sort((a, b) => a - b);
  return days.length ? days : [1, 2, 3, 4, 5];
}

export function serializeOperatingWeekdays(days: number[]): string {
  const clean = [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
  return (clean.length ? clean : [1, 2, 3, 4, 5]).join(',');
}

export function normalizeOperatingHours(start: string, end: string): { start: string; end: string } {
  const safeStart = isValidClockTime(start) ? start : '08:00';
  const safeEnd = isValidClockTime(end) ? end : '14:00';
  if (safeStart >= safeEnd) return { start: '08:00', end: '14:00' };
  return { start: safeStart, end: safeEnd };
}

export function formatClockLabel(value: string): string {
  if (!isValidClockTime(value)) return value;
  const [hRaw, m] = value.split(':');
  let hour = Number(hRaw);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${m} ${suffix}`;
}

export function formatOperatingHoursSummary(options: {
  start: string;
  end: string;
  weekdays: string | number[];
}): string {
  const { start, end } = normalizeOperatingHours(options.start, options.end);
  const days = Array.isArray(options.weekdays) ? options.weekdays : parseOperatingWeekdays(options.weekdays);
  const dayText = days.length === 7
    ? 'Every day'
    : days.length === 5 && days.join(',') === '1,2,3,4,5'
      ? 'Weekdays'
      : days.map((day) => WEEKDAY_LABELS[day]).join(', ');
  return `${dayText} ${formatClockLabel(start)}–${formatClockLabel(end)}`;
}

export function parseWeekdaysFromForm(raw: FormDataEntryValue | FormDataEntryValue[] | null | undefined): number[] {
  if (raw == null) return [1, 2, 3, 4, 5];
  const values = Array.isArray(raw) ? raw : [raw];
  return parseOperatingWeekdays(values.map(String).join(','));
}
