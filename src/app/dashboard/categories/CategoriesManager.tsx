"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { lineDelay } from "@/lib/lineDelay";

interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string | null;
  sort_order: number;
  is_archived: boolean;
}

interface Rule {
  id: string;
  keyword: string;
  category_id: string;
}

interface Budget {
  id: string;
  category_id: string;
  monthly_limit: number;
}

export default function CategoriesManager({
  organizationId,
  currency,
  initialCategories,
  initialRules,
  initialBudgets,
}: {
  organizationId: string;
  currency: string;
  initialCategories: Category[];
  initialRules: Rule[];
  initialBudgets: Budget[];
}) {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"income" | "expense">("expense");
  const [newKeyword, setNewKeyword] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState("");
  const [error, setError] = useState("");

  const active = categories.filter((c) => !c.is_archived).sort((a, b) => a.sort_order - b.sort_order);
  const archived = categories.filter((c) => c.is_archived);
  const expenseCategories = active.filter((c) => c.type === "expense");

  async function addCategory() {
    if (!newName.trim()) return;
    setError("");
    const sortOrder = active.length > 0 ? Math.max(...active.map((c) => c.sort_order)) + 1 : 0;
    const { data, error: err } = await supabase
      .from("categories")
      .insert({ organization_id: organizationId, name: newName.trim(), type: newType, sort_order: sortOrder })
      .select()
      .single();
    if (err) return setError(err.message);
    setCategories((prev) => [...prev, data as Category]);
    setNewName("");
  }

  async function renameCategory(id: string, name: string) {
    setError("");
    const { error: err } = await supabase.from("categories").update({ name }).eq("id", id);
    if (err) return setError(err.message);
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }

  async function toggleArchive(id: string, isArchived: boolean) {
    setError("");
    const { error: err } = await supabase
      .from("categories")
      .update({ is_archived: !isArchived })
      .eq("id", id);
    if (err) return setError(err.message);
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, is_archived: !isArchived } : c)));
  }

  async function move(id: string, direction: -1 | 1) {
    const idx = active.findIndex((c) => c.id === id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= active.length) return;

    const a = active[idx];
    const b = active[swapIdx];

    setError("");
    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      supabase.from("categories").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("categories").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (err1 || err2) return setError(err1?.message ?? err2?.message ?? "Reorder failed");

    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === a.id) return { ...c, sort_order: b.sort_order };
        if (c.id === b.id) return { ...c, sort_order: a.sort_order };
        return c;
      })
    );
  }

  async function addRule() {
    if (!newKeyword.trim() || !newRuleCategory) return;
    setError("");
    const { data, error: err } = await supabase
      .from("category_rules")
      .insert({ organization_id: organizationId, keyword: newKeyword.trim(), category_id: newRuleCategory })
      .select()
      .single();
    if (err) return setError(err.message);
    setRules((prev) => [...prev, data as Rule]);
    setNewKeyword("");
  }

  async function deleteRule(id: string) {
    setError("");
    const { error: err } = await supabase.from("category_rules").delete().eq("id", id);
    if (err) return setError(err.message);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function setBudget(categoryId: string, monthlyLimit: number | null) {
    setError("");
    const existing = budgets.find((b) => b.category_id === categoryId);

    if (monthlyLimit === null) {
      if (!existing) return;
      const { error: err } = await supabase.from("budgets").delete().eq("id", existing.id);
      if (err) return setError(err.message);
      setBudgets((prev) => prev.filter((b) => b.id !== existing.id));
      return;
    }

    if (existing) {
      const { error: err } = await supabase
        .from("budgets")
        .update({ monthly_limit: monthlyLimit })
        .eq("id", existing.id);
      if (err) return setError(err.message);
      setBudgets((prev) => prev.map((b) => (b.id === existing.id ? { ...b, monthly_limit: monthlyLimit } : b)));
    } else {
      const { data, error: err } = await supabase
        .from("budgets")
        .insert({ organization_id: organizationId, category_id: categoryId, monthly_limit: monthlyLimit })
        .select()
        .single();
      if (err) return setError(err.message);
      setBudgets((prev) => [...prev, data as Budget]);
    }
  }

  return (
    <div className="fade-in flex flex-col gap-10">
      <div>
        <h2 className="text-base font-semibold text-zinc-800">Categories</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Add, rename, archive, or reorder categories. Historical transactions keep their
          categorization even after a rename or archive.
        </p>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="card card-flat mt-4 flex flex-col gap-2">
          {active.map((c, i) => (
            <div
              key={c.id}
              className="line-in row-hover flex items-center gap-3 rounded-md border-b border-zinc-100 px-4 py-2 text-[13px] last:border-0"
              style={{ animationDelay: lineDelay(i) }}
            >
              <div className="flex flex-col">
                <button
                  disabled={i === 0}
                  onClick={() => move(c.id, -1)}
                  aria-label={`Move ${c.name} up`}
                  className="text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-30"
                >
                  &uarr;
                </button>
                <button
                  disabled={i === active.length - 1}
                  onClick={() => move(c.id, 1)}
                  aria-label={`Move ${c.name} down`}
                  className="text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-30"
                >
                  &darr;
                </button>
              </div>
              <input
                defaultValue={c.name}
                onBlur={(e) => e.target.value !== c.name && renameCategory(c.id, e.target.value)}
                className="flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-800 transition-colors duration-150 hover:border-zinc-200 focus:outline-none"
                style={{ borderColor: "transparent" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--org-accent, #1E9E6B)")}
                onBlurCapture={(e) => (e.target.style.borderColor = "transparent")}
              />
              <span className={c.type === "income" ? "badge-accent" : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500"}>
                {c.type}
              </span>
              <button
                onClick={() => toggleArchive(c.id, c.is_archived)}
                className="text-xs font-medium text-zinc-500 transition-colors hover:text-red-600"
              >
                Archive
              </button>
            </div>
          ))}
          {active.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">No categories yet.</p>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            className="input flex-1"
          />
          <select value={newType} onChange={(e) => setNewType(e.target.value as "income" | "expense")} className="input">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <button onClick={addCategory} className="btn-primary">
            Add
          </button>
        </div>

        {archived.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Archived</p>
            <div className="mt-2 flex flex-col gap-1">
              {archived.map((c) => (
                <div key={c.id} className="row-hover flex items-center justify-between rounded px-2 py-1 text-sm text-zinc-500">
                  <span>{c.name}</span>
                  <button
                    onClick={() => toggleArchive(c.id, c.is_archived)}
                    className="text-xs font-medium"
                    style={{ color: "var(--org-accent, #1E9E6B)" }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-base font-semibold text-zinc-800">Monthly budgets</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Set a monthly ceiling per expense category. The moment an incoming transaction pushes a
          category over its limit, every owner and admin gets notified automatically. Leave blank
          for no limit.
        </p>

        <div className="card card-flat mt-4 flex flex-col gap-2">
          {expenseCategories.map((c, i) => {
            const budget = budgets.find((b) => b.category_id === c.id);
            return (
              <div
                key={c.id}
                className="line-in row-hover flex items-center justify-between gap-3 rounded-md border-b border-zinc-100 px-4 py-2 text-[13px] last:border-0"
                style={{ animationDelay: lineDelay(i) }}
              >
                <span className="font-medium text-zinc-800">{c.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{currency}</span>
                  <input
                    type="number"
                    key={`${c.id}-${budget?.monthly_limit ?? ""}`}
                    defaultValue={budget?.monthly_limit ?? ""}
                    placeholder="No limit"
                    onBlur={(e) => {
                      const raw = e.target.value;
                      const value = raw === "" ? null : Number(raw);
                      if (value !== (budget?.monthly_limit ?? null)) setBudget(c.id, value);
                    }}
                    className="input w-32"
                  />
                  <span className="text-xs text-zinc-500">/mo</span>
                </div>
              </div>
            );
          })}
          {expenseCategories.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">No expense categories yet.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-zinc-800">Keyword rules</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Optional -- speeds up auto-categorization during ingestion. If no rule matches, Claude
          picks against your category list directly.
        </p>

        <div className="card card-flat mt-4 flex flex-col gap-2">
          {rules.map((r, i) => (
            <div
              key={r.id}
              className="line-in row-hover flex items-center justify-between rounded-md border-b border-zinc-100 px-4 py-2 text-[13px] last:border-0"
              style={{ animationDelay: lineDelay(i) }}
            >
              <span>
                <span className="font-medium text-zinc-800">&quot;{r.keyword}&quot;</span>
                <span className="text-zinc-500"> &rarr; </span>
                {categories.find((c) => c.id === r.category_id)?.name ?? "Unknown category"}
              </span>
              <button onClick={() => deleteRule(r.id)} className="text-xs font-medium text-zinc-500 hover:text-red-600">
                Remove
              </button>
            </div>
          ))}
          {rules.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">
              No keyword rules yet -- confirming a flagged transaction now creates one automatically.
            </p>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder='Keyword, e.g. "diesel"'
            className="input flex-1"
          />
          <select value={newRuleCategory} onChange={(e) => setNewRuleCategory(e.target.value)} className="input">
            <option value="">Choose category</option>
            {active.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button onClick={addRule} className="btn-primary">
            Add rule
          </button>
        </div>
      </div>
    </div>
  );
}
