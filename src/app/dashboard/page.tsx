import { createClient } from "@/lib/supabase/server";
import { requireViewerContext, isFullAccess } from "@/lib/getViewerContext";
import OverviewChart, { type MonthPoint } from "./OverviewChart";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { profile, organization } = await requireViewerContext();
  const supabase = await createClient();
  const params = await searchParams;
  const range = params.range ?? "6m";

  if (profile.role === "client") {
    const { data: clientRecord } = profile.linked_client_id
      ? await supabase
          .from("clients")
          .select("id, client_name, purpose, amount_paid, total_fee_agreed, status")
          .eq("id", profile.linked_client_id)
          .maybeSingle()
      : { data: null };

    if (!clientRecord) {
      return (
        <p className="text-sm text-zinc-500">
          No client record is linked to your account yet. Contact {organization.name} to get this
          set up.
        </p>
      );
    }

    const balance = clientRecord.total_fee_agreed - clientRecord.amount_paid;

    return (
      <div className="card fade-in max-w-md p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-800">{clientRecord.client_name}</h2>
        <p className="mt-1 text-sm text-zinc-500">{clientRecord.purpose}</p>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-zinc-500">Total agreed</dt>
            <dd className="font-medium text-zinc-800">
              {organization.currency} {clientRecord.total_fee_agreed.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Paid so far</dt>
            <dd className="font-medium text-zinc-800">
              {organization.currency} {clientRecord.amount_paid.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Balance due</dt>
            <dd className="font-medium text-zinc-800">
              {organization.currency} {balance.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Status</dt>
            <dd
              className="font-medium"
              style={{ color: clientRecord.status === "paid_in_full" ? organization.brand_accent_color : "#B45309" }}
            >
              {clientRecord.status === "paid_in_full" ? "Paid in full" : "Balance due"}
            </dd>
          </div>
        </dl>
        <a
          href={`/dashboard/clients/${clientRecord.id}/statement`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary mt-5 inline-block"
        >
          View / print statement
        </a>
      </div>
    );
  }

  const now = new Date();
  const earliest = new Date(now);
  switch (range) {
    case "1w":
      earliest.setDate(earliest.getDate() - 7);
      break;
    case "1m":
      earliest.setMonth(earliest.getMonth() - 1);
      break;
    case "3m":
      earliest.setMonth(earliest.getMonth() - 3);
      break;
    case "1y":
      earliest.setFullYear(earliest.getFullYear() - 1);
      break;
    case "6m":
    default:
      earliest.setMonth(earliest.getMonth() - 6);
      break;
  }
  const earliestStr = earliest.toISOString().slice(0, 10);

  // category_summary is scoped to the caller automatically (org + role), and
  // works for both full-access and summary-access viewers alike -- same view
  // the Reports page uses. It only stores weekly buckets, so short ranges
  // (1 week/1 month) are shown as-is per week, while longer ranges (3/6/12
  // months) get re-aggregated up into monthly bars -- otherwise a year view
  // would be ~52 bars wide and a 1-week view would have nothing to bucket.
  // These two queries don't depend on each other -- run them together
  // instead of waiting on one before starting the next.
  const [{ data: summaryRows }, flaggedCountResult] = await Promise.all([
    supabase
      .from("category_summary")
      .select("period, total_spent, total_received")
      .gte("period", earliestStr),
    isFullAccess(profile)
      ? supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization.id)
          .eq("status", "flagged")
      : Promise.resolve({ count: 0 }),
  ]);
  const flaggedCount = flaggedCountResult.count ?? 0;

  const useWeeklyBuckets = range === "1w" || range === "1m";
  let chartData: MonthPoint[];

  if (useWeeklyBuckets) {
    const byWeek = new Map<string, { label: string; income: number; expense: number }>();
    for (const row of summaryRows ?? []) {
      const periodDate = new Date(row.period);
      const key = periodDate.toISOString().slice(0, 10);
      const bucket = byWeek.get(key) ?? {
        label: periodDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        income: 0,
        expense: 0,
      };
      bucket.income += Number(row.total_received) || 0;
      bucket.expense += Number(row.total_spent) || 0;
      byWeek.set(key, bucket);
    }
    chartData = Array.from(byWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, ...v }));
  } else {
    const monthCount = range === "3m" ? 3 : range === "1y" ? 12 : 6;
    const months: { key: string; label: string; start: Date }[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: d.toLocaleDateString("en-US", { month: "short" }), start: d });
    }
    const byMonth = new Map(months.map((m) => [m.key, { income: 0, expense: 0 }]));
    for (const row of summaryRows ?? []) {
      const periodDate = new Date(row.period);
      const key = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, "0")}`;
      const bucket = byMonth.get(key);
      if (bucket) {
        bucket.income += Number(row.total_received) || 0;
        bucket.expense += Number(row.total_spent) || 0;
      }
    }
    chartData = months.map((m) => ({ key: m.key, label: m.label, ...byMonth.get(m.key)! }));
  }

  return (
    <div className="flex flex-col gap-8">
      {isFullAccess(profile) && flaggedCount > 0 && (
        <a
          href="/dashboard/flagged"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 transition-transform duration-150 hover:-translate-y-0.5"
        >
          {flaggedCount} transaction{flaggedCount === 1 ? "" : "s"} need review &rarr;
        </a>
      )}

      <OverviewChart
        data={chartData}
        currency={organization.currency}
        accentColor={organization.brand_accent_color}
        range={range}
      />

      <p className="text-sm text-zinc-500">
        Manage categories any time -- rename, archive, reorder, or add new ones from{" "}
        <a href="/dashboard/categories" className="font-medium" style={{ color: organization.brand_accent_color }}>
          Categories
        </a>
        .
      </p>
    </div>
  );
}
