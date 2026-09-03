import { HouseholdApp } from '@/app/household-app';
import { getHouseholdState } from '@/lib/household-data';

export default async function Home() {
  const initialState = await getHouseholdState();
  return <HouseholdApp initialState={initialState} />;
}
