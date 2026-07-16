"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavProps {
  canManageOrg: boolean;
  isFullAccess: boolean;
  canConfirmFlags: boolean;
}

const ICONS: Record<string, React.ReactNode> = {
  Overview: (
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
  ),
  Transactions: (
    <path d="M7 7h11l-2.5-2.5M17 15H6l2.5 2.5M4 7h1M19 15h1" />
  ),
  Flagged: <path d="M6 3v18M6 4h11l-2.5 3.5L17 11H6" />,
  Reports: <path d="M5 20V10M11 20V4M17 20v-7" />,
  Clients: (
    <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 8a2.5 2.5 0 1 0 0-5M15.5 20c.3-2.8 1.7-4.8 3.7-5.6" />
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
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

export default function DashboardNav({ canManageOrg, isFullAccess, canConfirmFlags }: NavProps) {
  const pathname = usePathname();

  const links: { href: string; label: string }[] = [{ href: "/dashboard", label: "Overview" }];

  if (isFullAccess) {
    links.push({ href: "/dashboard/transactions", label: "Transactions" });
  }
  if (isFullAccess || canConfirmFlags) {
    links.push({ href: "/dashboard/flagged", label: "Flagged" });
  }
  links.push({ href: "/dashboard/reports", label: "Reports" });
  links.push({ href: "/dashboard/clients", label: "Clients" });

  if (canManageOrg) {
    links.push({ href: "/dashboard/categories", label: "Categories" });
    links.push({ href: "/dashboard/people", label: "People" });
    links.push({ href: "/dashboard/settings", label: "Settings" });
  }

  return (
    <nav
      className="border-b border-white/40 backdrop-blur-md print:hidden"
      style={{ backgroundColor: "rgb(255 255 255 / 0.6)" }}
    >
      <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 py-2.5 sm:px-8">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-150"
              style={{
                backgroundColor: active ? "var(--org-primary, #0F2A3D)" : "transparent",
                color: active ? "white" : undefined,
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = "rgb(0 0 0 / 0.05)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <span className={active ? "" : "text-zinc-500"}>
                <Icon name={link.label} />
              </span>
              <span className={active ? "" : "text-zinc-600"}>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
