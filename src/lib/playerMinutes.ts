/**
 * Playing-time arithmetic for the live match tiles (DEFECT 1, BUG-007).
 *
 * Minutes played is DERIVED, never ticked. The hook reads `player_time_logs`
 * rows once and this module turns them into a per-player summary; the tile then
 * asks for a number at render time, passing the current period's elapsed
 * seconds (already pause-adjusted by the match timer). This mirrors the match
 * clock, which is derived from `actual_start_time` in Postgres rather than a
 * client-side counter — the load-bearing rule in CLAUDE.md.
 *
 * Both `time_on_minute` and `time_off_minute` are DURATIONS (minutes elapsed
 * within the period), not timestamps — see BUG-005 and the comment block in
 * `src/lib/matchMinute.ts`. The "+1 minute in progress" convention must NOT be
 * applied here.
 *
 * BUG-007: minutes must be a fixture-wide total, not period-scoped, or every
 * tile reads 0m at the start of the second half. So closed intervals from every
 * period are summed, and only the still-open interval in the CURRENT period
 * accrues live.
 */

export interface PlayerTimeLogRow {
  player_id: string;
  time_on_minute: number | null;
  time_off_minute: number | null;
  is_active: boolean;
  period_id: string;
}

export interface PlayerMinutesSummary {
  /** Sum of every closed interval across the whole fixture, in whole minutes. */
  closedMinutes: number;
  /**
   * `time_on_minute` of the still-open interval in the CURRENT period, or null
   * if the player has no open interval in the current period. An open interval
   * left behind by a period that has already ended is not recoverable here and
   * is deliberately ignored (contributes 0).
   */
  openOnMinute: number | null;
  /** True when the player has an open interval in the current period. */
  isActiveNow: boolean;
}

function safeSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return seconds;
}

/**
 * Fold `player_time_logs` rows for a fixture into a per-player summary.
 *
 * @param logs every `player_time_logs` row for the fixture (not filtered by
 *   period or `is_active`)
 * @param currentPeriodId the period currently in progress, or null
 */
export function summarisePlayerMinutes(
  logs: PlayerTimeLogRow[],
  currentPeriodId: string | null,
): Record<string, PlayerMinutesSummary> {
  const summaries: Record<string, PlayerMinutesSummary> = {};

  for (const log of logs) {
    const summary =
      summaries[log.player_id] ??
      (summaries[log.player_id] = {
        closedMinutes: 0,
        openOnMinute: null,
        isActiveNow: false,
      });

    const onMinute = log.time_on_minute ?? 0;

    if (!log.is_active && log.time_off_minute != null) {
      // Closed interval: contribute its duration, never a negative.
      summary.closedMinutes += Math.max(0, log.time_off_minute - onMinute);
    } else if (log.is_active && log.period_id === currentPeriodId) {
      // Open interval in the current period: accrues live. If somehow more than
      // one exists, take the earliest on-minute.
      summary.openOnMinute =
        summary.openOnMinute === null
          ? onMinute
          : Math.min(summary.openOnMinute, onMinute);
      summary.isActiveNow = true;
    }
    // Open interval in a past period: unrecoverable here, contributes 0.
  }

  return summaries;
}

/**
 * Minutes played for one player, at render time.
 *
 * @param summary the player's summary from `summarisePlayerMinutes`, or
 *   undefined for a player with no logs
 * @param currentPeriodSeconds elapsed seconds in the current period, already
 *   pause-adjusted by the match timer
 * @returns whole minutes played across the fixture; 0 for an unknown player,
 *   never NaN, undefined or negative
 */
export function playerMinutesPlayed(
  summary: PlayerMinutesSummary | undefined,
  currentPeriodSeconds: number,
): number {
  if (!summary) return 0;

  let total = summary.closedMinutes;

  if (summary.openOnMinute !== null) {
    const elapsedMinute = Math.floor(safeSeconds(currentPeriodSeconds) / 60);
    total += Math.max(0, elapsedMinute - summary.openOnMinute);
  }

  return Math.max(0, total);
}
