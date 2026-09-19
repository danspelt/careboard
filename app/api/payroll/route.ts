import { authenticatedAccess } from '@/lib/auth-access';
import { payrollCsvFor } from '@/lib/household-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = await authenticatedAccess();
  if (!access || access.mustChangePassword || access.role !== 'manager') return new Response(null, { status: 403 });
  const { searchParams } = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('from') ?? '') ? searchParams.get('from')! : defaultFrom;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('to') ?? '') ? searchParams.get('to')! : today;
  const csv = await payrollCsvFor(from, to);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payroll-${from}-to-${to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
