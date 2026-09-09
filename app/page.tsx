import Link from 'next/link';
import { ArrowRight, BedDouble, Bell, Check, ClipboardCheck, Clock3, FileCheck2, HeartHandshake, LockKeyhole, LogIn, ShieldCheck, Sprout, Users } from 'lucide-react';
import { auth } from '@/auth';
import { googleSignIn } from '@/app/actions/auth';
import { googleAuthenticationConfigured } from '@/lib/auth-config';

const focusClass = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#287b6f]';
const primaryClass = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#246f63] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_0_#194e46] transition hover:bg-[#1d5b51] active:translate-y-px sm:w-auto ${focusClass}`;
const steps = [
  { icon: ClipboardCheck, title: 'Make a plan', text: 'Assign household tasks, set recurring schedules, and keep due dates and reminders in one place.' },
  { icon: HeartHandshake, title: 'Share the care', text: 'Workers see their assignments and available work. Add progress notes, flag issues, and share photos.' },
  { icon: FileCheck2, title: 'Know what’s done', text: 'Managers review completed work, coordinate the team, and export monthly reports. Less chasing, more clarity.' },
];

function BrandIcon({ size = 40 }: { size?: number }) {
  return <svg data-slot="brand-icon" width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" className="shrink-0">
    <rect width="64" height="64" rx="16" fill="#287b6f" />
    <path d="M16 30 L32 16 L48 30 L44 30 L44 47 L20 47 L20 30 Z" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M26 36 L31 41 L39 33" stroke="#f4c95d" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function CareIllustration() {
  return <svg viewBox="0 0 480 174" width="480" height="174" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" className="mx-auto h-auto w-full max-w-md">
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
  </svg>;
}

