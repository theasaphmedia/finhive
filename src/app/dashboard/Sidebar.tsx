"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import SignOutButton from "./SignOutButton";

interface SidebarProps {
  organizationName: string;
  currency: string;
  timezone: string;
  primaryColor: string;
  profileName: string;
  profileRole: string;
  profileAccessLevel: string | null;
  canManageOrg: boolean;
  isFullAccess: boolean;
  canConfirmFlags: boolean;
}

const ICONS: Record<string, React.ReactNode> = {
  Overview: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  Transactions: <path d="M7 7h11l-2.5-2.5M17 15H6l2.5 2.5M4 7h1M19 15h1" />,
  Flagged: <path d="M6 3v18M6 4h11l-2.5 3.5L17 11H6" />,
  Reports: <path d="M5 20V10M11 20V4M17 20v-7" />,
  Clients: (
    <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 8a2.5 2.5 0 1 0 0-5M15.5 20c.3-2.8 1.7-4.8 3.7-5.6" />
  ),
  Savings: (
    <path d="M12 3a9 9 0 1 0 9 9M12 3v9l6.5 3.7M12 3a9 9 0 0 1 9 9h-9Z" />
  ),
  Approvals: (
    <path d="m5 13 4 4L19 7" />
  ),
  Categories: (
    <path d="m4 12 7.6-7.6a1 1 0 0 1 .7-.3H19a1 1 0 0 1 1 1v6.7a1 1 0 0 1-.3.7L12 20zM14 9h.01" />
  ),
  People: (
    <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M16 7a2.5 2.5 0 1 1 0 5M14.5 20c.3-2.6 1.5-4.6 3.3-5.4" />
  ),
  Settings: (
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 12a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h5l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" />
  ),
  Errors: (
    <path d="M12 9v4M12 16.5h.01M10.3 3.9 2.4 18a1.7 1.7 0 0 0 1.5 2.5h16.2a1.7 1.7 0 0 0 1.5-2.5L13.7 3.9a1.7 1.7 0 0 0-3.4 0Z" />
  ),
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

const CHEVRON = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export default function Sidebar({
  organizationName,
  currency,
  timezone,
  primaryColor,
  profileName,
  profileRole,
  profileAccessLevel,
  canManageOrg,
  isFullAccess,
  canConfirmFlags,
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("finhive-sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
    setMounted(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      window.localStorage.setItem("finhive-sidebar-collapsed", c ? "0" : "1");
      return !c;
    });
  }

  const links: { href: string; label: string }[] = [{ href: "/dashboard", label: "Overview" }];
  if (isFullAccess) links.push({ href: "/dashboard/transactions", label: "Transactions" });
  if (isFullAccess || canConfirmFlags) links.push({ href: "/dashboard/flagged", label: "Flagged" });
  links.push({ href: "/dashboard/reports", label: "Reports" });
  links.push({ href: "/dashboard/clients", label: "Clients" });
  links.push({ href: "/dashboard/savings", label: "Savings" });
  if (canManageOrg) {
    links.push({ href: "/dashboard/approvals", label: "Approvals" });
    links.push({ href: "/dashboard/categories", label: "Categories" });
    links.push({ href: "/dashboard/people", label: "People" });
    links.push({ href: "/dashboard/settings", label: "Settings" });
    links.push({ href: "/dashboard/errors", label: "Errors" });
  }

  const initials = profileName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const accountActive = pathname === "/dashboard/account";

  return (
    <aside
      className={`flex shrink-0 flex-col text-white shadow-xl transition-[width] duration-200 print:hidden ${
        collapsed ? "w-[76px]" : "w-[248px]"
      } ${mounted ? "" : "duration-0"}`}
      style={{ backgroundColor: primaryColor }}
    >
      <div className="flex items-center justify-between px-5 pt-6 pb-5">
        {!collapsed && (
          <div className="min-w-0 fade-in">
            <p className="truncate text-[15px] font-semibold tracking-tight">{organizationName}</p>
            <p className="mt-0.5 truncate text-[11px] uppercase tracking-wider text-white/70">
              {currency} &middot; {timezone}
            </p>
          </div>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          style={collapsed ? { transform: "rotate(180deg)", marginInline: "auto" } : undefined}
        >
          {CHEVRON}
        </button>
      </div>

      <div className="mx-5 h-px bg-white/10" />

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              className="group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors duration-150"
              style={{ backgroundColor: active ? "rgb(255 255 255 / 0.12)" : "transparent" }}
            >
              <span
                className="absolute inset-y-1 left-0 w-[3px] rounded-full transition-opacity duration-150"
                style={{ backgroundColor: "var(--org-accent)", opacity: active ? 1 : 0 }}
              />
              <span className={active ? "text-white" : "text-white/75 group-hover:text-white/95"}>
                <Icon name={link.label} />
              </span>
              {!collapsed && (
                <span className={active ? "text-white" : "text-white/85 group-hover:text-white/95"}>{link.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mx-5 h-px bg-white/10" />

      <div className="flex items-center gap-2.5 px-4 py-4">
        <Link
          href="/dashboard/account"
          title="My account"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold transition hover:bg-white/20"
          style={accountActive ? { boxShadow: "0 0 0 2px var(--org-accent)" } : undefined}
        >
          {initials}
        </Link>
        {!collapsed && (
          <div className="min-w-0 flex-1 fade-in">
            <Link href="/dashboard/account" className="block truncate text-[12.5px] font-medium hover:underline">
              {profileName}
            </Link>
            <p className="truncate text-[11px] text-white/70">
              {profileRole}
              {profileRole === "stakeholder" && profileAccessLevel ? ` · ${profileAccessLevel}` : ""}
            </p>
          </div>
        )}
        {!collapsed && <SignOutButton />}
      </div>
    </aside>
  );
}
