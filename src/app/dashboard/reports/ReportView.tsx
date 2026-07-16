"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PERIOD_LABELS, type PeriodId } from "@/lib/reportPeriods";
import { lineDelay } from "@/lib/lineDelay";

interface Row {
  name: string;
  type: string;
  total_spent: number;
  total_received: number;
  txn_count: number;
}

export default function ReportView({
  period,
  from,
  to,
  rows,
  totalSpent,
  totalReceived,
  currency,
  organizationName,
  primaryColor,
  openingBalance,
  closingBalance,
  closingAsOfDate,
}: {
  period: PeriodId;
  from: string;
  to: string;
  rows: Row[];
  totalSpent: number;
  totalReceived: number;
  currency: string;
  organizationName: string;
  primaryColor: string;
  openingBalance: number | null;
  closingBalance: number | null;
  closingAsOfDate: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setPeriod(p: PeriodId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    router.push(`${pathname}?${params.toString()}`);
  }

  function setCustomRange(newFrom: string, newTo: string) {
    const params = new URLSearchParams();
    params.set("period", "custom");
    params.set("from", newFrom);
    params.set("to", newTo);
    router.push(`${pathname}?${params.toString()}`);
  }

  function exportCsv() {
    const header = "Category,Type,Total Spent,Total Received,Transaction Count\n";
    const body = rows
      .map((r) => `"${r.name}",${r.type},${r.total_spent},${r.total_received},${r.txn_count}`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${organizationName}-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-base font-semibold text-zinc-800">Reports</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {from} to {to}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="btn-secondary">
            Export CSV
          </button>
          <button onClick={() => window.print()} className="btn-secondary">
            Export PDF
          </button>
        </div>
      </div>

      <div className="card card-flat mt-4 flex flex-wrap gap-6 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Opening balance</p>
          <p className="mt-1 text-lg font-semibold text-zinc-800">
            {openingBalance != null ? `${currency} ${openingBalance.toLocaleString()}` : "No prior balance captured"}
          </p>
          <p className="text-xs text-zinc-400">as of just before {from}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Closing balance</p>
          <p className="mt-1 text-lg font-semibold" style={{ color: primaryColor }}>
            {closingBalance != null ? `${currency} ${closingBalance.toLocaleString()}` : "No balance captured yet"}
          </p>
          <p className="text-xs text-zinc-400">
            {closingAsOfDate ? `as of ${closingAsOfDate}` : `as of ${to}`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        {(Object.keys(PERIOD_LABELS) as PeriodId[])
          .filter((p) => p !== "custom")
          .map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                period === p ? "text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
              style={period === p ? { backgroundColor: primaryColor } : undefined}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        <CustomRangePicker active={period === "custom"} from={from} to={to} onApply={setCustomRange} primaryColor={primaryColor} />
      </div>

      <div className="mt-6 hidden print:block">
        <h1 className="text-xl font-semibold">{organizationName} -- Report</h1>
        <p className="text-sm text-zinc-500">
          {PERIOD_LABELS[period]} &middot; {from} to {to}
        </p>
      </div>

      <div className="card card-flat mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2 text-right">Spent</th>
              <th className="px-4 py-2 text-right">Received</th>
              <th className="px-4 py-2 text-right">Txns</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.name}
                className="line-in row-hover group border-b border-zinc-100 last:border-0"
                style={{ animationDelay: lineDelay(i) }}
              >
                <td className="px-4 py-2 text-zinc-800 transition-colors duration-150 group-hover:text-violet-600">{r.name}</td>
                <td className="px-4 py-2 text-zinc-500 transition-colors duration-150 group-hover:text-emerald-600">{r.type}</td>
                <td className="px-4 py-2 text-right text-zinc-800">
                  {r.total_spent > 0 ? `${currency} ${r.total_spent.toLocaleString()}` : "--"}
                </td>
                <td className="px-4 py-2 text-right text-zinc-800">
                  {r.total_received > 0 ? `${currency} ${r.total_received.toLocaleString()}` : "--"}
                </td>
                <td className="px-4 py-2 text-right text-zinc-500">{r.txn_count}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  No transactions in this period.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50 font-medium text-zinc-800">
              <td className="px-4 py-2" colSpan={2}>
                Total
              </td>
              <td className="px-4 py-2 text-right">
                {currency} {totalSpent.toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right">
                {currency} {totalReceived.toLocaleString()}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function CustomRangePicker({
  active,
  from,
  to,
  onApply,
  primaryColor,
}: {
  active: boolean;
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  primaryColor: string;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors duration-150 ${
        active ? "text-white" : "bg-zinc-100 text-zinc-600"
      }`}
      style={active ? { backgroundColor: primaryColor } : undefined}
    >
      <input
        type="date"
        defaultValue={from}
        onChange={(e) => onApply(e.target.value, to)}
        className="bg-transparent text-xs"
      />
      <span>to</span>
      <input
        type="date"
        defaultValue={to}
        onChange={(e) => onApply(from, e.target.value)}
        className="bg-transparent text-xs"
      />
    </div>
  );
}
