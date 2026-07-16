import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewerContext, isFullAccess } from "@/lib/getViewerContext";
import FlaggedQueue from "./FlaggedQueue";

export default async function FlaggedPage() {
  const { profile, organization } = await requireViewerContext();
  const canReview = isFullAccess(profile) || profile.can_confirm_flags;
  if (!canReview) redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: flagged }, { data: categories }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, txn_date, type, description, amount, flagged_reason, raw_source_text")
      .eq("organization_id", organization.id)
      .eq("status", "flagged")
      .order("txn_date", { ascending: false }),
    supabase
      .from("categories")
      .select("id, name, type")
      .eq("organization_id", organization.id)
      .eq("is_archived", false)
      .order("sort_order"),
  ]);

  return (
    <FlaggedQueue
      organizationId={organization.id}
      currency={organization.currency}
      initialFlagged={flagged ?? []}
      categories={categories ?? []}
      canCreateCategory={profile.role === "owner" || profile.role === "admin"}
      currentProfileId={profile.id}
    />
  );
}
