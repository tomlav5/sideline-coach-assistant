/**
 * Fallback-insert decision for a player the app believes is on the pitch but
 * who has no OPEN `player_time_logs` interval in the current period (BUG-011).
 *
 * Two code paths need to heal a missing interval: `submitSubstitutions.applyPair`
 * (before it closes the outgoing player's spell) and
 * `EnhancedMatchTracker.initMissingStarterLogs` (the per-period safety net).
 * While `unique_player_period_fixture` stood, both could safely
 * `insert { time_on_minute: 0, is_starter: true }` whenever their read found
 * nothing -- a duplicate INSERT simply failed with 23505. Once that constraint
 * is dropped (BUG-009) the INSERT succeeds, and for a RETURNING player -- one
 * who already had a closed spell earlier in this period -- it silently
 * fabricates a second spell starting at minute 0, counting the bench time
 * between spells as playing time.
 *
 * This function distinguishes the three states, given ALL rows for
 * (fixture_id, player_id, period_id) -- active and closed:
 *
 *  1. No rows at all -- a genuine starter whose log was never written. Insert
 *     `{ time_on_minute: 0, is_starter: true }`. Unchanged from today.
 *
 *  2. Rows exist but none is active -- the record of the player's CURRENT spell
 *     is missing and the app cannot know when it began. Insert
 *     `{ time_on_minute: currentDurationMinute, is_starter: false }` -- the
 *     spell is credited only from NOW, so the un-recorded earlier minutes are
 *     lost and the player's total is UNDER-stated, never over-stated. (In the
 *     Submit path the caller then closes this row at the same minute, making it
 *     a zero-length spell; the safety-net caller leaves it open so the player
 *     accrues from here on. Either way the missing minutes are forfeited, not
 *     invented.) This is deliberate: over-crediting a player here hands them
 *     less time in later matches than they are actually owed -- the exact
 *     outcome this app exists to prevent. The caller must also `console.error`,
 *     and on the Submit path warn the coach.
 *
 *     If `currentDurationMinute` is null -- the elapsed time in the period is
 *     not available at the call site -- we cannot even place the zero-length
 *     spell. Skip the insert entirely and let the caller log. Never fall back
 *     to minute 0: that is case 1's answer, and applying it here is BUG-011.
 *
 *  3. An active row exists -- nothing to do; the caller's existing logic closes
 *     or extends that open interval.
 */

export interface PlayerTimeLogActivity {
  is_active: boolean;
}

export type MissingStarterLogDecision =
  | {
      insert: true;
      /** `player_time_logs.time_on_minute` for the new row. */
      timeOnMinute: number;
      /** `player_time_logs.is_starter` for the new row. */
      isStarter: boolean;
      /**
       * Case 2: we are papering over a spell whose start was never recorded.
       * The caller must `console.error` (player, period, values) and, on the
       * Submit path, raise a non-blocking toast naming the player.
       */
      missingSpell: boolean;
    }
  | {
      insert: false;
      /**
       * `active-interval` -- case 3, silent, expected.
       * `missing-spell-no-duration` -- case 2 with no elapsed time available;
       * the caller must `console.error` and (Submit path) warn the coach.
       */
      reason: 'active-interval' | 'missing-spell-no-duration';
    };

/**
 * @param rows                  Every `player_time_logs` row for the player in
 *                              this fixture + period (active and closed).
 * @param currentDurationMinute Elapsed whole minutes in the current period, or
 *                              null when that figure is not available.
 */
export function decideMissingStarterLog(
  rows: readonly PlayerTimeLogActivity[],
  currentDurationMinute: number | null,
): MissingStarterLogDecision {
  if (rows.some((row) => row.is_active)) {
    return { insert: false, reason: 'active-interval' };
  }

  if (rows.length === 0) {
    return { insert: true, timeOnMinute: 0, isStarter: true, missingSpell: false };
  }

  if (currentDurationMinute == null) {
    return { insert: false, reason: 'missing-spell-no-duration' };
  }

  return {
    insert: true,
    timeOnMinute: currentDurationMinute,
    isStarter: false,
    missingSpell: true,
  };
}
