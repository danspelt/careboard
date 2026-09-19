export type WorkloadShift = { memberId: string; weekday: number; startTime: string; endTime: string };
export type WorkloadTask = { assignedTo: string | null; dueDate: string | null; status: string };
export type WorkloadWarning = { memberId: string; code: 'consecutive_days' | 'short_turnaround' | 'high_task_load' | 'overdue_work'; title: string; explanation: string };

export function workloadThresholds(env: NodeJS.ProcessEnv = process.env) {
  const bounded = (value: string | undefined, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, Number.parseInt(value || '', 10) || fallback));
  return { maxConsecutiveDays: bounded(env.WORKLOAD_MAX_CONSECUTIVE_DAYS, 6, 2, 7), minTurnaroundHours: bounded(env.WORKLOAD_MIN_TURNAROUND_HOURS, 10, 1, 24), maxDailyTasks: bounded(env.WORKLOAD_MAX_DAILY_TASKS, 8, 1, 50) };
}

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function buildWorkloadWarnings(memberIds: string[], shifts: WorkloadShift[], tasks: WorkloadTask[], date: string, thresholds = workloadThresholds()): WorkloadWarning[] {
  const warnings: WorkloadWarning[] = [];
  for (const memberId of memberIds) {
    const ownShifts = shifts.filter((shift) => shift.memberId === memberId).sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
    const days = [...new Set(ownShifts.map((shift) => shift.weekday))];
    if (days.length > thresholds.maxConsecutiveDays) warnings.push({ memberId, code: 'consecutive_days', title: 'Long run of scheduled days', explanation: `${days.length} days are scheduled in the weekly pattern; the configured warning threshold is ${thresholds.maxConsecutiveDays}.` });
    for (let day = 0; day < 6; day += 1) {
      const end = Math.max(...ownShifts.filter((shift) => shift.weekday === day).map((shift) => minutes(shift.endTime)), -1);
      const start = Math.min(...ownShifts.filter((shift) => shift.weekday === day + 1).map((shift) => minutes(shift.startTime)), 1441);
      if (end >= 0 && start <= 1440 && (1440 - end + start) < thresholds.minTurnaroundHours * 60) { warnings.push({ memberId, code: 'short_turnaround', title: 'Short turnaround between shifts', explanation: `${Math.round((1440 - end + start) / 60 * 10) / 10} hours separate two scheduled shifts; the configured minimum is ${thresholds.minTurnaroundHours}.` }); break; }
    }
    const due = tasks.filter((task) => task.assignedTo === memberId && task.dueDate === date && task.status !== 'complete').length;
    if (due > thresholds.maxDailyTasks) warnings.push({ memberId, code: 'high_task_load', title: 'High assigned task load', explanation: `${due} unfinished tasks are due today; the configured warning threshold is ${thresholds.maxDailyTasks}.` });
    const overdue = tasks.filter((task) => task.assignedTo === memberId && task.dueDate && task.dueDate < date && task.status !== 'complete').length;
    if (overdue > 0) warnings.push({ memberId, code: 'overdue_work', title: 'Overdue assigned work', explanation: `${overdue} assigned task${overdue === 1 ? ' is' : 's are'} overdue in CareBoard.` });
  }
  return warnings;
}
