import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireViewerContext, canManageOrg } from "@/lib/getViewerContext";
import SettingsManager from "./SettingsManager";

export default async function SettingsPage() {
  const { profile, organization } = await requireViewerContext();
  if (!canManageOrg(profile)) redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: tokenRow }, { data: orgRow }] = await Promise.all([
    supabase.from("ingestion_tokens").select("token").eq("organization_id", organization.id).maybeSingle(),
    supabase
      .from("organizations")
      .select("approval_threshold, data_retention_months")
      .eq("id", organization.id)
      .single(),
  ]);

  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const appUrl = host ? `${protocol}://${host}` : "";

  return (
    <SettingsManager
      organizationId={organization.id}
      organizationName={organization.name}
      currency={organization.currency}
      initialPrimary={organization.brand_primary_color}
      initialAccent={organization.brand_accent_color}
      initialToken={tokenRow?.token ?? null}
      initialApprovalThreshold={orgRow?.approval_threshold ?? null}
      initialRetentionMonths={orgRow?.data_retention_months ?? null}
      isOwner={profile.role === "owner"}
      appUrl={appUrl}
    />
  );
}
