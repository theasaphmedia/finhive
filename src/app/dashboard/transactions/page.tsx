import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewerContext, isFullAccess, canManageOrg } from "@/lib/getViewerContext";
import TransactionsTable from "./TransactionsTable";

function rangeFromDate(range: string): string | null {
  if (range === "all") return null;
  const from = new Date();
  switch (range) {
    case "1m":
      from.setMonth(from.getMonth() - 1);
      break;
    case "6m":
      from.setMonth(from.getMonth() - 6);
      break;
    case "1y":
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "3m":
    default:
      from.setMonth(from.getMonth() - 3);
      break;
  }
  return from.toISOString().slice(0, 10);
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; type?: string }>;
}) {
  const { profile, organization } = await requireViewerContext();
  if (!isFullAccess(profile)) redirect("/dashboard");

  const params = await searchParams;
  const range = params.range ?? "3m";
  const type = params.type ?? "all";

  const supabase = await createClient();

  // Note: intentionally NOT filtering by type at the query level. The Inflow
  // tab's "link an expense" search needs access to debit transactions even
  // though only credit rows are shown -- so both types always come down
  // together, and the type tab only controls which rows are *displayed*.
  let query = supabase
    .from("transactions")
    .select(
      "id, txn_date, txn_time, type, description, amount, balance_after, status, flagged_reason, raw_source_text, confirmed_at, linked_expense_ids, category_id, notes, note_breakdown, notes_updated_by, notes_updated_at, categories(name)"
    )
    .eq("organization_id", organization.id)
    .order("txn_date", { ascending: false })
    .limit(500);

  const fromDate = rangeFromDate(range);
  if (fromDate) query = query.gte("txn_date", fromDate);

  // Anyone trusted to categorize a flagged transaction is trusted to fix a
  // miscategorized confirmed one too -- same permission the confirm/approve
  // routes already use, just applied to transactions that aren't flagged.
  const canRecategorize = canManageOrg(profile) || profile.can_confirm_flags;

  const [{ data: transactions }, { data: categories }] = await Promise.all([
    query,
    canRecategorize
      ? supabase
          .from("categories")
          .select("id, name, type")
          .eq("organization_id", organization.id)
          .eq("is_archived", false)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  // Resolve "who wrote this note" names in one extra round trip, same
  // pattern the Approvals page uses for "who confirmed this" -- cheaper than
  // a join, and only runs the query when there's actually a note to label.
  const noteAuthorIds = Array.from(
    new Set((transactions ?? []).map((t) => t.notes_updated_by).filter((v): v is string => !!v))
  );
  const { data: noteAuthors } =
    noteAuthorIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", noteAuthorIds)
      : { data: [] as { id: string; name: string }[] };
  const noteAuthorNameById = Object.fromEntries((noteAuthors ?? []).map((p) => [p.id, p.name]));

  return (
    <TransactionsTable
      transactions={(transactions ?? []) as unknown as import("./TransactionsTable").Txn[]}
      currency={organization.currency}
      accentColor={organization.brand_accent_color}
      range={range}
      type={type}
      categories={categories ?? []}
      canRecategorize={canRecategorize}
      noteAuthorNameById={noteAuthorNameById}
    />
  );
}
