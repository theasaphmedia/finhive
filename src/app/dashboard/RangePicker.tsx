"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export interface RangeOption {
  id: string;
  label: string;
}

export const DEFAULT_RANGES: RangeOption[] = [
  { id: "1w", label: "1 Week" },
  { id: "1m", label: "1 Month" },
  { id: "3m", label: "3 Months" },
  { id: "6m", label: "6 Months" },
  { id: "1y", label: "1 Year" },
];

// Reusable pill-style range selector -- pushes ?range=<id> onto the current
// URL so the enclosing server component re-fetches with the new window.
// Used on Overview's cash-flow chart, and can replace the same pattern
// hand-rolled elsewhere (Transactions) over time.
export default function RangePicker({
  range,
  options = DEFAULT_RANGES,
  activeColor = "var(--org-primary, #0F2A3D)",
}: {
  range: string;
  options?: RangeOption[];
  activeColor?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setRange(r: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", r);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((r) => (
        <button
          key={r.id}
          onClick={() => setRange(r.id)}
          className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150"
          style={
            range === r.id
              ? { backgroundColor: activeColor, color: "white" }
              : { backgroundColor: "rgb(244 244 245)", color: "#52525b" }
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
