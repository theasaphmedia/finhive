import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewerContext, canManageOrg } from "@/lib/getViewerContext";
import PeopleManager from "./PeopleManager";

export default async function PeoplePage() {
  const { profile, organization } = await requireViewerContext();
  if (!canManageOrg(profile)) redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: people }, { data: pendingInvites }, { data: clients }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, email, role, access_level, can_confirm_flags, deactivated_at")
      .eq("organization_id", organization.id)
      .order("created_at"),
    supabase
      .from("invites")
      .select("id, name, email, role, access_level, can_confirm_flags, created_at")
      .eq("organization_id", organization.id)
      .is("accepted_at", null)
      .order("created_at"),
    supabase
      .from("clients")
      .select("id, client_name")
      .eq("organization_id", organization.id)
      .order("client_name"),
  ]);

  return (
    <PeopleManager
      organizationId={organization.id}
      organizationName={organization.name}
      currentProfileId={profile.id}
      isOwner={profile.role === "owner"}
      initialPeople={people ?? []}
      initialInvites={pendingInvites ?? []}
      clients={clients ?? []}
    />
  );
}
