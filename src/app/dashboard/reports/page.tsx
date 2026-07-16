import { createClient } from "@/lib/supabase/server";
import { requireViewerContext, canManageOrg } from "@/lib/getViewerContext";
import { getPeriodRange, type PeriodId } from "@/lib/reportPeriods";
import ReportView from "./ReportView";
import ReportShareLinks from "./ReportShareLinks";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { profile, organization } = await requireViewerContext();

  const period = (params.period as PeriodId) ?? "monthly";
  const { from, to } = getPeriodRange(period, params.from, params.to);

  const supabase = await createClient();
  const canManage = canManageOrg(profile);

  // category_summary is scoped to the caller automatically (org + role), and
  // works for both full-access and summary-access viewers alike. The share
  // links query only matters for owner/admin, but running it unconditionally
  // in parallel is cheaper than a second round-trip.
  //
  // Closing balance = balance_after of the most recent transaction on or
  // before the period's end date. Opening balance = same, but strictly
  // before the period's start date -- i.e. the balance the account was
  // sitting at right before this period began. Both come straight from
  // whatever the bank alert itself reported, not a computed running total,
  // so they stay correct even across gaps in ingestion.
  const [
    { data: summaryRows },
    { data: categories },
    { data: shareLinks },
    { data: closingRow },
    { data: openingRow },
  ] = await Promise.all([
    supabase
      .from("category_summary")
      .select("category_id, total_spent, total_received, txn_count, period")
      .gte("period", from)
      .lte("period", to),
    supabase.from("categories").select("id, name, type").eq("organization_id", organization.id),
    canManage
      ? supabase
          .from("public_share_links")
          .select("id, scope, scope_ref_id, token, expires_at, revoked_at, created_at")
          .eq("organization_id", organization.id)
          .eq("scope", "category_summary")
          .is("revoked_at", null)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("transactions")
      .select("balance_after, txn_date, txn_time")
      .eq("organization_id", organization.id)
      .not("balance_after", "is", null)
      .lte("txn_date", to)
      .order("txn_date", { ascending: false })
      .order("txn_time", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("balance_after, txn_date, txn_time")
      .eq("organization_id", organization.id)
      .not("balance_after", "is", null)
      .lt("txn_date", from)
      .order("txn_date", { ascending: false })
      .order("txn_time", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]));

  const totalsByCategory = new Map<
    string,
    { name: string; type: string; total_spent: number; total_received: number; txn_count: number }
  >();

  for (const row of summaryRows ?? []) {
    const key = row.category_id ?? "uncategorized";
    const cat = row.category_id ? categoryMap.get(row.category_id) : null;
    const existing = totalsByCategory.get(key) ?? {
      name: cat?.name ?? "Uncategorized",
      type: cat?.type ?? "expense",
      total_spent: 0,
      total_received: 0,
      txn_count: 0,
    };
    existing.total_spent += Number(row.total_spent) || 0;
    existing.total_received += Number(row.total_received) || 0;
    existing.txn_count += Number(row.txn_count) || 0;
    totalsByCategory.set(key, existing);
  }

  const rows = Array.from(totalsByCategory.values()).sort((a, b) => a.name.localeCompare(b.name));
  const totalSpent = rows.reduce((sum, r) => sum + r.total_spent, 0);
  const totalReceived = rows.reduce((sum, r) => sum + r.total_received, 0);

  return (
    <>
      <ReportView
        period={period}
        from={from}
        to={to}
        rows={rows}
        totalSpent={totalSpent}
        totalReceived={totalReceived}
        currency={organization.currency}
        organizationName={organization.name}
        primaryColor={organization.brand_primary_color}
        openingBalance={openingRow?.balance_after != null ? Number(openingRow.balance_after) : null}
        closingBalance={closingRow?.balance_after != null ? Number(closingRow.balance_after) : null}
        closingAsOfDate={closingRow?.txn_date ?? null}
      />
      {canManage && <ReportShareLinks initialLinks={shareLinks ?? []} />}
    </>
  );
}
