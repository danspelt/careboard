import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { changePassword, logOut } from '@/app/actions/auth';
import { authenticatedAccess } from '@/lib/auth-access';

export const dynamic = 'force-dynamic';

export default async function ChangePassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const access = await authenticatedAccess();
  if (!access) redirect('/sign-in');
  if (!access.mustChangePassword) redirect('/dashboard');
  const { error } = await searchParams;
  return <main className="sign-in auth-shell grid min-h-screen place-items-center bg-[#f5f6f2] p-5 text-[#20312d]"><section className="auth-panel w-full max-w-md rounded-[28px] border border-[#dce5da] bg-[#fffefa] p-7 shadow-sm sm:p-9">
    <Link href="/" className="auth-brand mb-8 inline-flex min-h-11 items-center gap-3 rounded-xl"><Image src="/favicon.svg" alt="" width={44} height={44} /><span className="text-xl font-bold tracking-tight">CareBoard</span></Link>
    <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[#e7f0ec] text-[#287b6f]"><KeyRound className="size-5" aria-hidden="true" /></span>
    <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
    <p className="mt-3 text-sm text-[#64746f]">Replace the temporary password before using CareBoard.</p>
    <form action={changePassword} className="mt-6 grid gap-4">
      <label className="grid gap-2 text-sm font-semibold">New password<input className="auth-control font-normal" name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
      <label className="grid gap-2 text-sm font-semibold">Confirm password<input className="auth-control font-normal" name="confirmation" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
      <p className="text-xs leading-5 text-[#64746f]">Use 12–128 characters with uppercase, lowercase, a number, and a symbol.</p>
      {error && <p role="alert" className="text-sm text-[#934c37]">Passwords must match and meet the requirements.</p>}
      <button className="auth-submit p-3" type="submit">Save password</button>
    </form>
    <form action={logOut} className="mt-4"><button className="text-sm font-semibold text-[#287b6f]">Sign out</button></form>
  </section></main>;
}
