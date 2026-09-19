import { authenticatedAccess } from '@/lib/auth-access';
import { getD1 } from '@/db';
import { toCsv } from '@/lib/operations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = await authenticatedAccess();
  if (!access || access.mustChangePassword || access.role !== 'manager') return new Response(null, { status: 403 });
  const { searchParams } = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('from') ?? '') ? searchParams.get('from')! : defaultFrom;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('to') ?? '') ? searchParams.get('to')! : today;
  const db = getD1();
  const workers = await db
    .prepare("SELECT id, name, hourly_rate AS hourlyRate FROM members WHERE role='worker' ORDER BY name")
    .all<{ id: string; name: string; hourlyRate: number | null }>();
  const rows: unknown[][] = [
    ['Pay period', `${from} to ${to}`],
    [],
    ['Worker', 'Date', 'Day', 'Clock in (UTC)', 'Clock out (UTC)', 'Hours', 'Rate', 'Gross pay'],
  ];
  let grandHours = 0;
  let grandGross = 0;
  for (const worker of workers.results) {
    const entries = await db
      .prepare(`SELECT started_at AS startedAt, ended_at AS endedAt FROM time_entries WHERE member_id=? AND started_at >= ? AND started_at <= ? ORDER BY started_at`)
      .bind(worker.id, `${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`)
      .all<{ startedAt: string; endedAt: string | null }>();
    let workerHours = 0;
    let workerGross = 0;
    for (const entry of entries.results) {
      const end = entry.endedAt ?? new Date().toISOString();
      const hours = Math.max(0, (new Date(end).getTime() - new Date(entry.startedAt).getTime()) / 3_600_000);
      const gross = worker.hourlyRate ? hours * worker.hourlyRate : 0;
      workerHours += hours;
      workerGross += gross;
      const day = new Date(`${entry.startedAt.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      rows.push([worker.name, entry.startedAt.slice(0, 10), day, entry.startedAt, entry.endedAt ?? 'in progress', hours.toFixed(2), worker.hourlyRate ?? '', worker.hourlyRate ? gross.toFixed(2) : '']);
    }
    grandHours += workerHours;
    grandGross += workerGross;
    rows.push([`${worker.name} — total`, '', '', '', '', workerHours.toFixed(2), '', worker.hourlyRate ? workerGross.toFixed(2) : '']);
    rows.push([]);
  }
  rows.push(['Grand total', '', '', '', '', grandHours.toFixed(2), '', grandGross.toFixed(2)]);
  return new Response(`\uFEFF${toCsv(rows)}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payroll-${from}-to-${to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
