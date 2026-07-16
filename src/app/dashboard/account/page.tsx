import { requireViewerContext } from "@/lib/getViewerContext";
import AccountManager from "./AccountManager";

// Unlike /dashboard/settings, this page is NOT gated by canManageOrg --
// export/delete are rights every person has about their own data
// (owner, admin, stakeholder, or client), not an org-management function.
export default async function AccountPage() {
  const { profile } = await requireViewerContext();

  return (
    <AccountManager
      name={profile.name}
      email={profile.email}
      role={profile.role}
      accessLevel={profile.access_level}
    />
  );
}
