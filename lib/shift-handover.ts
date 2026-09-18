export type ShiftHandover = {
  id: string;
  memberId: string;
  shiftDate: string;
  completedSummary: string;
  pendingSummary: string;
  notes: string;
  createdAt: string;
};

export const handoverFieldLimit = 2000;

/** A handover needs at least one section filled in — a blank note helps nobody. */
export function handoverHasContent(handover: Pick<ShiftHandover, 'completedSummary' | 'pendingSummary' | 'notes'>) {
  return Boolean(handover.completedSummary.trim() || handover.pendingSummary.trim() || handover.notes.trim());
}

/** The newest handover left by someone else, so the worker coming on shift sees what happened before them. */
export function incomingHandover<T extends ShiftHandover>(handovers: T[], workerId: string): T | null {
  return handovers
    .filter((handover) => handover.memberId !== workerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/** The handover this worker already filed for the given day, if any, so the form can edit instead of duplicate. */
export function myHandoverFor<T extends ShiftHandover>(handovers: T[], workerId: string, date: string): T | null {
  return handovers
    .filter((handover) => handover.memberId === workerId && handover.shiftDate === date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/** Newest first, so managers read the most recent shift at the top. */
export function sortHandovers<T extends ShiftHandover>(handovers: T[]): T[] {
  return [...handovers].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.shiftDate.localeCompare(a.shiftDate));
}

/** Suggested "what got done" text built from tasks the worker completed, so the form starts filled in. */
export function suggestedCompletedSummary(completed: Array<{ title: string }>) {
  return completed.map((task) => task.title).join('\n');
}

/** Suggested "still pending" text from the work left open at the end of the shift. */
export function suggestedPendingSummary(outstanding: Array<{ title: string }>) {
  return outstanding.map((task) => task.title).join('\n');
}
