import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewerContext, canManageOrg } from "@/lib/getViewerContext";
import ApprovalsQueue from "./ApprovalsQueue";

export default async function ApprovalsPage() {
  const { profile, organization } = await requireViewerContext();
  if (!canManageOrg(profile)) redirect("/dashboard");

  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("transactions")
    .select("id, txn_date, type, description, amount, flagged_reason, confirmed_by, categories(name)")
    .eq("organization_id", organization.id)
    .eq("status", "pending_approval")
    .order("txn_date", { ascending: false });

  const confirmerIds = Array.from(
    new Set((pending ?? []).map((t) => t.confirmed_by).filter((v): v is string => !!v))
  );

  const { data: confirmers } =
    confirmerIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", confirmerIds)
      : { data: [] };

  const confirmerNameById = new Map((confirmers ?? []).map((c) => [c.id, c.name]));

  const rows = (pending ?? []).map((t) => ({
    id: t.id,
    txn_date: t.txn_date,
    type: t.type as "credit" | "debit",
    description: t.description,
    amount: Number(t.amount),
    flagged_reason: t.flagged_reason,
    confirmed_by: t.confirmed_by,
    confirmedByName: t.confirmed_by ? confirmerNameById.get(t.confirmed_by) ?? "Someone" : null,
    categoryName: Array.isArray(t.categories) ? t.categories[0]?.name : (t.categories as { name: string } | null)?.name,
  }));

  return <ApprovalsQueue currency={organization.currency} currentProfileId={profile.id} initialPending={rows} />;
}
