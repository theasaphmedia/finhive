import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { learnCategoryRule } from "@/lib/categoryRuleLearning";
import { appendAuditEvent } from "@/lib/auditLog";
import { withErrorLogging } from "@/lib/errorLog";

// Approves a transaction sitting in pending_approval. Enforces the actual
// point of a second-approval requirement server-side, not just by hiding a
// button in the UI: the person approving must be a DIFFERENT owner/admin
// than whoever originally confirmed its category.
export const POST = withErrorLogging("api:/api/transactions/approve", async (request: Request) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Only owners or admins can approve transactions." }, { status: 403 });
  }

  const { transactionId } = await request.json();
  if (!transactionId) return NextResponse.json({ error: "transactionId is required." }, { status: 400 });

  const admin = createAdminClient();

  const { data: txn } = await admin
    .from("transactions")
    .select("id, organization_id, status, confirmed_by, category_id, description, amount, type")
    .eq("id", transactionId)
    .single();

  if (!txn || txn.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }
  if (txn.status !== "pending_approval") {
    return NextResponse.json({ error: "This transaction isn't waiting on approval." }, { status: 400 });
  }
  if (txn.confirmed_by === profile.id) {
    return NextResponse.json(
      { error: "The person who categorized this transaction can't also approve it -- ask another owner or admin." },
      { status: 403 }
    );
  }

  const { error: updateError } = await admin
    .from("transactions")
    .update({
      status: "confirmed",
      flagged_reason: null,
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", transactionId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (txn.category_id) {
    await learnCategoryRule({
      organizationId: profile.organization_id,
      description: txn.description,
      categoryId: txn.category_id,
    });
  }

  await appendAuditEvent({
    organizationId: profile.organization_id,
    transactionId,
    eventType: "approved",
    eventData: { amount: txn.amount, type: txn.type },
    actorProfileId: profile.id,
  });

  return NextResponse.json({ ok: true });
});
