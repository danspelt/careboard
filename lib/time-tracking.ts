export type TimeEntry = { id: string; memberId: string; startedAt: string; endedAt: string | null };

export function openEntryFor<T extends TimeEntry>(entries: T[], memberId: string) {
  return entries.find((entry) => entry.memberId === memberId && entry.endedAt === null) ?? null;
}

function entryMinutes(entry: TimeEntry, now: string) {
  const end = entry.endedAt ?? now;
  return Math.max(0, (new Date(end).getTime() - new Date(entry.startedAt).getTime()) / 60000);
}

export function minutesInRange<T extends TimeEntry>(entries: T[], memberId: string, from: string, to: string, now: string) {
  return Math.round(
    entries
      .filter((entry) => entry.memberId === memberId && entry.startedAt.slice(0, 10) >= from && entry.startedAt.slice(0, 10) <= to)
      .reduce((total, entry) => total + entryMinutes(entry, now), 0),
  );
}

export function weekSummary<T extends TimeEntry>(entries: T[], workerIds: string[], startDate: string, days = 7, now?: string) {
  const end = new Date(`${startDate}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days - 1);
  const endDate = end.toISOString().slice(0, 10);
  const stamp = now ?? new Date().toISOString();
  return workerIds.map((workerId) => ({
    workerId,
    minutes: minutesInRange(entries, workerId, startDate, endDate, stamp),
    clockedIn: Boolean(openEntryFor(entries, workerId)),
  }));
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
