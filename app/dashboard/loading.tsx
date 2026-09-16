import { RefreshCw } from 'lucide-react';

export default function DashboardLoading() {
  return <main className="careboard grid min-h-screen place-items-center px-5" aria-busy="true" aria-label="Loading CareBoard dashboard">
    <div className="dashboard-card w-full max-w-md rounded-3xl border p-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e8f1ec] text-[#287b6f]"><RefreshCw className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" /></span>
      <h1 className="mt-5 text-xl font-semibold">Preparing your CareBoard</h1>
      <p className="mt-2 text-sm leading-6 text-[#52645f]">Loading the latest household plan and updates.</p>
    </div>
  </main>;
}
