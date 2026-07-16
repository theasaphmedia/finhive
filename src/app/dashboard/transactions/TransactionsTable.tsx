"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { lineDelay } from "@/lib/lineDelay";
import StatusBadge from "../StatusBadge";

interface BreakdownItem {
  label: string;
  amount: number;
  linkedTransactionId?: string;
}

export interface Txn {
  id: string;
  txn_date: string;
  txn_time: string | null;
  type: "credit" | "debit";
  description: string;
  amount: number;
  balance_after: number | null;
  status: string;
  flagged_reason: string | null;
  raw_source_text: string | null;
  confirmed_at: string | null;
  linked_expense_ids: string[] | null;
  category_id: string | null;
  notes: string | null;
  note_breakdown: BreakdownItem[] | null;
  notes_updated_by: string | null;
  notes_updated_at: string | null;
  categories: { name: string } | { name: string }[] | null;
}

interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
}

const RANGES: { id: string; label: string }[] = [
  { id: "1m", label: "1 Month" },
  { id: "3m", label: "3 Months" },
  { id: "6m", label: "6 Months" },
  { id: "1y", label: "1 Year" },
  { id: "all", label: "All" },
];

const TYPE_TABS: { id: string; label: string; activeColor: (accent: string) => string }[] = [
  { id: "all", label: "All", activeColor: () => "var(--org-primary, #0F2A3D)" },
  { id: "credit", label: "Inflow", activeColor: (accent) => accent },
  { id: "debit", label: "Outflow", activeColor: () => "#3F3F46" },
];

const TYPE_COPY: Record<string, { title: string; subtitle: string }> = {
  all: {
    title: "Transactions",
    subtitle: "Click any row for the full bank alert and audit detail -- click an inflow to track what it funded.",
  },
  credit: {
    title: "Inflow",
    subtitle: "Every credit into the account. Click one to link the expenses it funded and see what's left.",
  },
  debit: {
    title: "Outflow",
    subtitle: "Every debit out of the account. Click any row for the full bank alert and audit detail.",
  },
};

function categoryName(c: Txn["categories"]): string {
  if (!c) return "--";
  return Array.isArray(c) ? (c[0]?.name ?? "--") : c.name;
}

