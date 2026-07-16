import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewerContext, canManageOrg, isFullAccess } from "@/lib/getViewerContext";
import ClientsManager from "./ClientsManager";

export default async function ClientsPage() {
  const { profile, organization } = await requireViewerContext();
  if (profile.role === "client" || !isFullAccess(profile)) redirect("/dashboard");

  const supabase = await createClient();

  // These two queries don't depend on each other -- run them together
  // instead of waiting on one before starting the next.
  const [{ data: clients }, { data: creditTransactions }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, client_name, purpose, amount_paid, total_fee_agreed, status, linked_transaction_ids")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false }),
    // Credit transactions are the pool a client's payments get reconciled
    // against -- fetched once here rather than per-client to keep this cheap.
    supabase
      .from("transactions")
      .select("id, txn_date, description, amount")
      .eq("organization_id", organization.id)
      .eq("type", "credit")
      .order("txn_date", { ascending: false })
      .limit(200),
  ]);

  return (
    <ClientsManager
      organizationId={organization.id}
      currency={organization.currency}
      canEdit={canManageOrg(profile)}
      initialClients={clients ?? []}
      creditTransactions={creditTransactions ?? []}
    />
  );
}
