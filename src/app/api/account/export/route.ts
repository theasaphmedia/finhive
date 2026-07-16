import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendAuditEvent } from "@/lib/auditLog";
import { withErrorLogging } from "@/lib/errorLog";

// Self-service "export my data" -- NDPA_COMPLIANCE_CHECKLIST.md Section 3/4.
// Deliberately scoped to the caller's OWN personal data, not the org's whole
// ledger: a staff member already sees the org's transactions through the app
// itself (CSV/PDF export on Reports covers that), so re-bundling the entire
// ledger under "your data" would be data-minimization overreach for what
// this endpoint is actually for -- proving what FinHive holds about *you*.
export const POST = withErrorLogging("api:/api/account/export", async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, name, email, role, access_level, can_confirm_flags, organization_id, linked_client_id, created_at, organizations(name)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "No profile found." }, { status: 403 });

  const organization = Array.isArray(profile.organizations) ? profile.organizations[0] : profile.organizations;

  let clientRecord = null;
  if (profile.role === "client" && profile.linked_client_id) {
    const { data: client } = await admin
      .from("clients")
      .select("id, client_name, purpose, amount_paid, total_fee_agreed, status, created_at")
      .eq("id", profile.linked_client_id)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    clientRecord = client ?? null;
  }

  const { data: actionHistory } = await admin
    .from("audit_events")
    .select("event_type, event_data, transaction_id, created_at")
    .eq("organization_id", profile.organization_id)
    .eq("actor_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(500);

  await appendAuditEvent({
    organizationId: profile.organization_id,
    eventType: "data_export_requested",
    actorProfileId: profile.id,
    eventData: { selfService: true },
  });

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    organization: organization?.name ?? null,
    profile: {
      name: profile.name,
      email: profile.email,
      role: profile.role,
      accessLevel: profile.access_level,
      canConfirmFlags: profile.can_confirm_flags,
      memberSince: profile.created_at,
    },
    clientRecord,
    actionHistory: actionHistory ?? [],
  });
});
