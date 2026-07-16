import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendAuditEvent } from "@/lib/auditLog";
import { withErrorLogging } from "@/lib/errorLog";

interface RawBreakdownItem {
  label?: unknown;
  amount?: unknown;
  linkedTransactionId?: unknown;
}

interface BreakdownItem {
  label: string;
  amount: number;
  linkedTransactionId?: string;
}

// Lets any full-access viewer (owner, admin, or a stakeholder with full
// access -- not just those trusted to categorize) attach an explanation to a
// transaction. This is the actual point of the transparency promise: a
// transfer to another one of the org's own accounts looks identical to an
// outside payment in the raw bank alert, so someone needs to be able to say
// "this was for X" right on the record, for anyone looking back later.
// Broader permission than recategorize on purpose -- explaining a
// transaction is lower-stakes than changing its categorization.
//
// The explanation can be plain notes, a reconciling breakdown (line items
// that should add up to the transaction amount, like real bookkeeping), or
// both. A breakdown line can either be manual (free-text label + amount, for
// money that left the tracked ledger entirely) or linked to another real
// transaction already in the ledger -- for linked lines, the label and
// amount are ALWAYS re-derived here from the actual linked transaction, never
// trusted from the client, so a reconciliation can't be spoofed by claiming
// a bigger or smaller amount than what really happened.
async function sanitizeBreakdown(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  input: unknown
): Promise<BreakdownItem[] | null> {
  if (!Array.isArray(input)) return null;
  const raw = input as RawBreakdownItem[];

  const linkedIds = Array.from(
    new Set(
      raw
        .map((r) => (typeof r.linkedTransactionId === "string" ? r.linkedTransactionId : null))
        .filter((v): v is string => !!v)
    )
  );

  const linkedById = new Map<string, { description: string; amount: number; txn_date: string }>();
  if (linkedIds.length > 0) {
    const { data: linkedTxns } = await admin
      .from("transactions")
      .select("id, description, amount, txn_date, organization_id")
      .in("id", linkedIds);
    for (const t of linkedTxns ?? []) {
      if (t.organization_id === organizationId) {
        linkedById.set(t.id, { description: t.description, amount: Number(t.amount), txn_date: t.txn_date });
      }
    }
  }

  const items: BreakdownItem[] = [];
  for (const r of raw) {
    if (typeof r.linkedTransactionId === "string") {
      const linked = linkedById.get(r.linkedTransactionId);
      if (!linked) continue; // dropped -- didn't belong to this org, or no longer exists
      items.push({
        label: `${linked.txn_date} · ${linked.description}`,
        amount: linked.amount,
        linkedTransactionId: r.linkedTransactionId,
      });
      continue;
    }

    const label = typeof r.label === "string" ? r.label.trim() : "";
    const amount = typeof r.amount === "number" ? r.amount : Number(r.amount);
    if (label.length === 0 || !Number.isFinite(amount) || amount < 0) continue;
    items.push({ label, amount });
  }

  return items.length > 0 ? items : null;
}

export const POST = withErrorLogging("api:/api/transactions/note", async (request: Request) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, role, access_level")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "No profile found." }, { status: 403 });

  const isFullAccess =
    profile.role === "owner" ||
    profile.role === "admin" ||
    (profile.role === "stakeholder" && profile.access_level === "full");

  if (!isFullAccess) {
    return NextResponse.json({ error: "You don't have permission to add notes to transactions." }, { status: 403 });
  }

  const { transactionId, notes, breakdown } = await request.json();
  if (!transactionId) {
    return NextResponse.json({ error: "transactionId is required." }, { status: 400 });
  }

  const trimmedNotes = typeof notes === "string" ? notes.trim() : "";

  const admin = createAdminClient();

  const { data: txn } = await admin
    .from("transactions")
    .select("id, organization_id")
    .eq("id", transactionId)
    .single();

  if (!txn || txn.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  const cleanBreakdown = await sanitizeBreakdown(admin, profile.organization_id, breakdown);

  const { error: updateError } = await admin
    .from("transactions")
    .update({
      notes: trimmedNotes.length > 0 ? trimmedNotes : null,
      note_breakdown: cleanBreakdown,
      notes_updated_by: profile.id,
      notes_updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const breakdownTotal = (cleanBreakdown ?? []).reduce((sum, item) => sum + item.amount, 0);

  await appendAuditEvent({
    organizationId: profile.organization_id,
    transactionId,
    eventType: "note_updated",
    eventData: { hasNote: trimmedNotes.length > 0, breakdownLines: cleanBreakdown?.length ?? 0, breakdownTotal },
    actorProfileId: profile.id,
  });

  return NextResponse.json({
    ok: true,
    notes: trimmedNotes.length > 0 ? trimmedNotes : null,
    breakdown: cleanBreakdown,
  });
});
