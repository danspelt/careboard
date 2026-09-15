import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { changePassword, logOut } from '@/app/actions/auth';
import { PasswordField, SubmitButton } from '@/app/auth-ui';
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
      <PasswordField name="password" label="New password" minLength={12} maxLength={128} autoComplete="new-password" showRules />
      <PasswordField name="confirmation" label="Confirm password" minLength={12} maxLength={128} autoComplete="new-password" />
      {error && <p role="alert" className="text-sm text-[#934c37]">Passwords must match and meet the requirements.</p>}
      <SubmitButton pendingLabel="Saving…">Save password</SubmitButton>
    </form>
    <form action={logOut} className="mt-4"><button className="text-sm font-semibold text-[#287b6f]">Sign out</button></form>
  </section></main>;
}
