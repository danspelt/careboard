import { authenticatedAccess } from '@/lib/auth-access';
import { csilReportCsvFor } from '@/lib/household-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = await authenticatedAccess();
  if (!access || access.mustChangePassword || access.role !== 'manager') return new Response(null, { status: 403 });
  const monthParam = new URL(request.url).searchParams.get('month') ?? '';
  const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : new Date().toISOString().slice(0, 7);
  const csv = await csilReportCsvFor(month);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="csil-accountability-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
