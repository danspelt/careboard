import { getD1 } from '@/db';

export async function GET() {
  try {
    await getD1().prepare('SELECT 1 AS healthy').first();
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'error' }, { status: 503 });
  }
}
