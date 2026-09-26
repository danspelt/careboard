import { authenticatedAccess } from '@/lib/auth-access';
import { getHouseholdState } from '@/lib/household-data';
import { wageStatementRows } from '@/lib/hr-payroll';
import { toCsv } from '@/lib/operations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = await authenticatedAccess();
  if (!access || access.mustChangePassword) return new Response(null, { status: 403 });
  if (access.role === 'viewer') return new Response(null, { status: 403 });

  const url = new URL(request.url);
  const runId = url.searchParams.get('runId') ?? '';
  const memberId = url.searchParams.get('memberId') ?? '';
  if (!runId || !memberId) return new Response('runId and memberId are required.', { status: 400 });
  if (access.role === 'worker' && access.memberId !== memberId) return new Response(null, { status: 403 });

  const state = await getHouseholdState(access.memberId);
  const run = (state.payRuns ?? []).find((item) => item.id === runId);
  const line = (state.payRunLines ?? []).find((item) => item.runId === runId && item.memberId === memberId);
  const period = (state.payPeriods ?? []).find((item) => item.id === run?.periodId);
  const worker = state.members.find((item) => item.id === memberId);
  if (!run || !line || !period || !worker) return new Response('Wage statement not found.', { status: 404 });

  const csv = `\uFEFF${toCsv(wageStatementRows(worker.name, { startOn: period.startOn, endOn: period.endOn }, line))}\r\n`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="wage-statement-${worker.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${period.startOn}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
