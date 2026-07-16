// Thin wrapper around the Anthropic Messages API using plain fetch (no SDK
// dependency, to keep the ingestion route's footprint small). Requires
// ANTHROPIC_API_KEY to be set server-side.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

async function callClaude(system: string, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY env var.");
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
  return textBlock?.text ?? "";
}

// Strips markdown code fences etc, in case the model wraps its JSON reply.
function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return fenced ? fenced[1] : trimmed;
}

export interface ExtractedTransaction {
  type: "credit" | "debit";
  amount: number;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM:SS or null
  description: string;
  balance_after: number | null;
}

// Generic, bank-agnostic extraction prompt (Build Spec Section 4). Works against
// SMS-forwarded alerts or native bank emails, from any bank, any format.
export async function extractTransactionFromAlert(
  rawText: string
): Promise<ExtractedTransaction | null> {
  const system = `You are a data extraction engine for bank transaction alerts. You will be given
raw text from a bank alert email or forwarded SMS -- it could be from any bank, in any format,
in any country. Extract the transaction details and respond with ONLY a JSON object, no prose,
no markdown fences, matching exactly this shape:

{
  "type": "credit" | "debit",
  "amount": number,
  "date": "YYYY-MM-DD",
  "time": "HH:MM:SS" | null,
  "description": string,
  "balance_after": number | null
}

If you cannot confidently extract a real transaction from this text (e.g. it's not actually a
bank alert, or the amount/type is unclear), respond with exactly: {"error": "not_a_transaction"}`;

  const raw = await callClaude(system, rawText);
  const jsonText = extractJson(raw);

  try {
    const parsed = JSON.parse(jsonText);
    if (parsed.error) return null;
    if (typeof parsed.amount !== "number" || !parsed.type || !parsed.date) return null;
    return parsed as ExtractedTransaction;
  } catch {
    return null;
  }
}

export interface CategoryOption {
  id: string;
  name: string;
  type: "income" | "expense";
}

export interface CategorizationResult {
  categoryId: string | null;
  uncertain: boolean;
  reason?: string;
}

// Asks Claude to pick the best-fitting category from the ORG'S OWN current list --
// never a hardcoded list. If nothing fits well, it should say so rather than guess
// (Build Spec Section 3, step 2-3).
export async function categorizeTransaction(
  description: string,
  transactionType: "credit" | "debit",
  categories: CategoryOption[]
): Promise<CategorizationResult> {
  if (categories.length === 0) {
    return { categoryId: null, uncertain: true, reason: "Organization has no categories yet." };
  }

  const categoryList = categories
    .map((c) => `- id: ${c.id}, name: "${c.name}", type: ${c.type}`)
    .join("\n");

  const system = `You categorize financial transactions for an organization using ONLY the
category list they provide below -- never invent a new category name. Respond with ONLY a
JSON object of the shape:

{ "category_id": string | null, "uncertain": boolean, "reason": string | null }

Pick the single best-fitting category id from the list for this ${transactionType} transaction.
If nothing fits well, or you're not confident, set "uncertain": true, "category_id": null, and
briefly explain why in "reason". Only pick categories whose "type" matches the transaction type
(credit transactions should map to income categories, debit to expense categories) unless
nothing of that type fits at all.

Available categories:
${categoryList}`;

  const raw = await callClaude(system, `Transaction description: "${description}"`);
  const jsonText = extractJson(raw);

  try {
    const parsed = JSON.parse(jsonText);
    return {
      categoryId: parsed.category_id ?? null,
      uncertain: Boolean(parsed.uncertain) || !parsed.category_id,
      reason: parsed.reason ?? undefined,
    };
  } catch {
    return { categoryId: null, uncertain: true, reason: "Could not parse categorization response." };
  }
}
