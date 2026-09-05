import { getHouseholdState, mutateHousehold } from '@/lib/household-data';
import { authenticatedAccess } from '@/lib/auth-access';
import { trustedMutationOrigin } from '@/lib/auth-config';

function denied(access: Awaited<ReturnType<typeof authenticatedAccess>>) {
  if (!access) return Response.json({ error: 'Sign in to access this household.' }, { status: 401 });
  if (access.mustChangePassword) return Response.json({ error: 'Change your temporary password first.' }, { status: 403 });
  return null;
}

export async function GET() {
  const access = await authenticatedAccess();
  const rejection = denied(access);
  if (rejection) return rejection;
  if (!access) return Response.json({ error: 'Sign in to access this household.' }, { status: 401 });
  try { return Response.json(await getHouseholdState(access.memberId), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { console.error(error); return Response.json({ error: 'The care team board could not be loaded.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  const access = await authenticatedAccess();
  const rejection = denied(access);
  if (rejection) return rejection;
  if (!access) return Response.json({ error: 'Sign in to access this household.' }, { status: 401 });
  if (!trustedMutationOrigin(request.headers.get('origin'))) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    return Response.json(await mutateHousehold({ ...body, actorId: access.memberId }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'That update could not be saved.';
    return Response.json({ error: message }, { status: /denied|Only|own|eligible/.test(message) ? 403 : 400 });
  }
}
