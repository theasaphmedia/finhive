import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { needsApproval } from "@/lib/approvalGate";
import { learnCategoryRule } from "@/lib/categoryRuleLearning";
import { appendAuditEvent } from "@/lib/auditLog";
import { notifyOrgAdmins } from "@/lib/notify";
import { withErrorLogging } from "@/lib/errorLog";

// Replaces the direct client-side `.update()` the Flagged queue used to do.
// Centralizing this server-side is what makes three things possible that a
// plain client update can't do safely: (1) gate large debits into
// pending_approval instead of confirmed, (2) silently teach a category_rule
// from the description so the same kind of transaction doesn't need review
// again, and (3) append a tamper-evident audit event -- all of which need
// either elevated privileges or a single source of truth for "this just got
// confirmed."
export const POST = withErrorLogging("api:/api/transactions/confirm", async (request: Request) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, role, can_confirm_flags")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "No profile found." }, { status: 403 });

  const canConfirm =
    profile.role === "owner" || profile.role === "admin" || profile.can_confirm_flags;
  if (!canConfirm) {
    return NextResponse.json({ error: "You don't have permission to confirm transactions." }, { status: 403 });
  }

  const { transactionId, categoryId } = await request.json();
  if (!transactionId || !categoryId) {
    return NextResponse.json({ error: "transactionId and categoryId are required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: txn } = await admin
    .from("transactions")
    .select("id, organization_id, type, amount, description, status")
    .eq("id", transactionId)
    .single();

  if (!txn || txn.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  const { data: org } = await admin
    .from("organizations")
    .select("approval_threshold")
    .eq("id", profile.organization_id)
    .single();

  const requiresApproval = needsApproval(org?.approval_threshold ?? null, txn.type, Number(txn.amount));
  const newStatus = requiresApproval ? "pending_approval" : "confirmed";

  const { error: updateError } = await admin
    .from("transactions")
    .update({
      category_id: categoryId,
      status: newStatus,
      flagged_reason: requiresApproval
        ? `Above this organization's approval threshold -- awaiting a second confirmation.`
        : null,
      confirmed_by: profile.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", transactionId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Only teach a rule once the category is actually final (skip while still
  // waiting on a second approver -- the category could still get corrected).
  if (!requiresApproval) {
    await learnCategoryRule({
      organizationId: profile.organization_id,
      description: txn.description,
      categoryId,
    });
  }

  await appendAuditEvent({
    organizationId: profile.organization_id,
    transactionId,
    eventType: requiresApproval ? "pending_approval" : "confirmed",
    eventData: { categoryId, amount: txn.amount, type: txn.type },
    actorProfileId: profile.id,
  });

  if (requiresApproval) {
    await notifyOrgAdmins({
      organizationId: profile.organization_id,
      type: "approval_needed",
      subject: "A transaction needs a second approval",
      body: `${txn.description} (${txn.amount}) was categorized and is above your organization's approval threshold. Sign in to FinHive to approve it.`,
    });
  }

  return NextResponse.json({ ok: true, status: newStatus });
});
