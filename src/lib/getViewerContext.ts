import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface ViewerContext {
  userId: string;
  profile: {
    id: string;
    name: string;
    email: string;
    role: "owner" | "admin" | "stakeholder" | "client";
    access_level: "full" | "summary" | null;
    can_confirm_flags: boolean;
    organization_id: string;
    linked_client_id: string | null;
  };
  organization: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    brand_primary_color: string;
    brand_accent_color: string;
  };
}

// Shared server-side guard for every /dashboard/* page: requires an
// authenticated user with a profile (redirects to /login or /signup
// otherwise) and returns their profile + organization in one call.
//
// Wrapped in React's `cache()` so that within a single request (layout.tsx
// AND whichever page.tsx is rendering underneath it both call this) it only
// actually hits the database once instead of twice -- this was previously
// the biggest single cause of "clicking a tab takes a while": every nav did
// requireViewerContext() in the layout, then requireViewerContext() again in
// the page, each doing its own round trips with no memoization between them.
//
// Also collapsed profile + organization into a single embedded-resource
// query (Postgrest can follow the FK and return both in one round trip)
// instead of two sequential awaits.
export const requireViewerContext = cache(async (): Promise<ViewerContext> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, name, email, role, access_level, can_confirm_flags, organization_id, linked_client_id, deactivated_at, organizations(id, name, currency, timezone, brand_primary_color, brand_accent_color)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/signup");

  // A self-deactivated (or admin-deactivated) account keeps its profiles row
  // -- and everything it references (confirmed transactions, audit_events,
  // etc.) -- for audit-trail integrity, but must not be able to keep using
  // the app. This is the single choke point every /dashboard/* page already
  // goes through, so it's also the right place to end the session.
  if (profile.deactivated_at) {
    await supabase.auth.signOut();
    redirect("/login?deactivated=1");
  }

  const organization = Array.isArray(profile.organizations)
    ? profile.organizations[0]
    : profile.organizations;

  if (!organization) redirect("/signup");

  const { organizations: _organizations, deactivated_at: _deactivatedAt, ...profileFields } = profile;

  return {
    userId: user.id,
    profile: profileFields as ViewerContext["profile"],
    organization: {
      id: organization.id,
      name: organization.name,
      currency: organization.currency,
      timezone: organization.timezone,
      brand_primary_color: organization.brand_primary_color ?? "#0F2A3D",
      brand_accent_color: organization.brand_accent_color ?? "#1E9E6B",
    },
  };
});

export function isFullAccess(profile: ViewerContext["profile"]): boolean {
  return (
    profile.role === "owner" ||
    profile.role === "admin" ||
    (profile.role === "stakeholder" && profile.access_level === "full")
  );
}

export function canManageOrg(profile: ViewerContext["profile"]): boolean {
  return profile.role === "owner" || profile.role === "admin";
}
