import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractTransactionFromAlert, categorizeTransaction } from "@/lib/anthropic";
import { needsApproval } from "@/lib/approvalGate";
import { appendAuditEvent } from "@/lib/auditLog";
import { notifyOrgAdmins } from "@/lib/notify";
import { withErrorLogging } from "@/lib/errorLog";

// Bank/format-agnostic ingestion endpoint (Build Spec Section 4). Called by each
// organization's Google Apps Script on a timer, with the org's own ingestion
// token, raw alert text, and the source message id (for de-duplication).
//
// Expected JSON body:
// { "token": string, "message_id": string, "raw_text": string, "auth_results"?: string }
//
// `auth_results` is Gmail's own "Authentication-Results" header, forwarded
// verbatim by the Apps Script if present -- it's how a spoofed "bank alert"
// email gets told apart from a real one, without needing any new external
// service (Gmail already computes this for every message it receives).
function parseAuthResults(authResults: string | undefined): {
  spfPass: boolean | null;
  dkimPass: boolean | null;
} {
  if (!authResults) return { spfPass: null, dkimPass: null };
  const lower = authResults.toLowerCase();
  const spfMatch = lower.match(/spf=(\w+)/);
  const dkimMatch = lower.match(/dkim=(\w+)/);
  return {
    spfPass: spfMatch ? spfMatch[1] === "pass" : null,
    dkimPass: dkimMatch ? dkimMatch[1] === "pass" : null,
  };
}

