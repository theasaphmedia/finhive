// Whether a debit needs a second, different owner/admin to approve before it
// counts as confirmed. Only debits are gated -- credits (money coming in)
// aren't the risk this exists for.
export function needsApproval(
  approvalThreshold: number | null,
  type: "credit" | "debit",
  amount: number
): boolean {
  if (approvalThreshold === null) return false;
  return type === "debit" && amount >= approvalThreshold;
}
