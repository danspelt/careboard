import { authenticatedAccess } from '@/lib/auth-access';
import { getD1 } from '@/db';
import { toCsv } from '@/lib/operations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = await authenticatedAccess();
  if (!access || access.mustChangePassword || access.role !== 'manager') return new Response(null, { status: 403 });
  const { searchParams } = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('from') ?? '') ? searchParams.get('from')! : firstOfMonth;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('to') ?? '') ? searchParams.get('to')! : today;
  const memberId = searchParams.get('memberId') ?? '';
  const db = getD1();
  const member = await db.prepare("SELECT name, hourly_rate AS hourlyRate FROM members WHERE id=? AND role='worker'").bind(memberId).first<{ name: string; hourlyRate: number | null }>();
  if (!member) return new Response(null, { status: 404 });
  const entries = await db
    .prepare(`SELECT started_at AS startedAt, ended_at AS endedAt FROM time_entries WHERE member_id=? AND started_at >= ? AND started_at <= ? ORDER BY started_at`)
    .bind(memberId, `${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`)
    .all<{ startedAt: string; endedAt: string | null }>();
  const rows: unknown[][] = [['Date', 'Clock in (UTC)', 'Clock out (UTC)', 'Hours', 'Rate', 'Amount']];
  let totalHours = 0;
  for (const entry of entries.results) {
    const end = entry.endedAt ?? new Date().toISOString();
    const hours = Math.max(0, (new Date(end).getTime() - new Date(entry.startedAt).getTime()) / 3_600_000);
    totalHours += hours;
    rows.push([entry.startedAt.slice(0, 10), entry.startedAt, entry.endedAt ?? 'in progress', hours.toFixed(2), member.hourlyRate ?? '', member.hourlyRate ? (hours * member.hourlyRate).toFixed(2) : '']);
  }
  rows.push(['Total', '', '', totalHours.toFixed(2), '', member.hourlyRate ? (totalHours * member.hourlyRate).toFixed(2) : '']);
  return new Response(`\uFEFF${toCsv(rows)}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="timesheet-${member.name.replace(/\W+/g, '-').toLowerCase()}-${from}-to-${to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
