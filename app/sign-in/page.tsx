import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ClipboardCheck, HeartHandshake, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { googleSignIn, passwordSignIn } from '@/app/actions/auth';
import { authenticationConfigured, googleAuthenticationConfigured } from '@/lib/auth-config';

export const metadata: Metadata = { title: 'Sign in — CareBoard', description: 'Welcome back to your household care team.' };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const passwordEnabled = authenticationConfigured();
  const googleEnabled = googleAuthenticationConfigured();
  return (
    <main className="sign-in min-h-screen bg-[#f5f6f2] p-5 text-[#20312d] sm:p-8">
      <header className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex min-h-11 items-center gap-3 rounded-xl">
          <Image src="/favicon.svg" alt="" width={44} height={44} />
          <span className="text-xl font-bold tracking-tight">CareBoard</span>
        </Link>
      </header>
      <div className="mx-auto grid max-w-6xl items-center gap-10 py-10 sm:py-16 lg:grid-cols-2 lg:gap-20">
        <section aria-labelledby="care-heading" className="max-w-lg">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[.16em] text-[#287b6f]">A little clarity. A lot of care.</p>
          <h2 id="care-heading" className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">A calmer day starts with a shared plan.</h2>
          <p className="mt-5 text-base leading-7 text-[#52645f]">One private place for the tasks, people, and little details that make a home feel cared for.</p>
          <ul className="mt-8 hidden space-y-5 sm:block">
            {[
              { icon: ClipboardCheck, title: 'Know what comes next', text: 'Clear assignments and reminders for everyday work.' },
              { icon: HeartHandshake, title: 'Care, together', text: 'Keep your household and care team on the same page.' },
              { icon: ShieldCheck, title: 'Private by design', text: 'Manager-approved accounts and role-based access.' },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e3eee7] text-[#287b6f]"><Icon className="size-5" aria-hidden="true" /></span>
                <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm text-[#52645f]">{text}</p></div>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="sign-in-heading" className="w-full rounded-[28px] border border-[#dce5da] bg-[#fffefa] p-6 shadow-[0_20px_60px_rgba(32,49,45,.07)] sm:p-10">
          <h1 id="sign-in-heading" className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-[#52645f]">Sign in with the account your household manager approved.</p>
          {error && <p role="alert" className="mt-5 rounded-xl border border-[#edcfbd] bg-[#fcf0e9] p-4 text-sm text-[#934c37]">Sign-in could not be completed. Check your details and account status.</p>}
          {!passwordEnabled && <p className="mt-5 rounded-xl bg-[#fcf4e9] p-4 text-sm text-[#805322]">Sign-in is not configured yet. Please contact your household manager.</p>}
          <form action={passwordSignIn} className="mt-7 grid gap-5">
            <label className="grid gap-2 text-sm font-semibold" htmlFor="email">Email address
              <input id="email" className="min-h-12 w-full rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" name="email" type="email" placeholder="you@example.com" required autoComplete="email" autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="grid gap-2 text-sm font-semibold" htmlFor="password">Password
              <input id="password" className="min-h-12 w-full rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" name="password" type="password" placeholder="Enter your password" required autoComplete="current-password" />
            </label>
            <button disabled={!passwordEnabled} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#287b6f] p-3 text-sm font-semibold text-white transition hover:bg-[#216b61] disabled:cursor-not-allowed disabled:opacity-50">Sign in<ArrowRight className="size-4" aria-hidden="true" /></button>
          </form>
          {googleEnabled && <>
            <div className="my-6 flex items-center gap-3 text-xs text-[#52645f]"><span className="h-px flex-1 bg-[#dce5da]" />or continue with<span className="h-px flex-1 bg-[#dce5da]" /></div>
            <form action={googleSignIn}><button className="min-h-12 w-full rounded-xl border border-[#d7dfd7] bg-white p-3 text-sm font-semibold transition hover:bg-[#f1f5f1]">Sign in with Google</button></form>
          </>}
          <p className="mt-6 border-t border-[#dfe5dc] pt-5 text-center text-xs leading-5 text-[#52645f]">Need access or help signing in? Contact your household manager.</p>
        </section>
      </div>
    </main>
  );
}
