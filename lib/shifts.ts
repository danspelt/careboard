export type Shift = {
  id: string;
  memberId: string;
  weekday: number;
  startTime: string;
  endTime: string;
};

export function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function shiftsForDay<T extends Shift>(shifts: T[], date: string) {
  const weekday = weekdayOf(date);
  return shifts.filter((shift) => shift.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function formatShift(shift: Pick<Shift, 'startTime' | 'endTime'>) {
  return `${shift.startTime}–${shift.endTime}`;
}
