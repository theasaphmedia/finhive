"use client";

interface ClientRow {
  id: string;
  client_name: string;
  purpose: string | null;
  amount_paid: number;
  total_fee_agreed: number;
  status: string;
  created_at: string;
}

export default function StatementView({
  client,
  organizationName,
  currency,
  primaryColor,
  accentColor,
  generatedAt,
}: {
  client: ClientRow;
  organizationName: string;
  currency: string;
  primaryColor: string;
  accentColor: string;
  generatedAt: string;
}) {
  const balance = client.total_fee_agreed - client.amount_paid;
  const paidInFull = client.status === "paid_in_full";

  const formatMoney = (n: number) =>
    `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="fade-in mx-auto max-w-2xl">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-base font-semibold text-zinc-800">Statement of account</h2>
          <p className="mt-1 text-sm text-zinc-500">A shareable summary for {client.client_name}.</p>
        </div>
        <button onClick={() => window.print()} className="btn-primary">
          Print / Save as PDF
        </button>
      </div>

      <div className="card mt-6 overflow-hidden print:border-0 print:shadow-none">
        <div className="px-8 py-6 text-white" style={{ backgroundColor: primaryColor }}>
          <p className="text-xs uppercase tracking-wide opacity-80">Statement of Account</p>
          <h1 className="mt-1 text-xl font-semibold">{organizationName}</h1>
        </div>

        <div className="flex items-center justify-between border-b border-zinc-100 px-8 py-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Prepared for</p>
            <p className="mt-1 text-lg font-semibold text-zinc-800">{client.client_name}</p>
            {client.purpose && <p className="text-sm text-zinc-500">{client.purpose}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Generated</p>
            <p className="mt-1 text-sm text-zinc-600">{formatDate(generatedAt)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 px-8 py-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Total agreed</p>
            <p className="mt-1 text-lg font-semibold text-zinc-800">{formatMoney(client.total_fee_agreed)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Paid to date</p>
            <p className="mt-1 text-lg font-semibold" style={{ color: accentColor }}>
              {formatMoney(client.amount_paid)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Balance due</p>
            <p className="mt-1 text-lg font-semibold text-zinc-800">{formatMoney(Math.max(balance, 0))}</p>
          </div>
        </div>

        <div className="px-8 pb-8">
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={
              paidInFull
                ? { backgroundColor: `${accentColor}1A`, color: accentColor }
                : { backgroundColor: "#FEF3C7", color: "#B45309" }
            }
          >
            {paidInFull ? "Paid in full" : `Balance due -- ${formatMoney(balance)} outstanding`}
          </span>
        </div>

        <div className="border-t border-zinc-100 px-8 py-4 text-center text-xs text-zinc-500">
          Issued by {organizationName} via FinHive &middot; {formatDate(generatedAt)}
        </div>
      </div>
    </div>
  );
}
