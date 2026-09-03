import { getHouseholdState } from '@/lib/household-data';

export async function GET() {
  try {
    const state = await getHouseholdState();
    return Response.json({ status: 'ok', members: state.members.length });
  } catch (error) {
    console.error(error);
    return Response.json({ status: 'error' }, { status: 503 });
  }
}
