import { getHouseholdState, mutateHousehold } from '@/lib/household-data';

export async function GET() {
  try {
    return Response.json(await getHouseholdState());
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'The care team board could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    return Response.json(await mutateHousehold(body));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'That update could not be saved.';
    return Response.json({ error: message }, { status: 400 });
  }
}
