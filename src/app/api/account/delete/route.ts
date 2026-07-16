import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendAuditEvent } from "@/lib/auditLog";
import { withErrorLogging } from "@/lib/errorLog";

// Self-service "delete my account" -- NDPA_COMPLIANCE_CHECKLIST.md Section
// 3/4. This deactivates rather than hard-deletes the profiles row:
// transactions.confirmed_by/approved_by/notes_updated_by, audit_events
// (hash-chained on purpose), error_log, invites, and public_share_links all
// reference profiles(id) with ON DELETE NO ACTION, so a real DELETE would
// either fail outright for anyone who's ever confirmed a transaction, or
// (if those constraints were loosened) silently tear a hole in the audit
// trail this app's whole "who confirmed what and when" story depends on.
// Deactivation keeps the historical record intact while fully ending the
// person's own access -- see requireViewerContext.ts for the sign-out gate.
export const POST = withErrorLogging("api:/api/account/delete", async (request: Request) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== true) {
    return NextResponse.json({ error: "Confirmation required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, organization_id, deactivated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "No profile found." }, { status: 403 });
  if (profile.deactivated_at) return NextResponse.json({ ok: true, alreadyDeactivated: true });

  if (profile.role === "owner") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .eq("role", "owner")
      .is("deactivated_at", null)
      .neq("id", profile.id);

    if (!count || count === 0) {
      return NextResponse.json(
        {
          error:
            "You're the only owner of this organization. Promote someone else to owner from People before deactivating your own account.",
        },
        { status: 400 }
      );
    }
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ deactivated_at: new Date().toISOString() })
    .eq("id", profile.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await appendAuditEvent({
    organizationId: profile.organization_id,
    eventType: "account_deactivated",
    actorProfileId: profile.id,
    eventData: { selfService: true },
  });

  return NextResponse.json({ ok: true });
});