export default function TransactionsTable({
  transactions,
  currency,
  accentColor,
  range,
  type,
  categories,
  canRecategorize,
  noteAuthorNameById,
}: {
  transactions: Txn[];
  currency: string;
  accentColor: string;
  range: string;
  type: string;
  categories: Category[];
  canRecategorize: boolean;
  noteAuthorNameById: Record<string, string>;
}) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [txns, setTxns] = useState<Txn[]>(transactions);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recategorizeError, setRecategorizeError] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  // Full pool (all types, current range) always stays available for the
  // Inflow tab's linking search -- only the visible rows get filtered by tab.
  const typeFiltered = type === "all" ? txns : txns.filter((t) => t.type === type);

  // Search matches description, category name, notes, and breakdown line
  // labels -- notes exist specifically so a vague bank-alert description
  // like "Transfer to 0123456789" becomes findable later by what it was
  // actually for. Amount search is deliberately fuzzy, not exact: a real
  // bank alert almost never lands on the round number someone remembers --
  // a transfer fee, stamp duty, or gateway charge shaves a little off one
  // side or the other. So typing a plain number is treated as "near this
  // amount" (within ~3%, or a flat NGN 300 minimum band for small figures,
  // capped at NGN 5,000 so it doesn't get meaninglessly wide on big
  // transactions), not "exactly this amount" -- and matches are sorted
  // closest-first so the one that's actually it doesn't get buried under a
  // dozen unrelated rows. A query that isn't purely numeric is left as a
  // plain substring match against description/notes/category, since at that
  // point it's clearly not an amount lookup.
  const searchRaw = search.trim();
  const searchLower = searchRaw.toLowerCase();
  const numericQuery = searchRaw.replace(/,/g, "");
  const isAmountSearch = searchRaw.length > 0 && /^\d+(\.\d+)?$/.test(numericQuery);
  const targetAmount = isAmountSearch ? Number(numericQuery) : null;
  const amountTolerance = targetAmount !== null ? Math.min(Math.max(targetAmount * 0.03, 300), 5000) : 0;

  const visibleTxns =
    searchLower.length === 0
      ? typeFiltered
      : typeFiltered
          .filter((t) => {
            if (targetAmount !== null) {
              return Math.abs(Number(t.amount) - targetAmount) <= amountTolerance;
            }
            const cat = categoryName(t.categories).toLowerCase();
            const breakdownText = (t.note_breakdown ?? []).map((b) => b.label).join(" ").toLowerCase();
            return (
              t.description.toLowerCase().includes(searchLower) ||
              (t.notes ?? "").toLowerCase().includes(searchLower) ||
              breakdownText.includes(searchLower) ||
              cat.includes(searchLower)
            );
          })
          .sort((a, b) => {
            if (targetAmount === null) return 0; // keep original date-desc order for text search
            return Math.abs(Number(a.amount) - targetAmount) - Math.abs(Number(b.amount) - targetAmount);
          });

  const copy = TYPE_COPY[type] ?? TYPE_COPY.all;
  // Split Debit/Credit lanes only pay off when both flows are mixed together
  // (the All tab). On the Inflow/Outflow tabs every row is already the same
  // type, so a second, permanently-empty lane would just be dead space.
  const splitLanes = type === "all";
  const colSpan = splitLanes ? 7 : 6;

  function setRange(r: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", r);
    router.push(`${pathname}?${params.toString()}`);
  }

  function setType(t: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", t);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function setLinkedExpenses(creditId: string, ids: string[]) {
    const { error } = await supabase.from("transactions").update({ linked_expense_ids: ids }).eq("id", creditId);
    if (error) return;
    setTxns((prev) => prev.map((t) => (t.id === creditId ? { ...t, linked_expense_ids: ids } : t)));
  }

  // Goes through /api/transactions/recategorize instead of a direct client
  // update -- that's what appends the audit event and reinforces the
  // category_rules keyword learning, same as confirming a flag does.
  async function recategorize(txnId: string, categoryId: string, categoryLabel: string) {
    setRecategorizeError((prev) => {
      const next = { ...prev };
      delete next[txnId];
      return next;
    });

    const res = await fetch("/api/transactions/recategorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: txnId, categoryId }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setRecategorizeError((prev) => ({ ...prev, [txnId]: body.error ?? "Couldn't change this category." }));
      return;
    }

    setTxns((prev) =>
      prev.map((t) => (t.id === txnId ? { ...t, category_id: categoryId, categories: { name: categoryLabel } } : t))
    );
  }

  async function saveNote(
    txnId: string,
    notes: string,
    breakdown: BreakdownItem[]
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch("/api/transactions/note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: txnId, notes, breakdown }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error ?? "Couldn't save this note." };

    const now = new Date().toISOString();
    setTxns((prev) =>
      prev.map((t) =>
        t.id === txnId
          ? { ...t, notes: body.notes ?? null, note_breakdown: body.breakdown ?? null, notes_updated_at: now }
          : t
      )
    );
    return { ok: true };
  }

  return (
    <div className="fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-800">{copy.title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{copy.subtitle}</p>
        </div>
        <div className="flex rounded-full bg-zinc-100 p-1">
          {TYPE_TABS.map((tTab) => (
            <button
              key={tTab.id}
              onClick={() => setType(tTab.id)}
              className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150"
              style={
                type === tTab.id
                  ? { backgroundColor: tTab.activeColor(accentColor), color: "white" }
                  : { color: "#52525b" }
              }
            >
              {tTab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150"
              style={
                range === r.id
                  ? { backgroundColor: "var(--org-primary, #0F2A3D)", color: "white" }
                  : { backgroundColor: "rgb(244 244 245)", color: "#52525b" }
              }
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, category, notes, or ~amount..."
            className="input w-full pr-8 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {searchLower.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500">
          {isAmountSearch
            ? `${visibleTxns.length} transaction${visibleTxns.length === 1 ? "" : "s"} within ${currency} ${Math.round(
                amountTolerance
              ).toLocaleString()} of ${currency} ${Math.round(targetAmount ?? 0).toLocaleString()}, closest first`
            : `${visibleTxns.length} match${visibleTxns.length === 1 ? "" : "es"} for "${search}"`}
        </p>
      )}

      <div className="relative mt-4">
        {/* Decorative flourish -- an ultra-faint cash-flow-shaped line drifting
            behind the card. Ambient only, never carries information. Sized to
            exactly match its parent (no negative inset, no >100% width) so it
            can never push the page wider than the viewport. */}
        <svg
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
          viewBox="0 0 900 300"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M -60 220 C 120 220, 160 60, 320 90 S 520 240, 680 80 S 860 40, 960 130"
            stroke="url(#txn-flow-gradient)"
            strokeWidth="2"
            strokeLinecap="round"
            className="flow-curve"
          />
          <defs>
            <linearGradient id="txn-flow-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--org-accent, #1E9E6B)" stopOpacity="0" />
              <stop offset="45%" stopColor="var(--org-accent, #1E9E6B)" stopOpacity="0.3" />
              <stop offset="75%" stopColor="var(--org-primary, #0F2A3D)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--org-primary, #0F2A3D)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* overflow-x-auto here (not on the page) is the right place for
            horizontal scrolling -- when there isn't room for all seven
            columns, the TABLE scrolls within its own card, sidebar and
            background stay put, instead of the whole page shifting sideways.
            The category picker below deliberately renders through a portal
            to <body> (see InlineCategoryPicker) specifically so it isn't
            clipped by this card's own scroll/rounded-corner boundary. */}
        <div className="card card-flat overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Category</th>
                {splitLanes ? (
                  <>
                    <th className="px-4 py-2 text-right">Debit</th>
                    <th className="px-4 py-2 text-right">Credit</th>
                  </>
                ) : (
                  <th className="px-4 py-2 text-right">Amount</th>
                )}
                <th className="px-4 py-2 text-right">Balance</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleTxns.map((t, i) => {
                const expanded = expandedId === t.id;
                return (
                  <Fragment key={t.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : t.id)}
                      className="line-in row-hover group cursor-pointer border-b border-zinc-100 text-[13px] last:border-0"
                      style={{
                        animationDelay: lineDelay(i),
                        backgroundColor: expanded ? "rgb(0 0 0 / 0.02)" : undefined,
                      }}
                    >
                      <td className="px-4 py-1.5 whitespace-nowrap text-zinc-500 transition-colors duration-150 group-hover:text-sky-600">
                        {t.txn_date}
                        {t.txn_time && <span className="ml-1 text-xs text-zinc-400">{t.txn_time}</span>}
                      </td>
                      <td className="px-4 py-1.5 break-words text-zinc-800 transition-colors duration-150 group-hover:text-violet-600">
                        {t.description}
                        {(t.notes || (t.note_breakdown && t.note_breakdown.length > 0)) && (
                          <span
                            title={t.notes ?? "Has a reconciling breakdown"}
                            className="ml-1.5 inline-block rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700"
                          >
                            noted
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-zinc-500" onClick={(e) => canRecategorize && e.stopPropagation()}>
                        {canRecategorize ? (
                          <div className="flex flex-col gap-1">
                            <InlineCategoryPicker
                              categories={categories}
                              preferredType={t.type === "credit" ? "income" : "expense"}
                              selectedId={t.category_id}
                              selectedLabel={categoryName(t.categories)}
                              onSelect={(id, label) => recategorize(t.id, id, label)}
                            />
                            {recategorizeError[t.id] && (
                              <span className="text-xs text-red-600">{recategorizeError[t.id]}</span>
                            )}
                          </div>
                        ) : (
                          categoryName(t.categories)
                        )}
                      </td>
                      {splitLanes ? (
                        <>
                          <td className="px-4 py-1.5 text-right font-medium text-zinc-800">
                            {t.type === "debit"
                              ? `${currency} ${Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                              : "--"}
                          </td>
                          <td className="px-4 py-1.5 text-right font-medium" style={{ color: accentColor }}>
                            {t.type === "credit"
                              ? `${currency} ${Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                              : "--"}
                          </td>
                        </>
                      ) : (
                        <td
                          className="px-4 py-1.5 text-right font-medium"
                          style={{ color: t.type === "credit" ? accentColor : "#27272a" }}
                        >
                          {t.type === "credit" ? "+" : "-"}
                          {currency} {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      <td className="px-4 py-1.5 text-right text-zinc-500">
                        {t.balance_after != null
                          ? `${currency} ${Number(t.balance_after).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : "--"}
                      </td>
                      <td className="px-4 py-1.5">
                        <StatusBadge status={t.status} />
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${t.id}-detail`} className="border-b border-zinc-100 last:border-0">
                        <td colSpan={colSpan} className="fade-in bg-zinc-50/60 px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <CollapsibleSection label="Transaction details">
                              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    Balance after
                                  </p>
                                  <p className="mt-1 text-zinc-700">
                                    {t.balance_after != null ? `${currency} ${Number(t.balance_after).toLocaleString()}` : "Not captured"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    {t.status === "flagged" ? "Flag reason" : "Confirmed"}
                                  </p>
                                  <p className="mt-1 text-zinc-700">
                                    {t.status === "flagged" ? t.flagged_reason ?? "Needs review" : t.confirmed_at ? new Date(t.confirmed_at).toLocaleString() : "--"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Transaction ID</p>
                                  <p className="mt-1 truncate font-mono text-xs text-zinc-500">{t.id}</p>
                                </div>
                              </div>
                              {t.raw_source_text && (
                                <div className="mt-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    Original bank alert
                                  </p>
                                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-600">
                                    {t.raw_source_text}
                                  </pre>
                                </div>
                              )}
                            </CollapsibleSection>

                            <NoteEditor
                              txn={t}
                              currency={currency}
                              allTransactions={txns}
                              authorName={t.notes_updated_by ? noteAuthorNameById[t.notes_updated_by] ?? "Someone" : null}
                              onSave={(notes, breakdown) => saveNote(t.id, notes, breakdown)}
                            />

                            {t.type === "credit" && (
                              <CollapsibleSection
                                label={`Spent from this inflow (${t.linked_expense_ids?.length ?? 0})`}
                              >
                                <InflowTracker
                                  inflow={t}
                                  allTransactions={txns}
                                  currency={currency}
                                  accentColor={accentColor}
                                  onSave={(ids) => setLinkedExpenses(t.id, ids)}
                                />
                              </CollapsibleSection>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {visibleTxns.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-center text-zinc-500">
                    {searchLower.length > 0
                      ? "No transactions match that search."
                      : `No ${type === "credit" ? "inflow" : type === "debit" ? "outflow" : "transactions"} in this range.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Each sub-panel inside an expanded row opens and closes independently --
// mounting fresh (closed) whenever a different row is expanded, since it's
// unmounted along with the rest of the detail row when collapsed.
function CollapsibleSection({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 transition-colors duration-150 hover:bg-zinc-50"
      >
        <span>{label}</span>
        <span
          className="text-zinc-400 transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          &#9662;
        </span>
      </button>
      {open && <div className="fade-in border-t border-zinc-100 p-3">{children}</div>}
    </div>
  );
}

// Always visible (not collapsed behind a toggle like the other detail
// sections) -- explaining what a transaction was for is the whole point of
// this feature, so it shouldn't need an extra click to even discover.
//
// The breakdown is deliberately structured like real bookkeeping: each line
// is either (a) a manual label + amount, for money that left the tracked
// ledger entirely, or (b) linked to a real transaction already in FinHive --
// picked via the search below, with its label and amount always shown as
// whatever that other transaction actually says (the server re-derives them
// too, so a linked line can never silently drift from the real record). The
// running total is checked against the transaction's own amount, so "what
// did this money go to" has to add up, not just be a paragraph someone
// typed once and forgot.
function NoteEditor({
  txn,
  currency,
  allTransactions,
  authorName,
  onSave,
}: {
  txn: Txn;
  currency: string;
  allTransactions: Txn[];
  authorName: string | null;
  onSave: (notes: string, breakdown: BreakdownItem[]) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [notesValue, setNotesValue] = useState(txn.notes ?? "");
  const [items, setItems] = useState<BreakdownItem[]>(txn.note_breakdown ?? []);
  const [linkSearch, setLinkSearch] = useState("");
  const [linking, setLinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(txn.notes_updated_at);

  const cleanItems = items.filter((it) => it.label.trim().length > 0 || it.amount > 0);
  const breakdownTotal = cleanItems.reduce((sum, it) => sum + (Number.isFinite(it.amount) ? it.amount : 0), 0);
  const difference = Number(txn.amount) - breakdownTotal;
  const hasBreakdown = cleanItems.length > 0;
  const reconciled = hasBreakdown && Math.abs(difference) < 0.005;

  const dirty =
    notesValue.trim() !== (txn.notes ?? "").trim() ||
    JSON.stringify(cleanItems) !== JSON.stringify(txn.note_breakdown ?? []);

  const linkedIds = new Set(items.map((it) => it.linkedTransactionId).filter((v): v is string => !!v));
  const linkSearchLower = linkSearch.trim().toLowerCase();
  const linkCandidates =
    linkSearchLower.length === 0
      ? []
      : allTransactions
          .filter((t) => t.id !== txn.id && !linkedIds.has(t.id) && t.description.toLowerCase().includes(linkSearchLower))
          .slice(0, 8);

  function updateManualItem(index: number, field: "label" | "amount", value: string) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, [field]: field === "amount" ? Number(value) || 0 : value } : it
      )
    );
  }

  function addManualItem() {
    setItems((prev) => [...prev, { label: "", amount: 0 }]);
  }

  function addLinkedItem(picked: Txn) {
    setItems((prev) => [
      ...prev,
      {
        label: `${picked.txn_date} · ${picked.description}`,
        amount: Number(picked.amount),
        linkedTransactionId: picked.id,
      },
    ]);
    setLinkSearch("");
    setLinking(false);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await onSave(notesValue, cleanItems);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save this note.");
      return;
    }
    setSavedAt(new Date().toISOString());
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Notes -- what was this for?
        </p>
        {authorName && savedAt && (
          <p className="text-xs text-zinc-400">
            Last updated by {authorName} &middot; {new Date(savedAt).toLocaleString()}
          </p>
        )}
      </div>
      <textarea
        value={notesValue}
        onChange={(e) => setNotesValue(e.target.value)}
        placeholder="e.g. Transfer to our savings account at another bank -- see breakdown below."
        rows={2}
        className="input mt-2 w-full resize-y"
      />

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Breakdown -- where the money actually went (should add up)
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {items.map((item, i) =>
          item.linkedTransactionId ? (
            <div key={i} className="flex items-center gap-2 rounded-md bg-sky-50/60 px-2 py-1.5">
              <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                linked
              </span>
              <span className="flex-1 truncate text-sm text-zinc-700">{item.label}</span>
              <span className="shrink-0 text-sm font-medium text-zinc-800">
                {currency} {item.amount.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                aria-label="Remove linked line"
                className="text-zinc-400 hover:text-red-600"
              >
                &times;
              </button>
            </div>
          ) : (
            <div key={i} className="flex items-center gap-2">
              <input
                value={item.label}
                onChange={(e) => updateManualItem(i, "label", e.target.value)}
                placeholder="e.g. Diesel restock"
                className="input flex-1 text-sm"
              />
              <input
                type="number"
                value={item.amount || ""}
                onChange={(e) => updateManualItem(i, "amount", e.target.value)}
                placeholder="Amount"
                className="input w-32 text-sm"
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                aria-label="Remove line"
                className="text-zinc-400 hover:text-red-600"
              >
                &times;
              </button>
            </div>
          )
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={addManualItem} className="text-xs font-medium" style={{ color: "var(--org-accent, #1E9E6B)" }}>
          + Add manual line
        </button>
        <button
          type="button"
          onClick={() => setLinking((v) => !v)}
          className="text-xs font-medium text-sky-700 hover:text-sky-800"
        >
          {linking ? "Cancel linking" : "+ Link a transaction"}
        </button>
      </div>

      {linking && (
        <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
          <input
            value={linkSearch}
            onChange={(e) => setLinkSearch(e.target.value)}
            placeholder="Search other transactions by description..."
            autoFocus
            className="input w-full text-sm"
          />
          {linkSearchLower.length > 0 && (
            <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-zinc-200 bg-white">
              {linkCandidates.length > 0 ? (
                linkCandidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => addLinkedItem(c)}
                    className="flex w-full items-center justify-between border-b border-zinc-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-zinc-100"
                  >
                    <span className="truncate text-zinc-700">
                      {c.txn_date} &middot; {c.description}
                    </span>
                    <span className="shrink-0 font-medium text-zinc-800">
                      {currency} {Number(c.amount).toLocaleString()}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-3 text-center text-xs text-zinc-400">No matching transactions.</p>
              )}
            </div>
          )}
        </div>
      )}

      {hasBreakdown && (
        <div
          className="mt-3 flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium"
          style={{
            backgroundColor: reconciled ? "rgb(16 185 129 / 0.08)" : "rgb(217 119 6 / 0.08)",
            color: reconciled ? "#047857" : "#92400E",
          }}
        >
          <span>
            Accounted for: {currency} {breakdownTotal.toLocaleString()} of {currency} {Number(txn.amount).toLocaleString()}
          </span>
          <span>
            {reconciled
              ? "Fully reconciled"
              : difference > 0
                ? `${currency} ${difference.toLocaleString()} unaccounted for`
                : `${currency} ${Math.abs(difference).toLocaleString()} over the transaction amount`}
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button onClick={handleSave} disabled={!dirty || saving} className="btn-primary text-xs">
          {saving ? "Saving..." : "Save note"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

// A compact version of the Flagged queue's jank-free CategoryPicker, meant to
// sit inline inside a table cell. The dropdown panel renders through a
// React portal straight into <body> rather than as a normal DOM child --
// deliberately, not for style. The table it lives in needs its own
// overflow-x-auto (so a wide row scrolls the table, not the whole page),
// and CSS makes overflow-x and overflow-y on the same box travel together:
// a box can't have one axis scrollable and the other truly unclipped. A
// portal sidesteps that entirely -- the panel is positioned via the
// button's on-screen coordinates (position: fixed) and painted outside the
// table's DOM subtree, so the table's scroll boundary never touches it.
function InlineCategoryPicker({
  categories,
  preferredType,
  selectedId,
  selectedLabel,
  onSelect,
}: {
  categories: Category[];
  preferredType: "income" | "expense";
  selectedId: string | null;
  selectedLabel: string;
  onSelect: (id: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    // Also close on scroll OUTSIDE the panel (of the table, the page,
    // anything) -- the panel's position is a one-time snapshot of the
    // button's coordinates, so it would otherwise visually detach from the
    // button it belongs to as soon as anything scrolls underneath it.
    // Scrolling WITHIN the panel itself (its own category list) must not
    // trigger this -- 'scroll' events don't bubble, so the only way to
    // catch "scrolled somewhere on the page" at all is a capture-phase
    // window listener, but that means the panel's own internal scroll
    // fires it too unless explicitly excluded here.
    function handleScroll(e: Event) {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  function toggleOpen() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((o) => !o);
  }

  const preferred = categories.filter((c) => c.type === preferredType);
  const other = categories.filter((c) => c.type !== preferredType);

  const panel = open && coords && (
    <div
      ref={panelRef}
      className="fade-in fixed z-50 max-h-64 w-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 text-left shadow-lg"
      style={{ top: coords.top, left: coords.left, overscrollBehavior: "contain" }}
    >
      {preferred.length > 0 && (
        <CategoryGroup
          categories={preferred}
          selected={selectedId ?? ""}
          onPick={(id, label) => {
            onSelect(id, label);
            setOpen(false);
          }}
        />
      )}
      {other.length > 0 && (
        <>
          <p className="mt-1 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Other</p>
          <CategoryGroup
            categories={other}
            selected={selectedId ?? ""}
            showType
            onPick={(id, label) => {
              onSelect(id, label);
              setOpen(false);
            }}
          />
        </>
      )}
      {categories.length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">No categories yet.</p>}
    </div>
  );

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-left transition-colors duration-150 hover:bg-zinc-100"
      >
        <span className={selectedId ? "text-zinc-700" : "text-zinc-400 italic"}>
          {selectedId ? selectedLabel : "Uncategorized"}
        </span>
        <span className="text-[10px] text-zinc-400">{open ? "▲" : "▼"}</span>
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

function CategoryGroup({
  categories,
  selected,
  onPick,
  showType,
}: {
  categories: Category[];
  selected: string;
  onPick: (id: string, label: string) => void;
  showType?: boolean;
}) {
  return (
    <>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.id, c.name)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100"
          style={c.id === selected ? { backgroundColor: "var(--org-accent, #1E9E6B)", color: "white" } : undefined}
        >
          <span>
            {c.name}
            {showType && <span className="ml-1 text-xs opacity-70">({c.type})</span>}
          </span>
        </button>
      ))}
    </>
  );
}

function InflowTracker({
  inflow,
  allTransactions,
  currency,
  accentColor,
  onSave,
}: {
  inflow: Txn;
  allTransactions: Txn[];
  currency: string;
  accentColor: string;
  onSave: (ids: string[]) => void;
}) {
  const [linkedIds, setLinkedIds] = useState<string[]>(inflow.linked_expense_ids ?? []);
  const [search, setSearch] = useState("");

  const linkedExpenses = allTransactions.filter((t) => linkedIds.includes(t.id));
  const linkedTotal = linkedExpenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const remaining = Number(inflow.amount) - linkedTotal;
  const unlinked = allTransactions.filter(
    (t) => t.type === "debit" && !linkedIds.includes(t.id) && t.description.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: string) {
    const next = linkedIds.includes(id) ? linkedIds.filter((i) => i !== id) : [...linkedIds, id];
    setLinkedIds(next);
    onSave(next);
  }

  return (
    <div className="fade-in mt-4 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Spent from this inflow ({linkedExpenses.length})
        </p>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-500">
            Spent: <span className="font-medium text-zinc-800">{currency} {linkedTotal.toLocaleString()}</span>
          </span>
          <span className="font-medium" style={{ color: remaining >= 0 ? accentColor : "#DC2626" }}>
            Remaining: {currency} {remaining.toLocaleString()}
          </span>
        </div>
      </div>

      {linkedExpenses.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {linkedExpenses.map((t, i) => (
            <div
              key={t.id}
              className="line-in row-hover flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm"
              style={{ animationDelay: lineDelay(i) }}
            >
              <span className="text-zinc-700">
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
      )}

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Link an expense</p>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search expenses by description..."
        className="input mt-2 w-full"
      />
      <div className="mt-2 max-h-48 overflow-auto rounded-md border border-zinc-200">
        {unlinked.length > 0 ? (
          unlinked.slice(0, 20).map((t, i) => (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className="line-in row-hover flex w-full items-center justify-between border-b border-zinc-100 px-3 py-2 text-left text-sm last:border-0"
              style={{ animationDelay: lineDelay(i) }}
            >
              <span className="text-zinc-700">
                {t.txn_date} &middot; {t.description}
              </span>
              <span className="font-medium text-zinc-800">
                {currency} {Number(t.amount).toLocaleString()}
              </span>
            </button>
          ))
        ) : (
          <p className="px-3 py-4 text-center text-sm text-zinc-400">No matching unlinked expenses in this view.</p>
        )}
      </div>
    </div>
  );
}
