export type Shift = {
  id: string;
  memberId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  // 0 (or unset) = every week; 1 or 2 = that week of the two-week cycle
  cycleWeek?: number;
};

export function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

// Deterministic two-week cycle: odd ISO weeks are week 1, even ISO weeks are week 2.
export function cycleWeekOf(date: string): 1 | 2 {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7)); // move to this ISO week's Thursday
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((day.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return isoWeek % 2 === 1 ? 1 : 2;
}

export function shiftsForDay<T extends Shift>(shifts: T[], date: string) {
  const weekday = weekdayOf(date);
  const cycleWeek = cycleWeekOf(date);
  return shifts
    .filter((shift) => shift.weekday === weekday && (!shift.cycleWeek || shift.cycleWeek === cycleWeek))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function formatShift(shift: Pick<Shift, 'startTime' | 'endTime'>) {
  return `${shift.startTime}–${shift.endTime}`;
}
