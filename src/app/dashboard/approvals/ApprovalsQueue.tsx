"use client";

import { useState } from "react";
import { lineDelay } from "@/lib/lineDelay";

interface PendingTxn {
  id: string;
  txn_date: string;
  type: "credit" | "debit";
  description: string;
  amount: number;
  flagged_reason: string | null;
  confirmed_by: string | null;
  confirmedByName: string | null;
  categoryName: string | undefined;
}

export default function ApprovalsQueue({
  currency,
  currentProfileId,
  initialPending,
}: {
  currency: string;
  currentProfileId: string;
  initialPending: PendingTxn[];
}) {
  const [pending, setPending] = useState<PendingTxn[]>(initialPending);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function approve(id: string) {
    setBusyId(id);
    setError("");
    const res = await fetch("/api/transactions/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: id }),
    });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) return setError(body.error ?? "Couldn't approve this transaction.");
    setPending((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="fade-in">
      <h2 className="text-base font-semibold text-zinc-800">Approvals</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Large debits above your organization&apos;s approval threshold wait here for a second, different
        owner or admin to sign off -- whoever categorized it can&apos;t also approve it.
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-col gap-3">
        {pending.map((t, i) => {
          const isSameApprover = t.confirmed_by === currentProfileId;
          return (
            <div key={t.id} className="card line-in p-4" style={{ animationDelay: lineDelay(i) }}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="break-words font-medium text-zinc-800">{t.description}</p>
                  <p className="text-xs text-zinc-500">
                    {t.txn_date} &middot; {t.type} &middot; {currency} {t.amount.toLocaleString()}
                    {t.categoryName && <> &middot; {t.categoryName}</>}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Categorized by <strong>{t.confirmedByName ?? "someone"}</strong>
                  </p>
                </div>
                {isSameApprover ? (
                  <span
                    className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
                    title="You categorized this one -- a different owner or admin needs to approve it"
                  >
                    Waiting on another approver
                  </span>
                ) : (
                  <button onClick={() => approve(t.id)} disabled={busyId === t.id} className="btn-primary">
                    {busyId === t.id ? "Approving..." : "Approve"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {pending.length === 0 && (
          <p className="rounded-lg border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            Nothing waiting on approval right now.
          </p>
        )}
      </div>
    </div>
  );
}
