import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewerContext, isFullAccess } from "@/lib/getViewerContext";
import StatementView from "./StatementView";

export default async function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, organization } = await requireViewerContext();

  const supabase = await createClient();

  // A client-role viewer may only ever see their own linked record; everyone
  // else needs full transaction-level access to view any client's statement.
  const isOwnRecord = profile.role === "client" && profile.linked_client_id === id;
  if (!isOwnRecord && !isFullAccess(profile)) redirect("/dashboard");

  const { data: client } = await supabase
    .from("clients")
    .select("id, client_name, purpose, amount_paid, total_fee_agreed, status, created_at")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (!client) notFound();

  return (
    <StatementView
      client={client}
      organizationName={organization.name}
      currency={organization.currency}
      primaryColor={organization.brand_primary_color}
      accentColor={organization.brand_accent_color}
      generatedAt={new Date().toISOString()}
    />
  );
}
