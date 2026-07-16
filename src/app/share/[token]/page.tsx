import { createAdminClient } from "@/lib/supabase/admin";

// Fully public, no-login page -- this is the actual "transparency" half of
// the product promise. Deliberately uses the service-role admin client
// (there is no authenticated user at all on this route) and hand-picks
// exactly which columns get returned, rather than exposing anything from
// RLS-scoped tables directly to an anonymous visitor.
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: link } = await admin
    .from("public_share_links")
    .select("id, organization_id, scope, scope_ref_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  const invalid =
    !link ||
    link.revoked_at !== null ||
    (link.expires_at !== null && new Date(link.expires_at) < new Date());

  if (invalid) {
    return <SharedShell title="This link is no longer available.">Ask the organization for a fresh link.</SharedShell>;
  }

  const { data: organization } = await admin
    .from("organizations")
    .select("name, currency, brand_primary_color")
    .eq("id", link.organization_id)
    .single();

  if (link.scope === "category_summary") {
    return (
      <CategorySummaryShare
        admin={admin}
        organizationId={link.organization_id}
        orgName={organization?.name ?? "This organization"}
        currency={organization?.currency ?? ""}
      />
    );
  }

  return <SharedShell title="Nothing to show here yet.">This link's scope isn't set up.</SharedShell>;
}

async function CategorySummaryShare({
  admin,
  organizationId,
  orgName,
  currency,
}: {
  admin: ReturnType<typeof createAdminClient>;
  organizationId: string;
  orgName: string;
  currency: string;
}) {
  // Evergreen link: always shows the rolling last-30-days snapshot, computed
  // fresh on every visit -- a board member or accountant can bookmark this
  // once and it stays current, rather than freezing a report at share-time.
  const today = new Date();
  const from = new Date(today);
  from.setMonth(from.getMonth() - 1);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = today.toISOString().slice(0, 10);

  const [{ data: summaryRows }, { data: categories }] = await Promise.all([
    admin
      .from("category_summary")
      .select("category_id, total_spent, total_received, txn_count, period")
      .eq("organization_id", organizationId)
      .gte("period", fromStr)
      .lte("period", toStr),
    admin.from("categories").select("id, name, type").eq("organization_id", organizationId),
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
    <SharedShell title={`${orgName} -- Category summary`}>
      <p className="text-sm text-zinc-500">
        Last 30 days ({fromStr} to {toStr}) &middot; category totals only, no individual transaction detail
      </p>

      <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2 text-right">Spent</th>
              <th className="px-4 py-2 text-right">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="px-4 py-2 text-zinc-800">{r.name}</td>
                <td className="px-4 py-2 text-right text-zinc-800">
                  {r.total_spent > 0 ? `${currency} ${r.total_spent.toLocaleString()}` : "--"}
                </td>
                <td className="px-4 py-2 text-right text-zinc-800">
                  {r.total_received > 0 ? `${currency} ${r.total_received.toLocaleString()}` : "--"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-zinc-500">
                  No transactions in this period.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50 font-medium text-zinc-800">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right">{currency} {totalSpent.toLocaleString()}</td>
              <td className="px-4 py-2 text-right">{currency} {totalReceived.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </SharedShell>
  );
}

function SharedShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-wider text-zinc-400">
          FinHive &middot; public transparency view
        </p>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-800">{title}</h1>
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
