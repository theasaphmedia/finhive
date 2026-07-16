import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Append-only, hash-chained audit trail -- one chain per organization. Every
// call fetches the org's latest hash, folds it into this event's own hash,
// and inserts a new row. If anything upstream of a given row were ever
// silently edited or deleted, every hash after it would stop matching what a
// verifier recomputes -- that's the actual tamper-evidence, not just a log.
//
// Deliberately always uses the service-role client: this needs to run
// regardless of which RLS-scoped role triggered the event (ingestion has no
// user at all; a stakeholder confirming a flag isn't allowed to write here
// directly under RLS, on purpose -- nothing but this helper ever writes to
// audit_events).
export async function appendAuditEvent(params: {
  organizationId: string;
  transactionId?: string | null;
  eventType: string;
  eventData?: Record<string, unknown>;
  actorProfileId?: string | null;
}) {
  const admin = createAdminClient();

  const { data: last } = await admin
    .from("audit_events")
    .select("hash")
    .eq("organization_id", params.organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevHash = last?.hash ?? null;
  const createdAt = new Date().toISOString();
  const eventData = params.eventData ?? {};

  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        prevHash,
        organizationId: params.organizationId,
        transactionId: params.transactionId ?? null,
        eventType: params.eventType,
        eventData,
        actorProfileId: params.actorProfileId ?? null,
        createdAt,
      })
    )
    .digest("hex");

  await admin.from("audit_events").insert({
    organization_id: params.organizationId,
    transaction_id: params.transactionId ?? null,
    event_type: params.eventType,
    event_data: eventData,
    actor_profile_id: params.actorProfileId ?? null,
    prev_hash: prevHash,
    hash,
    created_at: createdAt,
  });
}
