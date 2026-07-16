import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withErrorLogging } from "@/lib/errorLog";

// Owner/admin only -- generates or revokes a public_share_links row. The
// token itself is generated here (not left to the client) so it's always a
// real cryptographically random value, not something a browser could be
// tricked into supplying.
async function requireOwnerOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", status: 401 as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
    return { error: "Only owners or admins can manage transparency links.", status: 403 as const };
  }

  return { supabase, profile };
}

export const POST = withErrorLogging("api:/api/share-links:POST", async (request: Request) => {
  const auth = await requireOwnerOrAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabase, profile } = auth;

  const { scope, scopeRefId } = await request.json();
  if (scope !== "category_summary") {
    return NextResponse.json({ error: "Invalid scope." }, { status: 400 });
  }

  const token = randomBytes(24).toString("base64url");

  const { data, error } = await supabase
    .from("public_share_links")
    .insert({
      organization_id: profile.organization_id,
      scope,
      scope_ref_id: scopeRefId ?? null,
      token,
      created_by: profile.id,
    })
    .select("id, scope, scope_ref_id, token, expires_at, revoked_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data });
});

export const PATCH = withErrorLogging("api:/api/share-links:PATCH", async (request: Request) => {
  const auth = await requireOwnerOrAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabase } = auth;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing link id." }, { status: 400 });

  const { error } = await supabase
    .from("public_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
