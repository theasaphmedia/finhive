import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/siteUrl";
import { withErrorLogging } from "@/lib/errorLog";

// Why this route exists (and why the invite email couldn't just be sent
// client-side with supabase.auth.signInWithOtp, which is what this replaced):
//
// The browser Supabase client (@supabase/ssr) uses the PKCE auth flow by
// default. When an ADMIN calls signInWithOtp for someone ELSE's email from
// their own logged-in browser, the PKCE code_verifier gets stored in the
// ADMIN's browser storage -- not the invitee's. When the invitee clicks the
// link on their own device, there's no matching verifier anywhere for them,
// so /auth/callback's exchangeCodeForSession silently fails: Supabase marks
// the email "confirmed" (the token itself was valid) but no session is ever
// created for the invitee. That was the real cause behind invites that
// looked "sent" but never let the recipient in.
//
// The fix is to issue the invite server-side with the service-role admin
// API instead, which doesn't depend on any browser-stored PKCE state at all
// -- it works correctly regardless of which device/browser the admin sent
// from or the recipient opens it on.
export const POST = withErrorLogging("api:/api/invite", async (request: Request) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Only owners or admins can send invites." }, { status: 403 });
  }

  const { email, organizationName, role } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const inviteOptions = {
    redirectTo: `${getSiteUrl()}/auth/callback`,
    data: { organization_name: organizationName ?? null, invited_role: role ?? null },
  };

  let { error } = await admin.auth.admin.inviteUserByEmail(email, inviteOptions);

  if (error && /already been registered|already exists/i.test(error.message)) {
    // A leftover unconfirmed auth user from an earlier broken attempt (e.g.
    // the browser-side PKCE bug above) with no linked profile row -- safe to
    // clear and re-invite fresh rather than leaving the admin stuck.
    const { data: list } = await admin.auth.admin.listUsers();
    const stale = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (stale) {
      await admin.auth.admin.deleteUser(stale.id);
      ({ error } = await admin.auth.admin.inviteUserByEmail(email, inviteOptions));
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
