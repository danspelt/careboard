import { redirect } from 'next/navigation';
import { HouseholdApp } from '@/app/household-app';
import { getHouseholdState } from '@/lib/household-data';
import { authenticatedAccess } from '@/lib/auth-access';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const access = await authenticatedAccess();
  if (!access) redirect('/sign-in');
  if (access.mustChangePassword) redirect('/change-password');
  const initialState = await getHouseholdState(access.memberId);
  return <HouseholdApp initialState={initialState} authenticatedId={access.memberId} />;
}
