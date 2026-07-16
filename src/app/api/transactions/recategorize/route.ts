import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { learnCategoryRule } from "@/lib/categoryRuleLearning";
import { appendAuditEvent } from "@/lib/auditLog";
import { withErrorLogging } from "@/lib/errorLog";

// Lets anyone trusted to categorize transactions (owner/admin, or a
// stakeholder with can_confirm_flags) fix a transaction that's already
// confirmed -- not just ones sitting in the Flagged queue. Doesn't touch
// status/approval at all: the transaction was already confirmed (or is
// awaiting approval) under its original category, and swapping the category
// alone doesn't change whether a debit crosses the approval threshold.
export const POST = withErrorLogging("api:/api/transactions/recategorize", async (request: Request) => {
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

  const canRecategorize =
    profile.role === "owner" || profile.role === "admin" || profile.can_confirm_flags;
  if (!canRecategorize) {
    return NextResponse.json({ error: "You don't have permission to change transaction categories." }, { status: 403 });
  }

  const { transactionId, categoryId } = await request.json();
  if (!transactionId || !categoryId) {
    return NextResponse.json({ error: "transactionId and categoryId are required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: txn } = await admin
    .from("transactions")
    .select("id, organization_id, description, category_id")
    .eq("id", transactionId)
    .single();

  if (!txn || txn.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  const { data: category } = await admin
    .from("categories")
    .select("id, organization_id")
    .eq("id", categoryId)
    .single();

  if (!category || category.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  const previousCategoryId = txn.category_id;
  if (previousCategoryId === categoryId) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const { error: updateError } = await admin
    .from("transactions")
    .update({ category_id: categoryId })
    .eq("id", transactionId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Reinforces (or corrects) the keyword rule from this description, same as
  // confirming a flag does -- a manual re-categorization is exactly the kind
  // of signal that should make future auto-categorization better.
  await learnCategoryRule({
    organizationId: profile.organization_id,
    description: txn.description,
    categoryId,
  });

  await appendAuditEvent({
    organizationId: profile.organization_id,
    transactionId,
    eventType: "recategorized",
    eventData: { previousCategoryId, categoryId },
    actorProfileId: profile.id,
  });

  return NextResponse.json({ ok: true });
});
