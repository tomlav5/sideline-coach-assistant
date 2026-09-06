/**
 * Football minute convention (DEBT-003).
 *
 * There is no minute zero in football. The clock opens in the 1st minute: the
 * interval 0:00–0:59 is the 1st minute, 1:00–1:59 is the 2nd, and so on. So a
 * goal at 0:30 is a 1st-minute goal, and a goal at 34:47 is a 35th-minute goal.
 *
 * This is the "minute in progress" — a TIMESTAMP: the minute you are currently
 * IN. It is `Math.floor(seconds / 60) + 1`.
 *
 * It is the OPPOSITE of a DURATION (minutes elapsed), which is a plain
 * `Math.floor(seconds / 60)` with no `+ 1`. Period durations that close
 * `player_time_logs` (`actualDurationMinutes`), elapsed playing time in
 * `usePlayerTimers`, and the `MM:SS` clock display are all durations and must
 * NOT use this function. Adding one to a duration inflates recorded playing time
 * and shows 01:00 at thirty seconds.
 *
 * Rule of thumb: TIMESTAMP = the minute you are in (floor + 1);
 *                DURATION  = minutes elapsed (floor).
 *
 * @param seconds elapsed seconds within the period or the whole match
 * @returns the whole minute currently in progress, starting at 1
 */
export const matchMinuteInProgress = (seconds: number): number => {
  // Guard against NaN or a small negative (calculateCurrentPeriodTime can dip
  // below zero if paused seconds briefly exceed elapsed): the match is always in
  // at least its 1st minute.
  if (!Number.isFinite(seconds) || seconds < 0) return 1;
  return Math.floor(seconds / 60) + 1;
};
