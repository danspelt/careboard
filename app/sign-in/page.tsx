import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Clock, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { googleSignIn, passwordSignIn } from '@/app/actions/auth';
import { PasswordField, SubmitButton } from '@/app/auth-ui';
import { authenticationConfigured, googleAuthenticationConfigured } from '@/lib/auth-config';

export const metadata: Metadata = { title: 'Sign in — CareBoard', description: 'Welcome back to your household care team.' };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string; joined?: string }> }) {
  const { error, joined } = await searchParams;
  const passwordEnabled = authenticationConfigured();
  const googleEnabled = googleAuthenticationConfigured();
  return (
    <main className="sign-in auth-shell min-h-screen bg-[#f5f6f2] p-5 text-[#20312d] sm:p-8">
      <header className="mx-auto max-w-6xl">
        <Link href="/" className="auth-brand inline-flex min-h-11 items-center gap-3 rounded-xl">
          <Image src="/favicon.svg" alt="" width={44} height={44} />
          <span className="text-xl font-bold tracking-tight">CareBoard</span>
        </Link>
      </header>
      <div className="mx-auto grid max-w-6xl items-center gap-10 py-10 sm:py-16 lg:grid-cols-2 lg:gap-20">
        <section aria-labelledby="care-heading" className="max-w-lg">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[.16em] text-[#287b6f]">Built for CSIL employers</p>
          <h2 id="care-heading" className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Run your care team with confidence.</h2>
          <p className="mt-5 text-base leading-7 text-[#52645f]">One private place to schedule care workers, track their hours, and keep your funding on track.</p>
          <ul className="mt-8 hidden space-y-5 sm:block">
            {[
              { icon: CalendarDays, title: 'Shifts and schedules', text: 'Weekly shifts, availability, and who’s on today.' },
              { icon: Clock, title: 'Hours and timesheets', text: 'Clock in/out, funded-hour tracking, and pay-period exports.' },
              { icon: ShieldCheck, title: 'Private, role-based access', text: 'Managers see everything; care workers and family viewers see only what they need.' },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e3eee7] text-[#287b6f]"><Icon className="size-5" aria-hidden="true" /></span>
                <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm text-[#52645f]">{text}</p></div>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="sign-in-heading" className="auth-panel w-full rounded-[28px] border border-[#dce5da] bg-[#fffefa] p-6 shadow-[0_20px_60px_rgba(32,49,45,.07)] sm:p-10">
          <h1 id="sign-in-heading" className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-[#52645f]">Sign in with the account your household manager approved.</p>
          {joined && <output className="mt-5 block rounded-xl border border-[#bcd4c9] bg-[#eef4ef] p-4 text-sm text-[#216b61]">Your account is active — sign in with your new password.</output>}
          {error && <p role="alert" className="mt-5 rounded-xl border border-[#edcfbd] bg-[#fcf0e9] p-4 text-sm text-[#934c37]">{error === 'CredentialsSignin' ? 'That email or password didn’t match an approved account. Check both and try again.' : error === 'Configuration' ? 'Sign-in isn’t configured yet. Please contact your household manager.' : 'Sign-in could not be completed. Please try again or contact your household manager.'}</p>}
          {!passwordEnabled && <p className="mt-5 rounded-xl bg-[#fcf4e9] p-4 text-sm text-[#805322]">Sign-in is not configured yet. Please contact your household manager.</p>}
          <form action={passwordSignIn} className="mt-7 grid gap-5">
            <label className="grid gap-2 text-sm font-semibold" htmlFor="email">Email address
              <input id="email" className="auth-control font-normal" name="email" type="email" inputMode="email" placeholder="you@example.com" required autoComplete="email" autoCapitalize="none" spellCheck={false} />
            </label>
            <PasswordField id="password" name="password" label="Password" autoComplete="current-password" placeholder="Enter your password" />
            <SubmitButton pendingLabel="Signing in…" disabled={!passwordEnabled}>Sign in<ArrowRight className="size-4" aria-hidden="true" /></SubmitButton>
          </form>
          {googleEnabled && <>
            <div className="my-6 flex items-center gap-3 text-xs text-[#52645f]"><span className="h-px flex-1 bg-[#dce5da]" />or continue with<span className="h-px flex-1 bg-[#dce5da]" /></div>
            <form action={googleSignIn}><button className="min-h-12 w-full rounded-xl border border-[#d7dfd7] bg-white p-3 text-sm font-semibold transition hover:bg-[#f1f5f1]">Sign in with Google</button></form>
          </>}
          <div className="mt-6 border-t border-[#dfe5dc] pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-[.14em] text-[#52645f]">Who signs in here?</h2>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-[#52645f]">
              <li><span className="font-semibold text-[#20312d]">Household manager</span> — the CSIL employer who runs the account.</li>
              <li><span className="font-semibold text-[#20312d]">Care worker</span> — use the invite link or temporary password your manager gave you.</li>
              <li><span className="font-semibold text-[#20312d]">Family viewer</span> — read-only access shared by the manager.</li>
            </ul>
            <p className="mt-3 text-center text-xs leading-5 text-[#52645f]">Need access? Contact your household manager.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
