"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { lineDelay } from "@/lib/lineDelay";
import { currentCycleNumber, payoutPositionForCycle } from "@/lib/savingsCycles";

interface SavingsGroup {
  id: string;
  name: string;
  contribution_amount: number;
  cycle_frequency: "weekly" | "monthly";
  start_date: string;
  is_archived: boolean;
}

interface SavingsMember {
  id: string;
  group_id: string;
  name: string;
  phone: string | null;
  payout_position: number;
}

interface Contribution {
  id: string;
  group_id: string;
  member_id: string;
  cycle_number: number;
  amount_expected: number;
  amount_paid: number;
  status: string;
  linked_transaction_id: string | null;
}

interface Payout {
  id: string;
  group_id: string;
  member_id: string;
  cycle_number: number;
  amount: number;
  paid_at: string | null;
  linked_transaction_id?: string | null;
}

interface ShareLink {
  id: string;
  scope: string;
  scope_ref_id: string | null;
  token: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface Txn {
  id: string;
  txn_date: string;
  description: string;
  amount: number;
}

export default function SavingsManager({
  organizationId,
  currency,
  canEdit,
  initialGroups,
  initialMembers,
  initialContributions,
  initialPayouts,
  initialShareLinks,
  creditTransactions,
  debitTransactions,
}: {
  organizationId: string;
  currency: string;
  canEdit: boolean;
  initialGroups: SavingsGroup[];
  initialMembers: SavingsMember[];
  initialContributions: Contribution[];
  initialPayouts: Payout[];
  initialShareLinks: ShareLink[];
  creditTransactions: Txn[];
  debitTransactions: Txn[];
}) {
  const supabase = createClient();
  const [groups, setGroups] = useState<SavingsGroup[]>(initialGroups);
  const [members, setMembers] = useState<SavingsMember[]>(initialMembers);
  const [contributions, setContributions] = useState<Contribution[]>(initialContributions);
  const [payouts, setPayouts] = useState<Payout[]>(initialPayouts);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>(initialShareLinks);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("monthly");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Every transaction already linked to some contribution or payout is
  // considered "used" and drops out of the pick lists -- otherwise the same
  // bank alert could get linked to two different members.
  const usedTxnIds = new Set<string>([
    ...contributions.map((c) => c.linked_transaction_id).filter((v): v is string => !!v),
    ...payouts.map((p) => p.linked_transaction_id).filter((v): v is string => !!v),
  ]);
  const availableCredits = creditTransactions.filter((t) => !usedTxnIds.has(t.id));
  const availableDebits = debitTransactions.filter((t) => !usedTxnIds.has(t.id));

  async function createGroup() {
    if (!name.trim() || !amount) return;
    setError("");
    const { data, error: err } = await supabase
      .from("savings_groups")
      .insert({
        organization_id: organizationId,
        name: name.trim(),
        contribution_amount: Number(amount),
        cycle_frequency: frequency,
        start_date: startDate,
      })
      .select("id, name, contribution_amount, cycle_frequency, start_date, is_archived")
      .single();

    if (err) return setError(err.message);
    setGroups((prev) => [data as SavingsGroup, ...prev]);
    setName("");
    setAmount("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setShowForm(false);
  }

  async function addMember(groupId: string, memberName: string, phone: string) {
    if (!memberName.trim()) return;
    setError("");
    const existingCount = members.filter((m) => m.group_id === groupId).length;
    const { data, error: err } = await supabase
      .from("savings_members")
      .insert({
        group_id: groupId,
        name: memberName.trim(),
        phone: phone.trim() || null,
        payout_position: existingCount + 1,
      })
      .select("id, group_id, name, phone, payout_position")
      .single();

    if (err) return setError(err.message);
    setMembers((prev) => [...prev, data as SavingsMember]);

    const group = groups.find((g) => g.id === groupId);
    if (group) {
      const cycle = currentCycleNumber(group.start_date, group.cycle_frequency);
      const { data: contrib } = await supabase
        .from("contributions")
        .insert({
          group_id: groupId,
          member_id: (data as SavingsMember).id,
          cycle_number: cycle,
          amount_expected: group.contribution_amount,
        })
        .select("id, group_id, member_id, cycle_number, amount_expected, amount_paid, status, linked_transaction_id")
        .single();
      if (contrib) setContributions((prev) => [...prev, contrib as Contribution]);
    }
  }

  async function updateContributionPaid(contributionId: string, amountPaid: number) {
    setError("");
    const { error: err } = await supabase
      .from("contributions")
      .update({ amount_paid: amountPaid })
      .eq("id", contributionId);
    if (err) return setError(err.message);
    setContributions((prev) =>
      prev.map((c) =>
        c.id === contributionId
          ? { ...c, amount_paid: amountPaid, status: amountPaid >= c.amount_expected ? "paid" : "outstanding" }
          : c
      )
    );
  }

  async function linkContribution(contributionId: string, transactionId: string, txnAmount: number) {
    setError("");
    const { error: err } = await supabase
      .from("contributions")
      .update({ linked_transaction_id: transactionId, amount_paid: txnAmount })
      .eq("id", contributionId);
    if (err) return setError(err.message);
    setContributions((prev) =>
      prev.map((c) =>
        c.id === contributionId
          ? {
              ...c,
              linked_transaction_id: transactionId,
              amount_paid: txnAmount,
              status: txnAmount >= c.amount_expected ? "paid" : "outstanding",
            }
          : c
      )
    );
  }

  async function unlinkContribution(contributionId: string) {
    setError("");
    const { error: err } = await supabase
      .from("contributions")
      .update({ linked_transaction_id: null })
      .eq("id", contributionId);
    if (err) return setError(err.message);
    setContributions((prev) =>
      prev.map((c) => (c.id === contributionId ? { ...c, linked_transaction_id: null } : c))
    );
  }

  async function recordPayoutManual(groupId: string, cycleNumber: number, memberId: string, totalAmount: number) {
    setError("");
    const { data, error: err } = await supabase
      .from("payouts")
      .insert({
        group_id: groupId,
        member_id: memberId,
        cycle_number: cycleNumber,
        amount: totalAmount,
        paid_at: new Date().toISOString(),
      })
      .select("id, group_id, member_id, cycle_number, amount, paid_at, linked_transaction_id")
      .single();
    if (err) return setError(err.message);
    setPayouts((prev) => [...prev, data as Payout]);
  }

  async function recordPayoutWithTransaction(
    groupId: string,
    cycleNumber: number,
    memberId: string,
    transactionId: string,
    txnAmount: number
  ) {
    setError("");
    const { data, error: err } = await supabase
      .from("payouts")
      .insert({
        group_id: groupId,
        member_id: memberId,
        cycle_number: cycleNumber,
        amount: txnAmount,
        paid_at: new Date().toISOString(),
        linked_transaction_id: transactionId,
      })
      .select("id, group_id, member_id, cycle_number, amount, paid_at, linked_transaction_id")
      .single();
    if (err) return setError(err.message);
    setPayouts((prev) => [...prev, data as Payout]);
  }

  async function generateShareLink(groupId: string) {
    setError("");
    const res = await fetch("/api/share-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "savings_group", scopeRefId: groupId }),
    });
    const body = await res.json();
    if (!res.ok) return setError(body.error ?? "Couldn't create the link.");
    setShareLinks((prev) => [...prev, body.link as ShareLink]);
  }

  async function revokeShareLink(linkId: string) {
    setError("");
    const res = await fetch("/api/share-links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: linkId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return setError(body.error ?? "Couldn't revoke the link.");
    }
    setShareLinks((prev) => prev.filter((l) => l.id !== linkId));
  }

  return (
    <div className="fade-in pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-800">Savings groups</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Rotating thrift (ajo/esusu/susu) -- track who&apos;s contributed each cycle, whose turn it
            is for the payout, and share a read-only link with the whole group, no login required.
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
            {showForm ? "Cancel" : "New group"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showForm && (
        <div className="card fade-in mt-4 grid grid-cols-2 gap-3 p-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" className="input" />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Contribution amount (${currency})`}
            type="number"
            className="input"
          />
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as "weekly" | "monthly")} className="input">
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
          <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" className="input" />
          <button onClick={createGroup} className="btn-primary col-span-2">
            Create group
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {groups.map((g, i) => {
          const groupMembers = members
            .filter((m) => m.group_id === g.id)
            .sort((a, b) => a.payout_position - b.payout_position);
          const cycle = currentCycleNumber(g.start_date, g.cycle_frequency);
          const cycleContributions = contributions.filter((c) => c.group_id === g.id && c.cycle_number === cycle);
          const paidCount = cycleContributions.filter((c) => c.status === "paid").length;
          const turnPosition = payoutPositionForCycle(cycle, groupMembers.length);
          const memberOnTurn = groupMembers.find((m) => m.payout_position === turnPosition);
          const payoutForCycle = payouts.find((p) => p.group_id === g.id && p.cycle_number === cycle);

          return (
            <div key={g.id} className="card line-in p-4" style={{ animationDelay: lineDelay(i) }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-800">{g.name}</p>
                  <p className="text-xs text-zinc-500">
                    {currency} {Number(g.contribution_amount).toLocaleString()} &middot; {g.cycle_frequency} &middot;{" "}
                    {groupMembers.length} member{groupMembers.length === 1 ? "" : "s"} &middot; cycle {cycle}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge-accent">
                    {paidCount}/{groupMembers.length || 0} paid this cycle
                  </span>
                  <button
                    onClick={() => setExpandedId((prev) => (prev === g.id ? null : g.id))}
                    className="text-xs font-medium"
                    style={{ color: "var(--org-accent, #1E9E6B)" }}
                  >
                    {expandedId === g.id ? "Hide" : "Manage"} &darr;
                  </button>
                </div>
              </div>

              {expandedId === g.id && (
                <GroupDetail
                  group={g}
                  currency={currency}
                  canEdit={canEdit}
                  cycle={cycle}
                  members={groupMembers}
                  contributions={cycleContributions}
                  memberOnTurn={memberOnTurn}
                  payoutForCycle={payoutForCycle}
                  shareLinksForGroup={shareLinks.filter((l) => l.scope_ref_id === g.id)}
                  availableCredits={availableCredits}
                  availableDebits={availableDebits}
                  onAddMember={(memberName, phone) => addMember(g.id, memberName, phone)}
                  onUpdatePaid={updateContributionPaid}
                  onLinkContribution={linkContribution}
                  onUnlinkContribution={unlinkContribution}
                  onRecordPayoutManual={() =>
                    memberOnTurn &&
                    recordPayoutManual(g.id, cycle, memberOnTurn.id, g.contribution_amount * groupMembers.length)
                  }
                  onRecordPayoutWithTransaction={(transactionId, txnAmount) =>
                    memberOnTurn && recordPayoutWithTransaction(g.id, cycle, memberOnTurn.id, transactionId, txnAmount)
                  }
                  onGenerateLink={() => generateShareLink(g.id)}
                  onRevokeLink={revokeShareLink}
                />
              )}
            </div>
          );
        })}
        {groups.length === 0 && (
          <p className="rounded-lg border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            No savings groups yet. {canEdit ? "Create one to get started." : "Ask an owner or admin to create one."}
          </p>
        )}
      </div>
    </div>
  );
}

function GroupDetail({
  group,
  currency,
  canEdit,
  cycle,
  members,
  contributions,
  memberOnTurn,
  payoutForCycle,
  shareLinksForGroup,
  availableCredits,
  availableDebits,
  onAddMember,
  onUpdatePaid,
  onLinkContribution,
  onUnlinkContribution,
  onRecordPayoutManual,
  onRecordPayoutWithTransaction,
  onGenerateLink,
  onRevokeLink,
}: {
  group: SavingsGroup;
  currency: string;
  canEdit: boolean;
  cycle: number;
  members: SavingsMember[];
  contributions: Contribution[];
  memberOnTurn: SavingsMember | undefined;
  payoutForCycle: Payout | undefined;
  shareLinksForGroup: ShareLink[];
  availableCredits: Txn[];
  availableDebits: Txn[];
  onAddMember: (name: string, phone: string) => void;
  onUpdatePaid: (contributionId: string, amountPaid: number) => void;
  onLinkContribution: (contributionId: string, transactionId: string, amount: number) => void;
  onUnlinkContribution: (contributionId: string) => void;
  onRecordPayoutManual: () => void;
  onRecordPayoutWithTransaction: (transactionId: string, amount: number) => void;
  onGenerateLink: () => void;
  onRevokeLink: (id: string) => void;
}) {
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [linkingMemberId, setLinkingMemberId] = useState<string | null>(null);
  const [linkingPayout, setLinkingPayout] = useState(false);
  const totalPot = group.contribution_amount * members.length;

  return (
    <div className="fade-in mt-4 border-t border-zinc-100 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Cycle {cycle} contributions
      </p>
      <div className="mt-2 flex flex-col divide-y divide-zinc-100 rounded-md border border-zinc-100">
        {members.map((m) => {
          const c = contributions.find((c) => c.member_id === m.id);
          const isLinked = !!c?.linked_transaction_id;
          return (
            <div key={m.id}>
              <div className="row-hover flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-800">
                    {m.name}
                    {m.id === memberOnTurn?.id && (
                      <span className="ml-2 badge-accent">receives this cycle</span>
                    )}
                  </p>
                  {m.phone && <p className="text-xs text-zinc-500">{m.phone}</p>}
                </div>

                {isLinked ? (
                  <span className="text-xs text-zinc-500" title="Synced from a linked bank transaction">
                    {currency} {(c?.amount_paid ?? 0).toLocaleString()} &middot; linked
                  </span>
                ) : canEdit ? (
                  <input
                    type="number"
                    key={`${m.id}-${c?.amount_paid ?? 0}`}
                    defaultValue={c?.amount_paid ?? 0}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (c && v !== c.amount_paid) onUpdatePaid(c.id, v);
                    }}
                    className="input w-28"
                  />
                ) : (
                  <span className="text-zinc-700">{currency} {(c?.amount_paid ?? 0).toLocaleString()}</span>
                )}

                <span
                  className={
                    c?.status === "paid"
                      ? "badge-accent"
                      : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800"
                  }
                >
                  {c?.status === "paid" ? "Paid" : "Outstanding"}
                </span>

                {canEdit && c && (
                  isLinked ? (
                    <button
                      onClick={() => onUnlinkContribution(c.id)}
                      className="shrink-0 text-xs font-medium text-zinc-500 hover:text-red-600"
                    >
                      Unlink
                    </button>
                  ) : (
                    <button
                      onClick={() => setLinkingMemberId((prev) => (prev === m.id ? null : m.id))}
                      className="shrink-0 text-xs font-medium"
                      style={{ color: "var(--org-accent, #1E9E6B)" }}
                    >
                      {linkingMemberId === m.id ? "Cancel" : "Link transaction"}
                    </button>
                  )
                )}
              </div>

              {linkingMemberId === m.id && c && (
                <TxnPicker
                  currency={currency}
                  transactions={availableCredits}
                  targetAmount={c.amount_expected}
                  onPick={(txnId, txnAmount) => {
                    onLinkContribution(c.id, txnId, txnAmount);
                    setLinkingMemberId(null);
                  }}
                />
              )}
            </div>
          );
        })}
        {members.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-zinc-500">No members yet.</p>
        )}
      </div>

      {canEdit && (
        <div className="mt-3 flex items-center gap-2">
          <input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Member name" className="input flex-1" />
          <input value={memberPhone} onChange={(e) => setMemberPhone(e.target.value)} placeholder="Phone (optional)" className="input flex-1" />
          <button
            onClick={() => {
              onAddMember(memberName, memberPhone);
              setMemberName("");
              setMemberPhone("");
            }}
            className="btn-secondary"
          >
            Add member
          </button>
        </div>
      )}

      {memberOnTurn && (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-700">
              <strong>{memberOnTurn.name}</strong> is due the full pot -- {currency} {totalPot.toLocaleString()} --
              this cycle.
            </span>
            {canEdit && !payoutForCycle && (
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => setLinkingPayout((s) => !s)} className="btn-secondary text-xs">
                  {linkingPayout ? "Cancel" : "Link transaction"}
                </button>
                <button onClick={onRecordPayoutManual} className="btn-primary text-xs">
                  Record manually
                </button>
              </div>
            )}
            {payoutForCycle && (
              <span className="shrink-0 text-xs font-medium text-zinc-500">
                {payoutForCycle.linked_transaction_id ? "Paid out · linked" : "Paid out · recorded manually"}
              </span>
            )}
          </div>

          {linkingPayout && !payoutForCycle && (
            <TxnPicker
              currency={currency}
              transactions={availableDebits}
              targetAmount={totalPot}
              onPick={(txnId, txnAmount) => {
                onRecordPayoutWithTransaction(txnId, txnAmount);
                setLinkingPayout(false);
              }}
            />
          )}
        </div>
      )}

      {canEdit && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Transparency link -- share with the whole group, no login needed
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {shareLinksForGroup.map((l) => (
              <div key={l.id} className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
                <input readOnly value={`${window.location.origin}/share/${l.token}`} className="input flex-1 text-xs" onFocus={(e) => e.target.select()} />
                <button onClick={() => onRevokeLink(l.id)} className="text-xs font-medium text-zinc-500 hover:text-red-600">
                  Revoke
                </button>
              </div>
            ))}
            <button onClick={onGenerateLink} className="btn-secondary self-start text-xs">
              Generate new link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Shared reconcile widget for both contributions (credit transactions) and
// payouts (debit transactions) -- sorts exact amount matches to the top
// first, since a group's contribution/pot amount is usually fixed and
// distinctive, then falls back to a text search over the description.
function TxnPicker({
  currency,
  transactions,
  targetAmount,
  onPick,
}: {
  currency: string;
  transactions: Txn[];
  targetAmount: number;
  onPick: (transactionId: string, amount: number) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = transactions
    .filter((t) => t.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aMatch = Math.round(Number(a.amount)) === Math.round(targetAmount) ? 0 : 1;
      const bMatch = Math.round(Number(b.amount)) === Math.round(targetAmount) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return new Date(b.txn_date).getTime() - new Date(a.txn_date).getTime();
    });

  return (
    <div className="fade-in mt-2 rounded-md border border-zinc-200 bg-white p-2">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search recent transactions by description..."
        className="input w-full text-sm"
      />
      <div className="mt-2 max-h-48 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
        {filtered.length > 0 ? (
          filtered.slice(0, 20).map((t, i) => {
            const isMatch = Math.round(Number(t.amount)) === Math.round(targetAmount);
            return (
              <button
                key={t.id}
                onClick={() => onPick(t.id, Number(t.amount))}
                className="line-in flex w-full items-center justify-between border-b border-zinc-100 px-2 py-2 text-left text-sm last:border-0 hover:bg-zinc-100"
                style={{ animationDelay: lineDelay(i, 40, 400) }}
              >
                <span className="break-words text-zinc-700">
                  {t.txn_date} &middot; {t.description}
                </span>
                <span className={isMatch ? "font-semibold" : "font-medium text-zinc-800"} style={isMatch ? { color: "var(--org-accent, #1E9E6B)" } : undefined}>
                  {currency} {Number(t.amount).toLocaleString()}
                  {isMatch && " ✓"}
                </span>
              </button>
            );
          })
        ) : (
          <p className="px-2 py-3 text-center text-sm text-zinc-500">No matching unlinked transactions.</p>
        )}
      </div>
    </div>
  );
}
