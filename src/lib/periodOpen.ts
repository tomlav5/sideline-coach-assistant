/**
 * Whether a `match_periods` row is still running, so a player spell may be
 * opened in it (BUG-041).
 *
 * The test is `actual_end_time` alone. It is written in exactly one place —
 * `useEnhancedMatchTimer.endCurrentPeriod` — at the moment the period ends, and
 * a period is inserted without it. `is_active` is NOT a usable signal: pausing
 * a period sets `is_active = false` while the period is very much still in
 * play, and a penalty shootout period is inserted with `is_active = false`.
 *
 * A retrospective match inserts its periods with `actual_end_time` already
 * set, so they read as closed — correct, since no live spell belongs in them.
 */
export function isPeriodOpen(period: { actual_end_time?: string | null } | null | undefined): boolean {
  return !!period && !period.actual_end_time;
}
