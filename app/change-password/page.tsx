import { redirect } from 'next/navigation';
import { changePassword, logOut } from '@/app/actions/auth';
import { authenticatedAccess } from '@/lib/auth-access';

export const dynamic = 'force-dynamic';

export default async function ChangePassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const access = await authenticatedAccess();
  if (!access) redirect('/sign-in');
  if (!access.mustChangePassword) redirect('/dashboard');
  const { error } = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[#f5f6f2] p-5 text-[#20312d]"><section className="w-full max-w-md rounded-[28px] border border-[#dce5da] bg-[#fffefa] p-8 shadow-sm">
    <h1 className="text-3xl font-semibold">Choose a new password</h1>
    <p className="mt-3 text-sm text-[#64746f]">Replace the temporary password before using CareBoard.</p>
    <form action={changePassword} className="mt-6 grid gap-4">
      <label className="grid gap-1 text-sm font-medium">New password<input className="rounded-xl border p-3" name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
      <label className="grid gap-1 text-sm font-medium">Confirm password<input className="rounded-xl border p-3" name="confirmation" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
      <p className="text-xs leading-5 text-[#64746f]">Use 12–128 characters with uppercase, lowercase, a number, and a symbol.</p>
      {error && <p role="alert" className="text-sm text-[#934c37]">Passwords must match and meet the requirements.</p>}
      <button className="rounded-xl bg-[#287b6f] p-3 font-semibold text-white" type="submit">Save password</button>
    </form>
    <form action={logOut} className="mt-4"><button className="text-sm font-semibold text-[#287b6f]">Sign out</button></form>
  </section></main>;
}
