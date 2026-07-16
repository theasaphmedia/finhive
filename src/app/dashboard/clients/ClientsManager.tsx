"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { lineDelay } from "@/lib/lineDelay";

interface ClientRow {
  id: string;
  client_name: string;
  purpose: string | null;
  amount_paid: number;
  total_fee_agreed: number;
  status: string;
  linked_transaction_ids: string[] | null;
}

interface CreditTxn {
  id: string;
  txn_date: string;
  description: string;
  amount: number;
}

export default function ClientsManager({
  organizationId,
  currency,
  canEdit,
  initialClients,
  creditTransactions,
}: {
  organizationId: string;
  currency: string;
  canEdit: boolean;
  initialClients: ClientRow[];
  creditTransactions: CreditTxn[];
}) {
  const supabase = createClient();
  const [clients, setClients] = useState<ClientRow[]>(initialClients);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [totalFee, setTotalFee] = useState("");
  const [amountPaid, setAmountPaid] = useState("");

  async function addClient() {
    if (!clientName.trim() || !totalFee) return;
    setError("");
    const { data, error: err } = await supabase
      .from("clients")
      .insert({
        organization_id: organizationId,
        client_name: clientName.trim(),
        purpose: purpose.trim() || null,
        total_fee_agreed: Number(totalFee),
        amount_paid: Number(amountPaid) || 0,
      })
      .select("id, client_name, purpose, amount_paid, total_fee_agreed, status, linked_transaction_ids")
      .single();

    if (err) return setError(err.message);
    setClients((prev) => [data as ClientRow, ...prev]);
    setClientName("");
    setPurpose("");
    setTotalFee("");
    setAmountPaid("");
    setShowForm(false);
  }

  async function updatePayment(id: string, amountPaid: number) {
    setError("");
    const { error: err } = await supabase.from("clients").update({ amount_paid: amountPaid }).eq("id", id);
    if (err) return setError(err.message);
    setClients((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, amount_paid: amountPaid, status: amountPaid >= c.total_fee_agreed ? "paid_in_full" : "balance_due" }
          : c
      )
    );
  }

  async function setLinkedTransactions(id: string, ids: string[]) {
    setError("");
    const { error: err } = await supabase.from("clients").update({ linked_transaction_ids: ids }).eq("id", id);
    if (err) return setError(err.message);
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, linked_transaction_ids: ids } : c)));
  }

  async function updateTotalFee(id: string, totalFeeAgreed: number) {
    setError("");
    const { error: err } = await supabase.from("clients").update({ total_fee_agreed: totalFeeAgreed }).eq("id", id);
    if (err) return setError(err.message);
    setClients((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, total_fee_agreed: totalFeeAgreed, status: c.amount_paid >= totalFeeAgreed ? "paid_in_full" : "balance_due" }
          : c
      )
    );
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-800">Clients</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Track fees, payments, and balances per client -- and reconcile each payment against a real
            bank transaction where one exists.
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
            {showForm ? "Cancel" : "Add client"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showForm && (
        <div className="card fade-in mt-4 grid grid-cols-2 gap-3 p-4">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" className="input" />
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose (optional)" className="input" />
          <input
            value={totalFee}
            onChange={(e) => setTotalFee(e.target.value)}
            placeholder="Total fee agreed"
            type="number"
            className="input"
          />
          <input
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder="Amount paid so far"
            type="number"
            className="input"
          />
          <button onClick={addClient} className="btn-primary col-span-2">
            Save client
          </button>
        </div>
      )}

      <div className="card card-flat mt-4 flex flex-col divide-y divide-zinc-100">
        {clients.map((c, i) => {
          const pct = c.total_fee_agreed > 0 ? Math.min((c.amount_paid / c.total_fee_agreed) * 100, 100) : 0;
          const linkedIdsForRow = c.linked_transaction_ids ?? [];
          const linkedTotalForRow =
            linkedIdsForRow.length > 0
              ? creditTransactions
                  .filter((t) => linkedIdsForRow.includes(t.id))
                  .reduce((sum, t) => sum + Number(t.amount), 0)
              : null;
          const overridden = linkedTotalForRow !== null && Math.round(linkedTotalForRow) !== Math.round(c.amount_paid);
          const balance = c.total_fee_agreed - c.amount_paid;
          return (
          <div key={c.id} className="line-in" style={{ animationDelay: lineDelay(i) }}>
            <div className="row-hover flex flex-wrap items-end gap-3 rounded-md px-4 py-2 text-sm">
              <div className="min-w-[140px] flex-1 self-center">
                <p className="font-medium text-zinc-800">{c.client_name}</p>
                {c.purpose && <p className="text-xs text-zinc-500">{c.purpose}</p>}
                <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? "var(--org-accent, #1E9E6B)" : "#F59E0B" }}
                  />
                </div>
              </div>

              {/* Total, Paid, and Balance are deliberately three separate boxes --
                  Total and Paid are inputs (the two things a person actually sets),
                  Balance is always just Total minus Paid, computed live, never editable. */}
              <div className="flex w-24 shrink-0 flex-col gap-0.5">
                <label className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">Total</label>
                {canEdit ? (
                  <input
                    type="number"
                    key={`total-${c.total_fee_agreed}`}
                    defaultValue={c.total_fee_agreed}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v > 0 && v !== c.total_fee_agreed) updateTotalFee(c.id, v);
                    }}
                    className="input w-24"
                    title="Total cost of service agreed with this client."
                  />
                ) : (
                  <span className="text-sm font-medium text-zinc-700">{currency} {c.total_fee_agreed.toLocaleString()}</span>
                )}
              </div>

              <div className="flex w-24 shrink-0 flex-col gap-0.5">
                <label className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">Paid</label>
                {canEdit ? (
                  <input
                    type="number"
                    // key forces the input to pick up the freshly-synced value after a
                    // link/unlink instead of keeping stale text in an uncontrolled input.
                    key={`paid-${c.amount_paid}`}
                    defaultValue={c.amount_paid}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== c.amount_paid) updatePayment(c.id, v);
                    }}
                    className="input w-24"
                    title={
                      linkedTotalForRow !== null
                        ? "Auto-synced from linked transactions by default -- overriding here is final, you're the MD."
                        : "No bank transactions linked yet -- enter manually (e.g. cash payments)."
                    }
                  />
                ) : (
                  <span className="text-sm font-medium text-zinc-700">{currency} {c.amount_paid.toLocaleString()}</span>
                )}
                {overridden && (
                  <span className="text-[10px] text-amber-600" title="Doesn't match the current linked-transaction total">
                    &ne; linked {currency} {linkedTotalForRow!.toLocaleString()}
                  </span>
                )}
              </div>

              <div className="flex w-28 shrink-0 flex-col gap-0.5">
                <label className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">Balance</label>
                <span
                  className="text-sm font-semibold"
                  style={{ color: balance <= 0 ? "var(--org-accent, #1E9E6B)" : "#B45309" }}
                >
                  {balance > 0
                    ? `${currency} ${balance.toLocaleString()}`
                    : balance < 0
                      ? `Credit ${currency} ${Math.abs(balance).toLocaleString()}`
                      : "Settled"}
                </span>
              </div>

              <span
                className={`self-center ${c.status === "paid_in_full" ? "badge-accent" : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800"}`}
              >
                {c.status === "paid_in_full" ? "Paid" : "Due"}
              </span>
              {canEdit && (
                <button
                  onClick={() => setExpandedId((prev) => (prev === c.id ? null : c.id))}
                  className="self-center text-xs font-medium"
                  style={{ color: "var(--org-accent, #1E9E6B)" }}
                >
                  {expandedId === c.id ? "Hide reconciliation" : "Reconcile"} &darr;
                </button>
              )}
              <a
                href={`/dashboard/clients/${c.id}/statement`}
                target="_blank"
                rel="noopener noreferrer"
                className="self-center text-xs font-medium"
                style={{ color: "var(--org-accent, #1E9E6B)" }}
              >
                Statement &rarr;
              </a>
            </div>

            {expandedId === c.id && (
              <ReconcilePanel
                client={c}
                currency={currency}
                creditTransactions={creditTransactions}
                onSave={(ids) => setLinkedTransactions(c.id, ids)}
                onSyncAmountPaid={(amount) => updatePayment(c.id, amount)}
              />
            )}
          </div>
          );
        })}
        {clients.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-zinc-500">No clients yet.</p>
        )}
      </div>
    </div>
  );
}

