import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardCheck, HeartHandshake, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { auth } from '@/auth';

const benefits = [
  {
    icon: ClipboardCheck,
    title: 'Every task has an owner',
    description: 'Create, assign, and claim household tasks without crossed wires or duplicate work.',
  },
  {
    icon: Users,
    title: 'Your care team, connected',
    description: 'Give each approved caregiver a clear view of what needs attention and what is complete.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by design',
    description: 'Only Google accounts approved by your household manager can see or update the care board.',
  },
];

export default async function Home() {
  const session = await auth();

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f4ed] text-[#20312d]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link href="/" className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#287b6f]">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#287b6f] text-white"><HeartHandshake className="size-5" aria-hidden="true" /></span>
          <span className="text-xl font-bold tracking-tight">CareBoard</span>
        </Link>
        <Link href={session?.user ? '/dashboard' : '/sign-in'} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cbd6c9] bg-[#fffefa] px-5 text-sm font-semibold shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#287b6f]">
          {session?.user ? 'Open dashboard' : 'Caregiver sign in'}
        </Link>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[1.04fr_.96fr] lg:px-10 lg:pb-28 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#d7e4d5] bg-[#edf2e7] px-4 py-2 text-xs font-semibold uppercase tracking-[.14em] text-[#287b6f]"><Sparkles className="size-4" aria-hidden="true" /> Household care, clearly coordinated</p>
          <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-.055em] sm:text-6xl lg:text-7xl">A calmer way to care for home, together.</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[#62736e]">CareBoard gives families and trusted caregivers one private place to coordinate household work, know what matters next, and celebrate what is done.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={session?.user ? '/dashboard' : '/sign-in'} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#287b6f] px-6 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(40,123,111,.18)] transition hover:bg-[#216b61] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#287b6f]">
              {session?.user ? 'Go to your dashboard' : 'Sign in to your care team'} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className="inline-flex min-h-13 items-center justify-center rounded-xl px-6 text-sm font-semibold text-[#287b6f] transition hover:bg-[#ecefe7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#287b6f]">See how it works</a>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm text-[#62736e]"><ShieldCheck className="size-4 text-[#287b6f]" aria-hidden="true" /> Manager-approved access. Your household stays private.</p>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:mx-0 lg:ml-auto">
          <div className="absolute -inset-8 -z-0 rounded-full bg-[#dfead9]/65 blur-3xl" />
          <div className="relative overflow-hidden rounded-[30px] border border-[#d8e3d5] bg-[#fffefa] p-5 shadow-[0_28px_90px_rgba(32,49,45,.1)] sm:p-7">
            <div className="flex items-center justify-between border-b border-[#e4e9df] pb-5">
              <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#287b6f]">Today at home</p><h2 className="mt-1 text-xl font-semibold">Good morning, care team</h2></div>
              <span className="grid size-11 place-items-center rounded-full bg-[#e3eee7] text-sm font-bold text-[#287b6f]">3/5</span>
            </div>
            <div className="space-y-3 py-5">
              {[
                ['Fresh linens for the guest room', 'Upstairs · Assigned to Maya'],
                ['Prepare the weekly medication box', 'Kitchen · Due today'],
                ['Water the indoor plants', 'Living room · Available'],
              ].map(([title, detail], index) => (
                <div key={title} className="flex items-start gap-4 rounded-2xl border border-[#e0e7dd] bg-[#f8f8f4] p-4">
                  <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${index === 0 ? 'bg-[#287b6f] text-white' : 'border-2 border-[#b7c9bc] text-transparent'}`}><CheckCircle2 className="size-4" aria-hidden="true" /></span>
                  <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-[#71807b]">{detail}</p></div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-[#204c45] p-5 text-white"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#b9ddd3]">Care team</p><p className="mt-2 text-sm leading-6 text-white/80">Everyone sees the same plan. Only approved people can enter.</p></div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-[#dfe5dc] bg-[#fffefa] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#287b6f]">Care without confusion</p><h2 className="mt-4 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">The household knows what is happening.</h2><p className="mt-5 text-base leading-7 text-[#62736e]">Less chasing, fewer assumptions, and a clear record of the care your team provides.</p></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {benefits.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-3xl border border-[#dfe5dc] bg-[#f8f8f4] p-7">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#e3eee7] text-[#287b6f]"><Icon className="size-5" aria-hidden="true" /></span>
                <h3 className="mt-6 text-xl font-semibold tracking-[-.02em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#687873]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-[30px] bg-[#204c45] p-8 text-white sm:p-12 lg:flex-row lg:items-center">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#b9ddd3]">For approved care teams</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.035em]">Your private care board is ready.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/70">Sign in with the Google account your household manager approved.</p></div>
          <Link href={session?.user ? '/dashboard' : '/sign-in'} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#204c45] transition hover:bg-[#f1f5ef] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{session?.user ? 'Open dashboard' : 'Secure sign in'} <ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
      </section>

      <footer className="border-t border-[#dfe5dc] px-5 py-8 text-sm text-[#687873] sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 sm:flex-row"><span className="font-semibold text-[#20312d]">CareBoard</span><span>Private household care coordination.</span></div></footer>
    </main>
  );
}
