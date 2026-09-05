import Link from 'next/link';
import { Home } from 'lucide-react';
import type { Metadata } from 'next';
import { googleSignIn, passwordSignIn } from '@/app/actions/auth';
import { authenticationConfigured, googleAuthenticationConfigured } from '@/lib/auth-config';

export const metadata: Metadata = { title: 'Sign in — CareBoard', description: 'Welcome back to your household care team.' };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="min-h-screen bg-[#f5f6f2] p-5 text-[#20312d] sm:p-8">
    <Link href="/" className="inline-flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-[#287b6f] text-white"><Home className="size-5" /></span><span className="text-xl font-bold">CareBoard</span></Link>
    <section className="mx-auto mt-10 w-full max-w-lg rounded-[28px] border border-[#dce5da] bg-[#fffefa] p-7 shadow-sm sm:p-10">
      <h1 className="text-3xl font-semibold">Welcome back</h1><p className="mt-2 text-sm text-[#64746f]">Use an account approved by your household manager.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-[#fcf0e9] p-4 text-sm text-[#934c37]">Sign-in could not be completed. Check your details and account status.</p>}
      <form action={passwordSignIn} className="mt-7 grid gap-3"><input className="rounded-xl border p-3" name="email" type="email" placeholder="Email" required autoComplete="email" /><input className="rounded-xl border p-3" name="password" type="password" placeholder="Password" required autoComplete="current-password" /><button disabled={!authenticationConfigured()} className="rounded-xl bg-[#287b6f] p-3 font-semibold text-white disabled:opacity-50">Sign in</button></form>
      <div className="my-6 flex items-center gap-3 text-xs text-[#64746f]"><span className="h-px flex-1 bg-[#dce5da]" />OR<span className="h-px flex-1 bg-[#dce5da]" /></div>
      <form action={googleSignIn}><button disabled={!googleAuthenticationConfigured()} className="w-full rounded-xl border p-3 font-semibold disabled:opacity-50">Sign in with Google</button></form>
    </section>
  </main>;
}
