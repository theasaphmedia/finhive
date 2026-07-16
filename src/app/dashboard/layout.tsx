import Link from "next/link";
import { requireViewerContext, canManageOrg, isFullAccess } from "@/lib/getViewerContext";
import SignOutButton from "./SignOutButton";
import Sidebar from "./Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, organization } = await requireViewerContext();
  const primary = organization.brand_primary_color;
  const accent = organization.brand_accent_color;
  const cssVars = { "--org-primary": primary, "--org-accent": accent } as React.CSSProperties;

  // Client-role viewers only ever see their own statement -- a full nav
  // sidebar has nothing for them to navigate to, so they get a minimal top
  // bar instead of the sidebar shell everyone else uses.
  if (profile.role === "client") {
    return (
      <div className="dashboard-shell" style={cssVars}>
        <header className="text-white shadow-md print:hidden" style={{ backgroundColor: primary }}>
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 sm:px-10">
            <div>
              <h1 className="text-lg font-semibold">{organization.name}</h1>
              <p className="text-xs opacity-80">
                {organization.currency} &middot; {organization.timezone}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/dashboard/account" className="text-sm opacity-90 hover:underline">
                {profile.name}
              </Link>
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="fade-in mx-auto w-full max-w-[1440px] px-6 py-10 sm:px-10">{children}</main>
      </div>
    );
  }

  return (
    <div className="dashboard-shell flex" style={cssVars}>
      <Sidebar
        organizationName={organization.name}
        currency={organization.currency}
        timezone={organization.timezone}
        primaryColor={primary}
        profileName={profile.name}
        profileRole={profile.role}
        profileAccessLevel={profile.access_level}
        canManageOrg={canManageOrg(profile)}
        isFullAccess={isFullAccess(profile)}
        canConfirmFlags={profile.can_confirm_flags}
      />
      <main className="fade-in min-w-0 flex-1 px-8 py-9 sm:px-12">{children}</main>
    </div>
  );
}