export const POST = withErrorLogging("api:/api/ingest", async (request: Request) => {
  let body: { token?: string; message_id?: string; raw_text?: string; auth_results?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, message_id: messageId, raw_text: rawText, auth_results: authResults } = body;

  if (!token || !messageId || !rawText) {
    return NextResponse.json(
      { error: "token, message_id, and raw_text are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // 1. Resolve organization from the ingestion token.
  const { data: tokenRow, error: tokenError } = await supabase
    .from("ingestion_tokens")
    .select("organization_id")
    .eq("token", token)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "Invalid ingestion token" }, { status: 401 });
  }

  const organizationId = tokenRow.organization_id;

  // 2. De-duplicate against ingestion_log.
  const { data: existingLog } = await supabase
    .from("ingestion_log")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("source_message_id", messageId)
    .maybeSingle();

  if (existingLog) {
    return NextResponse.json({ status: "duplicate_skipped" });
  }

  // 3. Extract transaction details via Claude (generic, bank-agnostic prompt).
  const extracted = await extractTransactionFromAlert(rawText);

  if (!extracted) {
    await supabase.from("ingestion_log").insert({
      organization_id: organizationId,
      source_message_id: messageId,
      raw_snippet: rawText.slice(0, 500),
    });
    return NextResponse.json({ status: "not_a_transaction_skipped" });
  }

  // 4. Categorize: keyword rules first, then Claude against the org's own list.
  const { data: rules } = await supabase
    .from("category_rules")
    .select("keyword, category_id")
    .eq("organization_id", organizationId);

  const descriptionLower = extracted.description.toLowerCase();
  const matchedRule = (rules ?? []).find((r) =>
    descriptionLower.includes(r.keyword.toLowerCase())
  );

  let categoryId: string | null = null;
  let status: "confirmed" | "flagged" | "pending_approval" = "confirmed";
  let flaggedReason: string | null = null;

  if (matchedRule) {
    categoryId = matchedRule.category_id;
  } else {
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name, type")
      .eq("organization_id", organizationId)
      .eq("is_archived", false);

    const result = await categorizeTransaction(
      extracted.description,
      extracted.type,
      categories ?? []
    );

    if (result.uncertain || !result.categoryId) {
      status = "flagged";
      flaggedReason = result.reason ?? "Could not confidently categorize this transaction.";
    } else {
      categoryId = result.categoryId;
    }
  }

  // Large/unclear credits get flagged even if a category was picked, per Build
  // Spec Section 3 step 3 -- never force a guess that might hide an anomaly.
  const isLargeUnclearCredit =
    extracted.type === "credit" && !matchedRule && status === "confirmed" && extracted.amount > 1_000_000;
  if (isLargeUnclearCredit) {
    status = "flagged";
    flaggedReason = "Large credit -- flagged for manual review.";
  }

  // Sender authenticity check. An explicit fail (not just "unknown/none") on
  // either signal is treated as a stronger reason to hold for review than a
  // low-confidence category guess -- it overrides an otherwise-confirmed
  // status.
  const { spfPass, dkimPass } = parseAuthResults(authResults);
  const authFailed = spfPass === false || dkimPass === false;
  if (authFailed && status === "confirmed") {
    status = "flagged";
    flaggedReason =
      "This alert's sender failed authentication (SPF/DKIM) -- could be spoofed. Verify before confirming.";
  }

  // Governance: large debits wait for a second approver, regardless of how
  // confident the categorization was. No human categorized this one, so
  // there's no "same person" conflict at approval time -- confirmed_by stays
  // null, and any owner/admin can approve it.
  const { data: org } = await supabase
    .from("organizations")
    .select("approval_threshold")
    .eq("id", organizationId)
    .single();

  if (status === "confirmed" && needsApproval(org?.approval_threshold ?? null, extracted.type, extracted.amount)) {
    status = "pending_approval";
    flaggedReason = "Above this organization's approval threshold -- awaiting a second confirmation.";
  }

  // Budget prior-total, computed BEFORE inserting this transaction --
  // querying after insert and trying to exclude "this one" by matching on
  // amount would wrongly exclude other unrelated transactions that happen to
  // share the same amount (common with recurring fixed charges).
  let budgetPriorTotal: number | null = null;
  let budgetLimit: number | null = null;
  if (status === "confirmed" && extracted.type === "debit" && categoryId) {
    const { data: budget } = await supabase
      .from("budgets")
      .select("monthly_limit")
      .eq("organization_id", organizationId)
      .eq("category_id", categoryId)
      .maybeSingle();

    if (budget) {
      budgetLimit = Number(budget.monthly_limit);
      const monthStart = extracted.date.slice(0, 7) + "-01";
      const { data: monthDebits } = await supabase
        .from("transactions")
        .select("amount")
        .eq("organization_id", organizationId)
        .eq("category_id", categoryId)
        .eq("type", "debit")
        .eq("status", "confirmed")
        .gte("txn_date", monthStart);

      budgetPriorTotal = (monthDebits ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
    }
  }

  // 5. Insert the transaction.
  const { data: inserted, error: insertError } = await supabase
    .from("transactions")
    .insert({
      organization_id: organizationId,
      txn_date: extracted.date,
      txn_time: extracted.time,
      type: extracted.type,
      category_id: status === "confirmed" ? categoryId : status === "pending_approval" ? categoryId : null,
      description: extracted.description,
      amount: extracted.amount,
      balance_after: extracted.balance_after,
      status,
      flagged_reason: flaggedReason,
      source_message_id: messageId,
      raw_source_text: rawText,
      sender_spf_pass: spfPass,
      sender_dkim_pass: dkimPass,
    })
    .select("id")
    .single();

  if (insertError) {
    // Unique violation on (organization_id, source_message_id) means a race with
    // another ingestion call for the same message -- treat as a safe no-op.
    if (insertError.code === "23505") {
      return NextResponse.json({ status: "duplicate_skipped" });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 6. Log the message id so future polls skip it.
  await supabase.from("ingestion_log").insert({
    organization_id: organizationId,
    source_message_id: messageId,
    raw_snippet: rawText.slice(0, 500),
  });

  await appendAuditEvent({
    organizationId,
    transactionId: inserted.id,
    eventType: "ingested",
    eventData: {
      status,
      type: extracted.type,
      amount: extracted.amount,
      categoryId,
      spfPass,
      dkimPass,
    },
  });

  // 7. Budget-breach check -- only fires the moment THIS transaction is what
  // pushes the category over, not on every transaction after it's already over.
  if (budgetLimit !== null && budgetPriorTotal !== null) {
    const newTotal = budgetPriorTotal + extracted.amount;
    if (budgetPriorTotal <= budgetLimit && newTotal > budgetLimit) {
      const { data: category } = await supabase
        .from("categories")
        .select("name")
        .eq("id", categoryId as string)
        .single();

      await notifyOrgAdmins({
        organizationId,
        type: "budget_breach",
        subject: `Budget exceeded: ${category?.name ?? "a category"}`,
        body: `${category?.name ?? "This category"} has now spent ${newTotal} this month, over its ${budgetLimit} budget.`,
      });
    }
  }

  return NextResponse.json({ status: "ingested", transaction_id: inserted.id, txn_status: status });
});
