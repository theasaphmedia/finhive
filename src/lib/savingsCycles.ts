// Shared cycle math for rotating savings groups (ajo/esusu/susu). A group has
// no explicit "current cycle" column -- it's always derived from start_date +
// cycle_frequency + today, so there's nothing to keep in sync and no cron job
// required to "advance" a cycle. Used both server-side (to know which
// cycle's contribution rows to ensure exist) and client-side (to label the
// current cycle and compute whose turn it is for payout).
export function currentCycleNumber(startDate: string, frequency: "weekly" | "monthly", now: Date = new Date()): number {
  const start = new Date(startDate + "T00:00:00Z");
  if (now <= start) return 1;

  if (frequency === "weekly") {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    return Math.floor((now.getTime() - start.getTime()) / msPerWeek) + 1;
  }

  // monthly: count calendar-month boundaries crossed, not just 30-day chunks,
  // so "the 3rd of every month" style groups line up with real months.
  const months =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - start.getUTCMonth()) -
    (now.getUTCDate() < start.getUTCDate() ? 1 : 0);
  return Math.max(months, 0) + 1;
}

// Whose turn is it to receive the pot this cycle, given N members in
// payout_position order (1-indexed) and the current cycle number.
export function payoutPositionForCycle(cycleNumber: number, memberCount: number): number {
  if (memberCount <= 0) return 0;
  return ((cycleNumber - 1) % memberCount) + 1;
}
