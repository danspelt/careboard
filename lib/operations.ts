export type Recurrence = 'daily' | 'weekly' | 'monthly';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export function nextRecurrenceDate(date: string, recurrence: Recurrence): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (recurrence === 'daily') value.setUTCDate(value.getUTCDate() + 1);
  if (recurrence === 'weekly') value.setUTCDate(value.getUTCDate() + 7);
  if (recurrence === 'monthly') {
    const targetMonth = value.getUTCMonth() + 1;
    const targetYear = value.getUTCFullYear();
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    value.setUTCFullYear(targetYear, targetMonth, Math.min(day, lastDay));
  }
  return value.toISOString().slice(0, 10);
}

export function addDaysISO(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

export function csvCell(value: unknown): string {
  let text = value == null ? '' : typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? `${value}` : JSON.stringify(value);
  text = text.replaceAll('\r', '').replaceAll('\n', ' ').replaceAll('\t', ' ');
  if (/^[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export const uploadMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const maxUploadBytes = 10 * 1024 * 1024;

const signatures: Record<string, { offset?: number; bytes: number[] }> = {
  'image/jpeg': { bytes: [0xff, 0xd8, 0xff] },
  'image/png': { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'image/webp': { bytes: [0x52, 0x49, 0x46, 0x46] },
};

export function validateUploadSignature(buffer: Uint8Array, mime: string): boolean {
  const rule = signatures[mime];
  if (!rule) return false;
  const offset = rule.offset ?? 0;
  if (buffer.length < offset + rule.bytes.length) return false;
  for (let i = 0; i < rule.bytes.length; i += 1) {
    if (buffer[offset + i] !== rule.bytes[i]) return false;
  }
  if (mime === 'image/webp') {
    if (buffer.length < 12) return false;
    const fourcc = String.fromCharCode(...buffer.slice(8, 12));
    if (fourcc !== 'WEBP') return false;
  }
  return true;
}

export function validateUpload(type: string, size: number, buffer?: Uint8Array): string | null {
  if (!uploadMimes.has(type)) return 'Only JPEG, PNG, and WebP photos are accepted.';
  if (!Number.isSafeInteger(size) || size < 1 || size > maxUploadBytes) return 'Photos must be between 1 byte and 10 MB.';
  if (buffer && !validateUploadSignature(buffer, type)) return 'File signature does not match the claimed photo type.';
  return null;
}

export function safeStoredName(id: string, mime: string): string {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Invalid upload identifier.');
  const extension = mime === 'image/jpeg' ? '.jpg' : mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '';
  if (!extension) throw new Error('Invalid upload type.');
  return `${id}${extension}`;
}

export function metrics<T extends { status: string; dueDate: string | null; completedAt?: string | null }>(tasks: T[], today: string) {
  return {
    open: tasks.filter((task) => task.status !== 'complete').length,
    overdue: tasks.filter((task) => task.status !== 'complete' && task.dueDate && task.dueDate < today).length,
    dueToday: tasks.filter((task) => task.status !== 'complete' && task.dueDate === today).length,
    completed: tasks.filter((task) => task.status === 'complete').length,
    completedOnTime: tasks.filter((task) => task.status === 'complete' && task.dueDate && task.completedAt && task.completedAt.slice(0, 10) <= task.dueDate).length,
  };
}
