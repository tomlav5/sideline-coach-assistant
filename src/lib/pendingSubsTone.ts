/**
 * How loudly the live screen should talk about staged substitutions (UX-043).
 *
 * - `pending`  — a period is in play and the oldest pair has waited under 60s.
 * - `critical` — a period is in play and the oldest pair has waited 60s or more.
 *   Unchanged from UX-007: a forgotten pair mid-period leaves the on-screen pitch
 *   disagreeing with the real one and keeps accruing minutes to the player who
 *   has already come off, and nothing else will commit it.
 * - `break`    — no period is in play. Auto-apply (UX-039 phase 1) commits the
 *   pairs the moment the next period starts, so there is nothing to be late for
 *   and the escalation would be a false alarm.
 *
 * `periodOpen` must come from `isPeriodOpen` (lib/periodOpen.ts), i.e. keyed on
 * `actual_end_time` — NOT `is_active` and NOT the timer's running flag, both of
 * which are false while a period is merely paused.
 */
export type PendingSubsTone = 'pending' | 'break' | 'critical';

/** Seconds the oldest staged pair may wait mid-period before the critical state. */
export const PENDING_CRITICAL_SECONDS = 60;

export function pendingSubsTone(waitedSeconds: number, periodOpen: boolean): PendingSubsTone {
  if (!periodOpen) return 'break';
  return waitedSeconds >= PENDING_CRITICAL_SECONDS ? 'critical' : 'pending';
}

/**
 * The toast for a Submit pressed from the action bar while no period is open.
 * Nothing was written and nothing was unstaged — the pairs are exactly where the
 * coach left them and auto-apply will commit them at the next Start Period — so
 * this is a confirmation, not a warning. Deliberately NOT the NoOpenPeriodError
 * message: that one is worded as a refusal, which is right for other callers
 * (the End Match guard, auto-apply) but wrong as the answer to an action the
 * coach got right. Says "next period", never "half time" — a match may have
 * three or four periods (UX-039).
 */
export function breakSubmitToast(count: number): { title: string; description: string } {
  const noun = count === 1 ? 'substitution is' : `${count} substitutions are`;
  return {
    title: 'Ready for the next period',
    description: `Your ${noun} saved and will go on as soon as you press Start Period.`,
  };
}
