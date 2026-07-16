export type PeriodId = "weekly" | "monthly" | "quarterly" | "6month" | "yearly" | "custom";

export const PERIOD_LABELS: Record<PeriodId, string> = {
  weekly: "Weekly (last 7 days)",
  monthly: "Monthly (last 30 days)",
  quarterly: "Quarterly (last 3 months)",
  "6month": "6 Months",
  yearly: "Yearly (last 12 months)",
  custom: "Custom range",
};

export function getPeriodRange(
  period: PeriodId,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  const today = new Date();
  const to = customTo && period === "custom" ? customTo : today.toISOString().slice(0, 10);

  if (period === "custom" && customFrom) {
    return { from: customFrom, to };
  }

  const from = new Date(today);
  switch (period) {
    case "weekly":
      from.setDate(from.getDate() - 7);
      break;
    case "monthly":
      from.setMonth(from.getMonth() - 1);
      break;
    case "quarterly":
      from.setMonth(from.getMonth() - 3);
      break;
    case "6month":
      from.setMonth(from.getMonth() - 6);
      break;
    case "yearly":
      from.setFullYear(from.getFullYear() - 1);
      break;
    default:
      from.setMonth(from.getMonth() - 1);
  }

  return { from: from.toISOString().slice(0, 10), to };
}