function ExampleBoard() {
  return <figure className="relative mx-auto w-full max-w-lg rounded-[28px] border border-[#d8e3d8] bg-[#eaf0e6] p-4 sm:p-6">
    <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[.15em] text-[#466457]"><span>A little teamwork goes a long way</span><HeartHandshake className="ml-2 size-4" aria-hidden="true" /></div>
    <CareIllustration />
    <div className="relative -mt-1 rounded-2xl border border-[#d7e0d6] bg-[#fffefa] p-4 shadow-[0_12px_30px_rgba(32,49,45,.07)] sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-[#e5e9e0] pb-4">
        <div className="flex items-center gap-2.5"><BrandIcon size={32} /><div><h2 className="text-sm font-bold">Today at home</h2><p className="mt-0.5 text-xs text-[#53685f]">A clear plan for your care team</p></div></div>
        <span className="hidden rounded-full bg-[#edf3e9] px-2.5 py-1 text-[10px] font-semibold text-[#466457] min-[380px]:inline-flex">Example board</span>
      </div>
      <ul className="divide-y divide-[#e7ebe4]">
        {[
          { icon: Check, title: 'Fresh linens', detail: 'Bedroom · Completed by Maya', status: 'Done', tone: 'bg-[#e4f0e8] text-[#25654f]' },
          { icon: BedDouble, title: 'Tidy the guest room', detail: 'Bedroom · Assigned to Alex', status: 'In progress', tone: 'bg-[#fbefd9] text-[#81571f]' },
          { icon: Sprout, title: 'Water the plants', detail: 'Living room · Available to claim', status: 'Open', tone: 'bg-[#edf1ef] text-[#486156]' },
        ].map(({ icon: Icon, title, detail, status, tone }) => (
          <li key={title} className="flex items-center gap-3 py-3.5">
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="size-4" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold sm:text-sm">{title}</p><p className="mt-1 text-[11px] leading-4 text-[#53685f]">{detail}</p></div>
            <span className={`hidden shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold sm:inline-flex ${tone}`}>{status}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 rounded-xl bg-[#f2f5ee] px-3 py-2 text-[11px] text-[#466457]"><Bell className="size-4" aria-hidden="true" />The next task, the right person, a little less worry.</div>
    </div>
    <figcaption className="mt-3 text-center text-[10px] text-[#53685f]">Example board · Not live household data.</figcaption>
  </figure>;
}

export default async function Home() {
  const session = await auth();
  const signedIn = Boolean(session?.user);
  const googleEnabled = googleAuthenticationConfigured();
  const destination = signedIn ? '/dashboard' : '/sign-in';

  return (
    <div className="min-h-screen bg-[#fafbf7] text-[#203c34]">
      <a href="#main" className={`sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:p-3 ${focusClass}`}>Skip to content</a>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Link href="/" aria-label="CareBoard home" className={`inline-flex items-center gap-2.5 rounded-xl ${focusClass}`}><BrandIcon /><span className="text-xl font-bold tracking-tight">CareBoard</span></Link>
        <nav aria-label="Main navigation" className="flex items-center gap-5 text-sm font-medium">
          <a href="#how-it-works" className={`hidden rounded-lg text-[#53685f] hover:text-[#246f63] sm:block ${focusClass}`}>How it works</a>
          <Link href={destination} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d3dfd4] bg-white px-3 text-xs font-semibold transition hover:bg-[#edf3e9] sm:px-4 sm:text-sm ${focusClass}`}>{signedIn ? 'Dashboard' : 'Sign in'}<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
        <section aria-labelledby="hero-heading" className="grid items-center gap-9 pb-10 pt-7 sm:pt-10 lg:grid-cols-[1fr_1fr] lg:gap-12 lg:pb-12 lg:pt-8">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#d7e4d3] bg-[#eef4e9] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[#3e6551]"><span className="size-1.5 rounded-full bg-[#398264]" />Made for families & care teams</p>
            <h1 id="hero-heading" className="mt-5 max-w-lg text-[2.6rem] font-semibold leading-[1.08] tracking-[-.045em] sm:text-5xl lg:text-[3.6rem]">A little less juggling.<br /><span className="text-[#287b6f]">A lot more care.</span></h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[#53685f]">Your private household care board. Organize tasks, coordinate trusted workers, and see what’s done—all in one calm, shared space.</p>
            <div className="mt-7 flex flex-col items-start gap-4">
              {signedIn ? <Link href="/dashboard" className={primaryClass}>Open your dashboard<ArrowRight className="size-4" aria-hidden="true" /></Link> : googleEnabled ? <form action={googleSignIn} className="w-full sm:w-auto"><button type="submit" className={primaryClass}><LogIn className="size-4" aria-hidden="true" />Continue with Google<ArrowRight className="size-4" aria-hidden="true" /></button></form> : <Link href="/sign-in" className={primaryClass}>Sign in to your care team<ArrowRight className="size-4" aria-hidden="true" /></Link>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#53685f]">
                <span className="inline-flex items-center gap-1.5"><LockKeyhole className="size-3.5" aria-hidden="true" />Manager-approved access</span>
                {!signedIn && googleEnabled && <Link href="/sign-in" className={`rounded font-medium underline decoration-[#adc4b5] underline-offset-4 hover:text-[#246f63] ${focusClass}`}>Use a password</Link>}
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 border-t border-[#e0e7dc] pt-5 text-xs font-medium text-[#466457]">
              <span className="inline-flex items-center gap-2"><ClipboardCheck className="size-4 text-[#287b6f]" aria-hidden="true" />Clear assignments</span>
              <span className="inline-flex items-center gap-2"><Clock3 className="size-4 text-[#287b6f]" aria-hidden="true" />Timely reminders</span>
              <span className="inline-flex items-center gap-2"><Users className="size-4 text-[#287b6f]" aria-hidden="true" />Private profiles</span>
            </div>
          </div>
          <ExampleBoard />
        </section>

        <section id="how-it-works" aria-labelledby="steps-heading" className="scroll-mt-6 border-t border-[#e0e7dc] py-8">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><h2 id="steps-heading" className="text-xl font-semibold tracking-tight">Good care. Less coordination.</h2><p className="text-xs text-[#53685f]">A simple rhythm for every household.</p></div>
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, index) => <li key={title} className="rounded-2xl border border-[#e0e7dc] bg-white p-5">
              <div className="mb-3 flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#edf3e9] text-[#287b6f]"><Icon className="size-5" aria-hidden="true" /></span><span className="text-[11px] font-semibold tracking-widest text-[#6a7d71]">0{index + 1}</span></div>
              <h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-6 text-[#53685f]">{text}</p>
            </li>)}
          </ol>
        </section>

        <section id="privacy" aria-labelledby="privacy-heading" className="grid scroll-mt-6 gap-5 rounded-2xl bg-[#203f36] p-5 text-white sm:p-6 md:grid-cols-[1.3fr_1fr] md:gap-8">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#cce0bd]"><ShieldCheck className="size-5" aria-hidden="true" /></span><div><h2 id="privacy-heading" className="text-sm font-semibold">Your household. Your people.</h2><p className="mt-2 text-xs leading-6 text-[#d0e0d5]">Managers coordinate the household. Workers see only their profile, assigned tasks, and available work. Personal details stay private.</p></div></div>
          <div className="border-t border-white/15 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0"><p className="text-sm font-semibold">{googleEnabled ? 'Google single sign-on' : 'A private, approved-account space'}</p><p className="mt-2 text-xs leading-6 text-[#d0e0d5]">{googleEnabled ? 'Use your approved Google account—no separate password to remember. Password sign-in is available too.' : 'Use the account your household manager approved. Need access? Ask your manager to add you to the team.'}</p><Link href={destination} className={`mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg text-xs font-semibold text-white underline decoration-white/40 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white`}>{signedIn ? 'Go to dashboard' : 'Join your care team'}<ArrowRight className="size-4" aria-hidden="true" /></Link></div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 pb-6 text-[11px] text-[#53685f] sm:px-8"><span className="inline-flex items-center gap-2"><BrandIcon size={24} /><span className="font-semibold">CareBoard</span><span>Care, clearly coordinated.</span></span><a href="#privacy" className={`rounded-lg py-2 hover:text-[#246f63] ${focusClass}`}>Private by design</a></footer>
    </div>
  );
}
