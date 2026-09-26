import type { Shift } from '@/lib/shifts';
import { shiftsForDay } from '@/lib/shifts';
import type { TimeEntry } from '@/lib/time-tracking';
import { openEntryFor } from '@/lib/time-tracking';

export type AttendanceStatus = 'on_duty' | 'late' | 'upcoming' | 'finished' | 'off_today' | 'unscheduled_on_duty' | 'on_leave';
export type AttendanceRow = { workerId: string; shift: Shift | null; openEntry: TimeEntry | null; status: AttendanceStatus; minutesLate: number };

const statusOrder: AttendanceStatus[] = ['late', 'unscheduled_on_duty', 'on_duty', 'upcoming', 'finished', 'on_leave', 'off_today'];

function minutesOf(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function buildAttendance(options: {
  workers: { id: string }[];
  shifts: Shift[];
  entries: TimeEntry[];
  date: string;
  nowTime: string;
  now: string;
  lateAfterMinutes?: number;
  onLeaveIds?: string[];
}): AttendanceRow[] {
  const { workers, shifts, entries, date, nowTime, lateAfterMinutes = 15, onLeaveIds = [] } = options;
  const leaveSet = new Set(onLeaveIds);
  const dayShifts = shiftsForDay(shifts, date);
  const rows = workers.map((worker, index) => {
    const shift = dayShifts.find((item) => item.memberId === worker.id) ?? null;
    const openEntry = openEntryFor(entries, worker.id);
    const workedToday = entries.some((entry) => entry.memberId === worker.id && entry.startedAt.slice(0, 10) === date);
    let status: AttendanceStatus;
    let minutesLate = 0;
    if (leaveSet.has(worker.id) && !openEntry) {
      status = 'on_leave';
    } else if (openEntry) {
      status = shift ? 'on_duty' : 'unscheduled_on_duty';
    } else if (!shift) {
      status = 'off_today';
    } else if (nowTime < shift.startTime) {
      status = 'upcoming';
    } else if (nowTime >= shift.endTime) {
      status = 'finished';
    } else if (workedToday) {
      status = 'finished';
    } else {
      minutesLate = minutesOf(nowTime) - minutesOf(shift.startTime);
      status = minutesLate >= lateAfterMinutes ? 'late' : 'upcoming';
    }
    return { workerId: worker.id, shift, openEntry, status, minutesLate, index };
  });
  return rows
    .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status) || a.index - b.index)
    .map(({ index: _index, ...row }) => row);
}

export function attendanceLabel(row: AttendanceRow): string {
  switch (row.status) {
    case 'late': return `Late — shift started ${row.shift?.startTime ?? ''}`;
    case 'on_duty': return `On duty since ${new Date(row.openEntry?.startedAt ?? '').toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
    case 'unscheduled_on_duty': return 'On duty (no shift scheduled)';
    case 'upcoming': return `Starts ${row.shift?.startTime ?? ''}`;
    case 'finished': return row.shift ? `Shift ${row.shift.startTime}–${row.shift.endTime} finished` : 'Shift finished';
    case 'on_leave': return 'On approved leave';
    case 'off_today': return 'Not scheduled today';
  }
}
