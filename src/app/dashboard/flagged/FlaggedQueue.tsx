"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { lineDelay } from "@/lib/lineDelay";

interface FlaggedTxn {
  id: string;
  txn_date: string;
  type: "credit" | "debit";
  description: string;
  amount: number;
  flagged_reason: string | null;
  raw_source_text: string | null;
}

interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
}

export default function FlaggedQueue({
  organizationId,
  currency,
  initialFlagged,
  categories,
  canCreateCategory,
  currentProfileId,
}: {
  organizationId: string;
  currency: string;
  initialFlagged: FlaggedTxn[];
  categories: Category[];
  canCreateCategory: boolean;
  currentProfileId: string;
}) {
  const supabase = createClient();
  const [flagged, setFlagged] = useState<FlaggedTxn[]>(initialFlagged);
  const [allCategories, setAllCategories] = useState<Category[]>(categories);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Both confirm() and confirmBulk() go through the same server-side route
  // instead of updating the transactions table directly -- that's what makes
  // the approval-threshold gate, the audit trail, and the self-improving
  // category_rules all actually apply here, not just from the ingest path.
  async function confirmOne(txnId: string, categoryId: string): Promise<{ ok: boolean; status?: string; error?: string }> {
    const res = await fetch("/api/transactions/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: txnId, categoryId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error ?? "Couldn't confirm this transaction." };
    return { ok: true, status: body.status };
  }

  async function confirmBulk() {
    if (!bulkCategory || checked.size === 0) return;
    setBulkBusy(true);
    setError("");
    const ids = Array.from(checked);

    const results = await Promise.all(ids.map((id) => confirmOne(id, bulkCategory)));
    const failed = results.find((r) => !r.ok);

    setBulkBusy(false);
    if (failed) return setError(failed.error ?? "Some transactions couldn't be confirmed.");

    setFlagged((prev) => prev.filter((t) => !ids.includes(t.id)));
    setChecked(new Set());
    setBulkCategory("");
  }

  async function confirm(txnId: string) {
    const categoryId = selections[txnId];
    if (!categoryId) return;
    setError("");

    const result = await confirmOne(txnId, categoryId);
    if (!result.ok) return setError(result.error ?? "Couldn't confirm this transaction.");
    setFlagged((prev) => prev.filter((t) => t.id !== txnId));
  }

  async function createCategoryAndSelect(txnId: string, name: string, type: "income" | "expense") {
    if (!name.trim()) return;
    setError("");
    const { data, error: err } = await supabase
      .from("categories")
      .insert({ organization_id: organizationId, name: name.trim(), type })
      .select("id, name, type")
      .single();

    if (err) return setError(err.message);
    setAllCategories((prev) => [...prev, data as Category]);
    setSelections((prev) => ({ ...prev, [txnId]: data.id }));
  }

  return (
    <div className="fade-in pb-20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-zinc-800">Flagged transactions</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Never force a guess -- confirm the right category, or create a new one on the spot.
          </p>
        </div>
        {flagged.length > 0 && (
          <button
            onClick={() =>
              setChecked((prev) =>
                prev.size === flagged.length ? new Set() : new Set(flagged.map((t) => t.id))
              )
            }
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
          >
            {checked.size === flagged.length ? "Clear selection" : "Select all"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-col gap-3">
        {flagged.map((t, i) => (
          <FlaggedRow
            key={t.id}
            txn={t}
            index={i}
            currency={currency}
            categories={allCategories}
            canCreateCategory={canCreateCategory}
            selected={selections[t.id] ?? ""}
            onSelect={(id) => setSelections((prev) => ({ ...prev, [t.id]: id }))}
            onConfirm={() => confirm(t.id)}
            onCreateCategory={(name, type) => createCategoryAndSelect(t.id, name, type)}
            isChecked={checked.has(t.id)}
            onToggleChecked={() => toggleChecked(t.id)}
          />
        ))}
        {flagged.length === 0 && (
          <p className="rounded-lg border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            Nothing flagged right now.
          </p>
        )}
      </div>

      {checked.size > 0 && (
        <div className="fade-in fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-5 sm:pl-[17rem]">
          <div
            className="flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-xl border border-zinc-200/80 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-md"
          >
            <span className="text-sm font-medium text-zinc-800">
              {checked.size} selected
            </span>
            <div className="flex-1 min-w-[160px]">
              <CategoryPicker
                categories={allCategories}
                preferredType="expense"
                selected={bulkCategory}
                onSelect={setBulkCategory}
              />
            </div>
            <button
              onClick={confirmBulk}
              disabled={!bulkCategory || bulkBusy}
              className="btn-primary"
            >
              {bulkBusy ? "Applying..." : "Apply & confirm"}
            </button>
            <button onClick={() => setChecked(new Set())} className="btn-secondary">
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FlaggedRow({
  txn,
  index,
  currency,
  categories,
  canCreateCategory,
  selected,
  onSelect,
  onConfirm,
  onCreateCategory,
  isChecked,
  onToggleChecked,
}: {
  txn: FlaggedTxn;
  index: number;
  currency: string;
  categories: Category[];
  canCreateCategory: boolean;
  selected: string;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  onCreateCategory: (name: string, type: "income" | "expense") => void;
  isChecked: boolean;
  onToggleChecked: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"income" | "expense">(
    txn.type === "credit" ? "income" : "expense"
  );

  return (
    <div
      className="card line-in p-4"
      style={{
        animationDelay: lineDelay(index),
        outline: isChecked ? "2px solid var(--org-accent, #1E9E6B)" : undefined,
        outlineOffset: isChecked ? "-1px" : undefined,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={onToggleChecked}
            className="mt-1 h-4 w-4 shrink-0 accent-current"
            style={{ color: "var(--org-accent, #1E9E6B)" }}
          />
          <div>
            <p className="break-words font-medium text-zinc-800">{txn.description}</p>
            <p className="text-xs text-zinc-500">
              {txn.txn_date} &middot; {txn.type} &middot; {currency} {txn.amount.toLocaleString()}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
          Needs review
        </span>
      </div>

      {txn.flagged_reason && (
        <div className="mt-3 flex items-start gap-2 rounded-md border-l-4 border-amber-400 bg-amber-50 px-3 py-2">
          <span aria-hidden className="mt-0.5 shrink-0 text-sm leading-none text-amber-500">
            &#9888;
          </span>
          <p className="text-sm leading-snug text-amber-900">{txn.flagged_reason}</p>
        </div>
      )}

      {!creating ? (
        <div className="mt-3 flex items-center gap-2">
          <CategoryPicker
            categories={categories}
            preferredType={txn.type === "credit" ? "income" : "expense"}
            selected={selected}
            onSelect={onSelect}
          />
          <button onClick={onConfirm} disabled={!selected} className="btn-primary">
            Confirm
          </button>
          {canCreateCategory && (
            <button onClick={() => setCreating(true)} className="btn-secondary">
              New category
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="New category name"
            className="input flex-1"
          />
          <select value={newCatType} onChange={(e) => setNewCatType(e.target.value as "income" | "expense")} className="input">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <button
            onClick={() => {
              onCreateCategory(newCatName, newCatType);
              setCreating(false);
              setNewCatName("");
            }}
            className="btn-primary"
          >
            Create
          </button>
          <button onClick={() => setCreating(false)} className="btn-secondary">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// A fully custom-styled dropdown, deliberately not a native <select>/<option>.
// Native option lists are rendered by the OS (not the page), so their colors
// can't be reliably controlled with CSS -- this guarantees consistent
// contrast on every browser and platform.
//
// The panel uses a plain bordered surface (no `.card` hover-lift) and options
// use a flat `hover:bg-zinc-100` (no `.row-hover` transform) -- both reused
// generic classes caused visible jank while scrolling through a compact list,
// since the hover target kept changing row-to-row while both effects fired.
function CategoryPicker({
  categories,
  preferredType,
  selected,
  onSelect,
}: {
  categories: Category[];
  preferredType: "income" | "expense";
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const preferred = categories.filter((c) => c.type === preferredType);
  const other = categories.filter((c) => c.type !== preferredType);
  const selectedCategory = categories.find((c) => c.id === selected);

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex w-full items-center justify-between text-left"
      >
        <span className={selectedCategory ? "text-zinc-800" : "text-zinc-500"}>
          {selectedCategory ? selectedCategory.name : "Choose category..."}
        </span>
        <span className="text-zinc-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          className="fade-in absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
          style={{ overscrollBehavior: "contain" }}
        >
          {preferred.length > 0 && (
            <CategoryGroup
              categories={preferred}
              selected={selected}
              onPick={(id) => {
                onSelect(id);
                setOpen(false);
              }}
            />
          )}
          {other.length > 0 && (
            <>
              <p className="mt-1 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Other
              </p>
              <CategoryGroup
                categories={other}
                selected={selected}
                showType
                onPick={(id) => {
                  onSelect(id);
                  setOpen(false);
                }}
              />
            </>
          )}
          {categories.length === 0 && (
            <p className="px-3 py-2 text-sm text-zinc-500">No categories yet.</p>
          )}
        </div>
      )}
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
  onPick: (id: string) => void;
  showType?: boolean;
}) {
  return (
    <>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.id)}
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
