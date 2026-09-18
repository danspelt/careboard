import Link from 'next/link';
import { ArrowRight, Bell, ClipboardCheck, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { googleSignIn, passwordSignIn } from '@/app/actions/auth';
import { PasswordField, SubmitButton } from '@/app/auth-ui';
import { BrandIcon } from '@/components/brand-icon';
import { authenticationConfigured, googleAuthenticationConfigured, localDevMode } from '@/lib/auth-config';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Sign in — CareBoard', description: 'Welcome back to your household care team.' };

function CareIllustration() {
  return (
    <svg viewBox="0 0 480 174" width="480" height="174" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" className="mx-auto h-auto w-full max-w-sm">
      <ellipse cx="240" cy="161" rx="201" ry="10" fill="#d5e3d5" />
      <circle cx="354" cy="43" r="23" fill="#f4d88a" />
      <path d="M191 87 264 28l73 59" stroke="#246f63" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M203 80v77h122V80l-61-49-61 49Z" fill="#fffefa" stroke="#246f63" strokeWidth="3" strokeLinejoin="round" />
      <path d="M251 157v-41a15 15 0 0 1 30 0v41" fill="#dbe8de" stroke="#246f63" strokeWidth="3" />
      <rect x="218" y="85" width="21" height="23" rx="5" fill="#f4d88a" stroke="#246f63" strokeWidth="2" />
      <path d="M228.5 85v23M218 96.5h21" stroke="#246f63" strokeWidth="2" />
      <path d="M292 59V37h17v37" fill="#246f63" />
      <path d="M68 156c0-30 15-46 38-46s38 16 38 46" fill="#e9b966" stroke="#735638" strokeWidth="2.5" />
      <path d="M91 109v13c8 10 22 10 30 0v-15" fill="#e5ad88" stroke="#735638" strokeWidth="2.5" />
      <ellipse cx="106" cy="79" rx="30" ry="35" fill="#edbd9c" stroke="#735638" strokeWidth="2.5" />
      <path d="M76 80c-8-23 5-43 28-43 25 0 40 18 33 44-14-5-20-17-22-23-9 13-25 16-39 16Z" fill="#394b42" />
      <path d="M92 84h1m25 0h1m-19 15c4 4 10 4 14 0" stroke="#584432" strokeWidth="3" strokeLinecap="round" />
      <path d="m80 136 8 20m43-20-8 20" stroke="#735638" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M138 157c0-25 14-43 36-43s36 18 36 43" fill="#76a898" stroke="#285f52" strokeWidth="2.5" />
      <path d="M162 108v12c7 8 17 8 24 0v-14" fill="#a96e4c" stroke="#624333" strokeWidth="2.5" />
      <ellipse cx="174" cy="83" rx="27" ry="33" fill="#bf8966" stroke="#624333" strokeWidth="2.5" />
      <path d="M148 82c-9-8-10-28 2-31-1-12 12-20 22-12 10-9 23-1 23 8 16-1 21 20 7 34l-8-22c-12 10-24 8-33 1l-13 22Z" fill="#433b39" />
      <path d="M163 86h1m19 0h1m-15 14c3 3 8 3 11 0" stroke="#43352e" strokeWidth="3" strokeLinecap="round" />
      <path d="m151 138 7 19m39-19-7 19" stroke="#285f52" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M383 144v-39m0 26c-22 0-32-18-30-32 22 0 33 17 30 32Zm0-14c0-23 15-38 31-38 2 24-13 38-31 38Z" fill="#78a68b" stroke="#38705a" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="m364 139 6 22h26l6-22Z" fill="#dcae82" stroke="#805c41" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M54 69v12m-6-6h12M411 51v10m-5-5h10" stroke="#90b09c" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string; joined?: string }> }) {
  if (localDevMode()) redirect('/dashboard');
  const { error, joined } = await searchParams;
  const passwordEnabled = authenticationConfigured();
  const googleEnabled = googleAuthenticationConfigured();
  return (
    <main className="sign-in auth-shell min-h-screen p-5 text-[#20312d] sm:p-8">
      <header className="auth-enter mx-auto max-w-6xl">
        <Link href="/" className="auth-brand inline-flex min-h-11 items-center gap-2 rounded-xl sm:gap-3">
          <span className="rounded-2xl bg-[#edf3e9] p-1 shadow-[0_1px_0_rgb(255_255_255_/_80%)_inset,0_6px_16px_rgb(18_61_49_/_8%)]"><BrandIcon size={48} /></span>
          <span>
            <span className="block text-lg font-bold tracking-tight sm:text-xl">CareBoard</span>
            <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[.12em] text-[#53685f]">Household care</span>
          </span>
        </Link>
      </header>
      <div className="mx-auto grid max-w-6xl items-center gap-8 py-8 sm:gap-10 sm:py-14 lg:grid-cols-2 lg:gap-16 lg:py-16">
        <section aria-labelledby="care-heading" className="auth-enter order-2 hidden max-w-lg lg:order-1 lg:block">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e4d3] bg-[#eef4e9] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[#3e6551]">
            <span className="size-1.5 rounded-full bg-[#398264]" />Made for families & care teams
          </p>
          <h2 id="care-heading" className="text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
            A little less juggling.<br /><span className="text-[#287b6f]">A lot more care.</span>
          </h2>
          <p className="mt-5 text-base leading-7 text-[#53685f]">Your private household care board. Organize tasks, coordinate trusted care workers, and see what’s done—all in one calm, shared space.</p>
          <ul className="mt-8 space-y-5">
            {[
              { icon: ClipboardCheck, title: 'Clear assignments', text: 'Household tasks, schedules, and who’s responsible—in one place.' },
              { icon: Bell, title: 'Timely reminders', text: 'Due dates and nudges so the next chore doesn’t get lost.' },
              { icon: ShieldCheck, title: 'Private, approved access', text: 'Managers coordinate the household; workers and viewers see only what they need.' },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf3e9] text-[#287b6f]"><Icon className="size-5" aria-hidden="true" /></span>
                <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm text-[#53685f]">{text}</p></div>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <CareIllustration />
            <p className="mt-2 text-center text-[10px] text-[#53685f]">Example board · Not live household data.</p>
          </div>
        </section>

        <section aria-labelledby="sign-in-heading" className="auth-enter auth-enter-delay auth-panel order-1 w-full rounded-[28px] border border-[#dce5da] bg-[#fffefa] p-6 sm:p-10 lg:order-2">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e4d3] bg-[#eef4e9] px-3 py-1 text-[10px] font-semibold tracking-wide text-[#3e6551] lg:hidden">
            <span className="size-1.5 rounded-full bg-[#398264]" />Made for families & care teams
          </p>
          <h1 id="sign-in-heading" className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-[#53685f]">Sign in with your care team account — the one your household manager approved.</p>
          {joined && <output className="mt-5 block rounded-xl border border-[#bcd4c9] bg-[#eef4ef] p-4 text-sm text-[#216b61]">Your account is active — sign in with your new password.</output>}
          {error && <p role="alert" className="mt-5 rounded-xl border border-[#edcfbd] bg-[#fcf0e9] p-4 text-sm text-[#934c37]">{error === 'CredentialsSignin' ? 'That email or password didn’t match an approved account. Check both and try again.' : error === 'Configuration' ? 'Sign-in isn’t configured yet. Please contact your household manager.' : 'Sign-in could not be completed. Please try again or contact your household manager.'}</p>}
          {!passwordEnabled && <p className="mt-5 rounded-xl bg-[#fcf4e9] p-4 text-sm text-[#805322]">Sign-in is not configured yet. Please contact your household manager.</p>}
          <form action={passwordSignIn} className="mt-7 grid gap-5">
            <label className="grid gap-2 text-sm font-semibold" htmlFor="email">Email address
              <input id="email" className="auth-control font-normal" name="email" type="email" inputMode="email" placeholder="you@example.com" required autoComplete="email" autoCapitalize="none" spellCheck={false} />
            </label>
            <PasswordField id="password" name="password" label="Password" autoComplete="current-password" placeholder="Enter your password" />
            <SubmitButton pendingLabel="Signing in…" disabled={!passwordEnabled}>Sign in to your care team<ArrowRight className="size-4" aria-hidden="true" /></SubmitButton>
          </form>
          <div className="my-6 flex items-center gap-3 text-xs text-[#52645f]"><span className="h-px flex-1 bg-[#dce5da]" />or continue with<span className="h-px flex-1 bg-[#dce5da]" /></div>
          <form action={googleSignIn}>
            <button
              type="submit"
              disabled={!googleEnabled}
              className="auth-google flex w-full items-center justify-center gap-3 p-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <GoogleMark />
              Continue with Google
            </button>
          </form>
          <div className="mt-7 border-t border-[#dfe5dc] pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-[.14em] text-[#52645f]">Who signs in here?</h2>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-[#52645f]">
              <li><span className="font-semibold text-[#20312d]">Household manager</span> — coordinates the household and approves who joins.</li>
              <li><span className="font-semibold text-[#20312d]">Care worker</span> — sees assigned tasks and available work.</li>
              <li><span className="font-semibold text-[#20312d]">Family viewer</span> — read-only access shared by the manager.</li>
            </ul>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs leading-5 text-[#52645f]">
              <LockKeyhole className="size-3.5" aria-hidden="true" />
              Need access? Ask your household manager.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
