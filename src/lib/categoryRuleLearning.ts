import { createAdminClient } from "@/lib/supabase/admin";

// Common transaction-description noise words that make bad keywords on
// their own (too generic to reliably identify a specific payee/purpose).
const STOPWORDS = new Set([
  "transfer", "trf", "payment", "being", "from", "to", "for", "the", "and",
  "with", "ref", "reference", "narration", "pos", "purchase", "debit",
  "credit", "bank", "account", "acct", "value", "date", "via", "inflow",
  "outflow", "trans", "transaction", "charge", "charges", "fee", "fees",
]);

// Picks the most distinctive word in a transaction description to use as a
// case-insensitive substring keyword -- the same matching rule the ingestion
// pipeline already uses for manually-created category_rules. Deliberately
// conservative: prefers the longest alphabetic token, skips anything
// numeric or too short/generic to mean something on its own.
export function extractKeyword(description: string): string | null {
  const tokens = description
    .split(/[^a-zA-Z]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));

  if (tokens.length === 0) return null;
  return tokens.sort((a, b) => b.length - a.length)[0];
}

// Called after a human confirms a category for a transaction that didn't
// already match a rule -- silently teaches FinHive so the *next* similar
// transaction doesn't need review at all. Conservative on purpose: never
// overwrites an existing rule (even one pointing at a different category),
// since that would be silently changing behavior a human set up on purpose.
// Uses the service-role client because category_rules INSERT is owner/admin
// only under RLS, but any can-confirm-flags stakeholder can trigger this.
export async function learnCategoryRule(params: {
  organizationId: string;
  description: string;
  categoryId: string;
}) {
  const keyword = extractKeyword(params.description);
  if (!keyword) return;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("category_rules")
    .select("id")
    .eq("organization_id", params.organizationId)
    .ilike("keyword", keyword)
    .maybeSingle();

  if (existing) return;

  await admin.from("category_rules").insert({
    organization_id: params.organizationId,
    category_id: params.categoryId,
    keyword,
  });
}
