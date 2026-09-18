import Link from 'next/link';
import { KeyRound, TriangleAlert } from 'lucide-react';
import { acceptInviteAction } from '@/app/actions/invite';
import { PasswordField, SubmitButton } from '@/app/auth-ui';
import { BrandIcon } from '@/components/brand-icon';
import { inviteForToken } from '@/lib/household-data';

export const dynamic = 'force-dynamic';

export default async function AcceptInvite({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const invite = token ? await inviteForToken(token) : null;
  return (
    <main className="sign-in auth-shell grid min-h-screen place-items-center p-5 text-[#20312d]">
      <section className="auth-panel w-full max-w-md rounded-[28px] border border-[#dce5da] bg-[#fffefa] p-7 shadow-sm sm:p-9">
        <Link href="/" className="auth-brand mb-8 inline-flex min-h-11 items-center gap-2 rounded-xl sm:gap-3">
          <span className="rounded-2xl bg-[#edf3e9] p-1"><BrandIcon size={44} /></span>
          <span>
            <span className="block text-xl font-bold tracking-tight">CareBoard</span>
            <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[.12em] text-[#53685f]">Household care</span>
          </span>
        </Link>
        {invite ? (
          <>
            <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[#e7f0ec] text-[#287b6f]"><KeyRound className="size-5" aria-hidden="true" /></span>
            <h1 className="text-3xl font-semibold tracking-tight">Welcome, {invite.name}</h1>
            <p className="mt-1 text-sm text-[#64746f]">Activating the account for {invite.email}</p>
            <p className="mt-3 text-sm text-[#64746f]">You’ve been invited to join the household care team. Choose a password to activate your account.</p>
            <form action={acceptInviteAction} className="mt-6 grid gap-4">
              <input type="hidden" name="token" value={token} />
              <PasswordField name="password" label="Choose a password" minLength={12} maxLength={128} autoComplete="new-password" showRules />
              <PasswordField name="confirmation" label="Confirm password" minLength={12} maxLength={128} autoComplete="new-password" />
              {error && <p role="alert" className="text-sm text-[#934c37]">Passwords must match and meet the requirements.</p>}
              <SubmitButton pendingLabel="Activating…">Activate account</SubmitButton>
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
