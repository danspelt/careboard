'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="careboard grid min-h-screen place-items-center px-5">
    <div className="dashboard-card w-full max-w-lg rounded-3xl border p-8 text-center" role="alert">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f8e9dc] text-[#8b4e2c]"><AlertTriangle className="size-6" aria-hidden="true" /></span>
      <h1 className="mt-5 text-2xl font-semibold">CareBoard couldn’t load</h1>
      <p className="mt-2 text-sm leading-6 text-[#52645f]">Your data has not been changed. Check your connection and try loading the dashboard again.</p>
      <Button type="button" onClick={reset} className="mt-6 bg-[#287b6f]"><RefreshCw className="size-4" aria-hidden="true" />Try again</Button>
    </div>
  </main>;
}
