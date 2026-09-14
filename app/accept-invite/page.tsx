import Image from 'next/image';
import Link from 'next/link';
import { KeyRound, TriangleAlert } from 'lucide-react';
import { acceptInviteAction } from '@/app/actions/invite';
import { inviteForToken } from '@/lib/household-data';

export const dynamic = 'force-dynamic';

export default async function AcceptInvite({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const invite = token ? await inviteForToken(token) : null;
  return (
    <main className="sign-in auth-shell grid min-h-screen place-items-center bg-[#f5f6f2] p-5 text-[#20312d]">
      <section className="auth-panel w-full max-w-md rounded-[28px] border border-[#dce5da] bg-[#fffefa] p-7 shadow-sm sm:p-9">
        <Link href="/" className="auth-brand mb-8 inline-flex min-h-11 items-center gap-3 rounded-xl"><Image src="/favicon.svg" alt="" width={44} height={44} /><span className="text-xl font-bold tracking-tight">CareBoard</span></Link>
        {invite ? (
          <>
            <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[#e7f0ec] text-[#287b6f]"><KeyRound className="size-5" aria-hidden="true" /></span>
            <h1 className="text-3xl font-semibold tracking-tight">Welcome, {invite.name}</h1>
            <p className="mt-3 text-sm text-[#64746f]">You’ve been invited to join the household care team. Choose a password to activate your account.</p>
            <form action={acceptInviteAction} className="mt-6 grid gap-4">
              <input type="hidden" name="token" value={token} />
              <label className="grid gap-2 text-sm font-semibold">Choose a password<input className="auth-control font-normal" name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
              <label className="grid gap-2 text-sm font-semibold">Confirm password<input className="auth-control font-normal" name="confirmation" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
              <p className="text-xs leading-5 text-[#64746f]">Use 12–128 characters with uppercase, lowercase, a number, and a symbol.</p>
              {error && <p role="alert" className="text-sm text-[#934c37]">Passwords must match and meet the requirements.</p>}
              <button className="auth-submit p-3" type="submit">Activate account</button>
            </form>
          </>
        ) : (
          <>
            <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[#f8e9dc] text-[#8b4e2c]"><TriangleAlert className="size-5" aria-hidden="true" /></span>
            <h1 className="text-3xl font-semibold tracking-tight">Invite link not valid</h1>
            <p className="mt-3 text-sm leading-6 text-[#64746f]">This invite link is invalid, already used, or expired. Ask the household manager to send you a new one.</p>
            <Link href="/sign-in" className="auth-submit mt-6 block p-3 text-center">Go to sign in</Link>
          </>
        )}
      </section>
    </main>
  );
}
