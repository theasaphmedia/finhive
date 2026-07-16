// Shared skeleton used by every route-level loading.tsx under /dashboard.
// Next.js only shows a loading.tsx while ITS OWN segment's page is fetching
// data, so each tab (transactions, clients, categories, etc.) needs its own
// loading.tsx to get instant feedback on click -- a single one at the
// dashboard root only covers the "/dashboard" overview route itself.
export default function DashboardSkeleton() {
  return (
    <div className="fade-in flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-200/70" />
      <div className="card flex flex-col gap-4 p-6 shadow-sm">
        <div className="h-4 w-full animate-pulse rounded bg-zinc-200/70" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-200/70" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200/70" />
      </div>
      <div className="card flex flex-col gap-3 p-6 shadow-sm">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-full animate-pulse rounded bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}
