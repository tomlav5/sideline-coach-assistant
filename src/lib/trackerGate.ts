// Ownership gate for the live-match controls (client-side only — SEC-003 still owns
// the server-side half).
//
// The hook's `matchTracker` is `MatchTracker | null`, and that `null` is overloaded: it
// is the initial value before the fixture has been read, it is what a failed read
// leaves behind, AND it is what "nobody holds this match" looks like. A gate written as
// `!matchTracker` therefore treats "we haven't found out yet" as "nobody holds it" — it
// fails open. This module separates the two: `nobody` is only ever reported once the
// fixture's active_tracker_id has actually been read.

/**
 * Who holds fixtures.active_tracker_id, as far as this client can positively tell.
 *
 * - `unknown` — the initial read of the fixture has not succeeded (still loading, or it
 *   failed). Says nothing about who holds the match.
 * - `nobody`  — active_tracker_id IS NULL.
 * - `self`    — this user holds it.
 * - `other`   — another user holds it.
 */
export type TrackerHolder = 'unknown' | 'nobody' | 'self' | 'other';

/**
 * `resolved` must be true only after the fixture's active_tracker_id has been read
 * successfully for the fixture in question. `tracker` is the hook's local state: null
 * means "no tracker recorded", which is only meaningful once `resolved`.
 */
export function deriveTrackerHolder(
  resolved: boolean,
  tracker: { isActiveTracker: boolean } | null,
): TrackerHolder {
  if (!resolved) return 'unknown';
  if (!tracker) return 'nobody';
  return tracker.isActiveTracker ? 'self' : 'other';
}

/**
 * Fail closed: permit only when we positively know this client is the tracker, or
 * positively know nobody is. `nobody` must stay permitted — with active_tracker_id NULL
 * (never claimed, or the tracker released) every club official has to be able to act.
 * It mirrors restart_match, which allows the caller when
 * `active_tracker_id = auth.uid() OR active_tracker_id IS NULL`.
 *
 * Note a tracker whose phone dies does NOT make this `nobody`: nothing server-side
 * clears a stale tracker, so that case is `other`, and the way out is Take Control,
 * which claim_match_tracking allows once last_activity_at is over 5 minutes old.
 */
export function canActOnMatch(holder: TrackerHolder): boolean {
  return holder === 'self' || holder === 'nobody';
}
