// Computes a per-row animation-delay for the .line-in CSS class so each
// individual row in a list (a transaction, a client, a person) visibly
// animates in on its own turn, one after another, rather than the whole
// list appearing to move as one block. The step (90ms) is deliberately
// larger than the animation's own duration (see .line-in, ~180ms) so each
// row's motion has mostly finished before the next one starts -- that gap
// is what makes it read as "each line, one at a time" instead of a single
// simultaneous fade. Capped so a long list (200 transactions) doesn't take
// forever for the last row -- fine since anything past the cap is already
// scrolled off-screen at initial paint anyway.
export function lineDelay(index: number, stepMs = 90, maxMs = 1400): string {
  return `${Math.min(index * stepMs, maxMs)}ms`;
}