function ReconcilePanel({
  client,
  currency,
  creditTransactions,
  onSave,
  onSyncAmountPaid,
}: {
  client: ClientRow;
  currency: string;
  creditTransactions: CreditTxn[];
  onSave: (ids: string[]) => void;
  onSyncAmountPaid: (amount: number) => void;
}) {
  const [linkedIds, setLinkedIds] = useState<string[]>(client.linked_transaction_ids ?? []);
  const [search, setSearch] = useState("");

  const linkedTxns = creditTransactions.filter((t) => linkedIds.includes(t.id));
  const linkedTotal = linkedTxns.reduce((sum, t) => sum + Number(t.amount), 0);
  const mismatch = linkedTxns.length > 0 && Math.round(linkedTotal) !== Math.round(client.amount_paid);

  // What a newly-linked transaction would need to add up to in order to
  // close out this client's record: the still-unlinked paid figure if
  // nothing is linked yet, or the remaining gap toward the agreed fee once
  // something is. Surfacing transactions that hit this figure exactly --
  // regardless of what's typed into search -- is what actually answers
  // "which transaction is this", since eyeballing a long date-sorted list
  // for one specific amount is exactly the thing people miss.
  const unlinkedPool = creditTransactions.filter((t) => !linkedIds.includes(t.id));
  const targetAmount = linkedTxns.length > 0 ? client.total_fee_agreed - linkedTotal : client.amount_paid;
  const exactMatches =
    targetAmount > 0
      ? unlinkedPool.filter((t) => Math.round(Number(t.amount)) === Math.round(targetAmount))
      : [];
  const exactMatchIds = new Set(exactMatches.map((t) => t.id));

  const searchLower = search.toLowerCase().trim();
  const searched = unlinkedPool.filter((t) => {
    if (exactMatchIds.has(t.id)) return false; // already surfaced above, don't list twice
    if (!searchLower) return true;
    return (
      t.description.toLowerCase().includes(searchLower) ||
      String(Math.round(Number(t.amount))).includes(searchLower)
    );
  });

  function toggle(id: string) {
    const next = linkedIds.includes(id) ? linkedIds.filter((i) => i !== id) : [...linkedIds, id];
    setLinkedIds(next);
    onSave(next);
    // Linked bank transactions are the source of truth -- as soon as at
    // least one is linked, amount_paid auto-syncs to their sum, no manual
    // "use linked total" step required. If everything gets unlinked, we
    // deliberately don't zero it out -- that would erase a legitimate manual
    // figure (e.g. cash payments) that had nothing to link to in the first
    // place.
    if (next.length > 0) {
      const nextTotal = creditTransactions
        .filter((t) => next.includes(t.id))
        .reduce((sum, t) => sum + Number(t.amount), 0);
      onSyncAmountPaid(nextTotal);
    }
  }

  return (
    <div className="fade-in border-t border-zinc-100 bg-zinc-50/60 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Linked bank transactions ({linkedTxns.length})
      </p>

      {linkedTxns.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1">
          {linkedTxns.map((t, i) => (
            <div
              key={t.id}
              className="line-in row-hover flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm shadow-sm"
              style={{ animationDelay: lineDelay(i) }}
            >
              <span className="break-words text-zinc-700">
                {t.txn_date} &middot; {t.description}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-zinc-800">
                  {currency} {Number(t.amount).toLocaleString()}
                </span>
                <button onClick={() => toggle(t.id)} className="text-xs font-medium text-zinc-500 hover:text-red-600">
                  Unlink
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">
          No bank transactions linked yet -- this client&apos;s {currency} {client.amount_paid.toLocaleString()} paid
          is currently a manual figure only. Link the matching transaction below if one exists, or leave as-is if
          it predates automatic ingestion (e.g. cash, or before FinHive was connected).
        </p>
      )}

      {mismatch && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>
            Linked total ({currency} {linkedTotal.toLocaleString()}) doesn&apos;t match the recorded paid amount
            ({currency} {client.amount_paid.toLocaleString()}) -- this predates auto-sync. Fix it once and future
            links will stay in sync automatically.
          </span>
          <button onClick={() => onSyncAmountPaid(linkedTotal)} className="btn-secondary text-xs">
            Use linked total
          </button>
        </div>
      )}

      {targetAmount > 0 &&
        (exactMatches.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--org-accent, #1E9E6B)" }}>
              Possible match -- exactly {currency} {Math.round(targetAmount).toLocaleString()}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {exactMatches.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className="line-in row-hover flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm shadow-sm"
                  style={{ animationDelay: lineDelay(i), borderColor: "var(--org-accent, #1E9E6B)", backgroundColor: "#F0FDF7" }}
                >
                  <span className="text-zinc-700">
                    {t.txn_date} &middot; {t.description}
                  </span>
                  <span className="font-medium text-zinc-800">
                    {currency} {Number(t.amount).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-xs text-zinc-500">
            No credit transaction in the most recent 200 matches {currency} {Math.round(targetAmount).toLocaleString()} exactly --
            this payment likely predates automatic ingestion, came in as cash, or was split across multiple
            transfers. Search below to check for a split payment, or leave it unlinked.
          </p>
        ))}

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Link another transaction</p>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search recent credit transactions by description or amount..."
        className="input mt-2 w-full"
      />
      <div className="mt-2 max-h-48 overflow-auto rounded-md border border-zinc-200 bg-white">
        {searched.length > 0 ? (
          searched.slice(0, 20).map((t, i) => (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className="line-in row-hover flex w-full items-center justify-between border-b border-zinc-100 px-3 py-2 text-left text-sm last:border-0"
              style={{ animationDelay: lineDelay(i) }}
            >
              <span className="break-words text-zinc-700">
                {t.txn_date} &middot; {t.description}
              </span>
              <span className="font-medium text-zinc-800">
                {currency} {Number(t.amount).toLocaleString()}
              </span>
            </button>
          ))
        ) : (
          <p className="px-3 py-4 text-center text-sm text-zinc-500">
            No other unlinked credit transactions in the most recent 200.
          </p>
        )}
      </div>
    </div>
  );
}
