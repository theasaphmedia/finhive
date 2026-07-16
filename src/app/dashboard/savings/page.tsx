import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireViewerContext, isFullAccess } from "@/lib/getViewerContext";
import { currentCycleNumber } from "@/lib/savingsCycles";
import SavingsManager from "./SavingsManager";

export default async function SavingsPage() {
  const { profile, organization } = await requireViewerContext();
  if (profile.role === "client" || !isFullAccess(profile)) redirect("/dashboard");

  const supabase = await createClient();

  // Credit transactions reconcile against contributions (money coming in);
  // debit transactions reconcile against payouts (money going out to
  // whoever's turn it is). Same ingestion pipeline the rest of the app uses --
  // nothing savings-specific about how these rows get created.
  const [{ data: groups }, { data: creditTransactions }, { data: debitTransactions }] = await Promise.all([
    supabase
      .from("savings_groups")
      .select("id, name, contribution_amount, cycle_frequency, start_date, is_archived")
      .eq("organization_id", organization.id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("id, txn_date, description, amount")
      .eq("organization_id", organization.id)
      .eq("type", "credit")
      .order("txn_date", { ascending: false })
      .limit(200),
    supabase
      .from("transactions")
      .select("id, txn_date, description, amount")
      .eq("organization_id", organization.id)
      .eq("type", "debit")
      .order("txn_date", { ascending: false })
      .limit(200),
  ]);

  const groupIds = (groups ?? []).map((g) => g.id);

  if (groupIds.length === 0) {
    return (
      <SavingsManager
        organizationId={organization.id}
        currency={organization.currency}
        canEdit={profile.role === "owner" || profile.role === "admin"}
        initialGroups={[]}
        initialMembers={[]}
        initialContributions={[]}
        initialPayouts={[]}
        initialShareLinks={[]}
        creditTransactions={creditTransactions ?? []}
        debitTransactions={debitTransactions ?? []}
      />
    );
  }

  const [{ data: members }, { data: payouts }, { data: shareLinks }] = await Promise.all([
    supabase
      .from("savings_members")
      .select("id, group_id, name, phone, payout_position")
      .in("group_id", groupIds)
      .order("payout_position"),
    supabase
      .from("payouts")
      .select("id, group_id, member_id, cycle_number, amount, paid_at, linked_transaction_id")
      .in("group_id", groupIds),
    supabase
      .from("public_share_links")
      .select("id, scope, scope_ref_id, token, expires_at, revoked_at, created_at")
      .eq("organization_id", organization.id)
      .eq("scope", "savings_group")
      .in("scope_ref_id", groupIds)
      .is("revoked_at", null),
  ]);

  // Every group's "current cycle" is derived from its own start_date -- make
  // sure a contribution row exists for every member for their group's
  // current cycle before rendering, so the dashboard never shows a blank
  // cycle. onConflict do-nothing means an already-paid contribution is never
  // touched by this.
  const rowsToEnsure = (groups ?? []).flatMap((g) => {
    const cycle = currentCycleNumber(g.start_date, g.cycle_frequency as "weekly" | "monthly");
    return (members ?? [])
      .filter((m) => m.group_id === g.id)
      .map((m) => ({
        group_id: g.id,
        member_id: m.id,
        cycle_number: cycle,
        amount_expected: g.contribution_amount,
      }));
  });

  if (rowsToEnsure.length > 0) {
    // Uses the service-role client deliberately: this is a narrow, idempotent
    // bookkeeping side-effect of merely *viewing* the page (guaranteeing a
    // placeholder row exists for the current cycle), not a user-initiated
    // write. The contributions INSERT policy is owner/admin-only, so a
    // full-access stakeholder (allowed to view this page, but not to edit
    // amounts) would otherwise silently fail to get new-cycle rows created
    // under their own RLS-scoped session.
    const admin = createAdminClient();
    await admin
      .from("contributions")
      .upsert(rowsToEnsure, { onConflict: "group_id,member_id,cycle_number", ignoreDuplicates: true });
  }

  const { data: contributions } = await supabase
    .from("contributions")
    .select("id, group_id, member_id, cycle_number, amount_expected, amount_paid, status, linked_transaction_id")
    .in("group_id", groupIds);

  return (
    <SavingsManager
      organizationId={organization.id}
      currency={organization.currency}
      canEdit={profile.role === "owner" || profile.role === "admin"}
      initialGroups={groups ?? []}
      initialMembers={members ?? []}
      initialContributions={contributions ?? []}
      initialPayouts={payouts ?? []}
      initialShareLinks={shareLinks ?? []}
      creditTransactions={creditTransactions ?? []}
      debitTransactions={debitTransactions ?? []}
    />
  );
}
