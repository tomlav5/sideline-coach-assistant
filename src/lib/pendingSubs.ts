/**
 * Staged-substitution stack for the live match screen (UX-007 branch 3).
 *
 * A substitution is staged, not committed: tapping a pitch player then a bench
 * player pushes a pair onto this stack and NOTHING is written to the database
 * until the coach hits Submit. The tile grid renders the *effective* lineup —
 * committed state with the pending pairs applied — so a player staged to come on
 * appears on the pitch immediately, while playing time does not accrue to them
 * until Submit.
 *
 * Everything here is pure so the peel-back order, the effective-state calculation
 * and the already-staged lockout can be unit-tested without React or Supabase.
 */

export interface PendingPair {
  /** Stable identity for this staged pair, for peel-back and Submit reconciliation. */
  id: string;
  /** Player currently on the pitch who is coming off. */
  outId: string;
  /** Player currently on the bench who is coming on. */
  inId: string;
  /**
   * Wall-clock ms when the pair was staged. Drives the "waiting" timer and the
   * 60s critical state ONLY — it is never written to the database. The minute a
   * substitution is recorded at is stamped at Submit time, not here (a coach
   * prepares a change then waits for the referee).
   */
  stagedAt: number;
  /**
   * client_event_id for the `substitution_off` row. Generated once at staging
   * time and reused on every Submit attempt so a retry after a partial failure
   * upserts rather than duplicating (match_events.client_event_id is UNIQUE).
   */
  offEventId: string;
  /** client_event_id for the `substitution_on` row. Same idempotency contract. */
  onEventId: string;
}

export interface StagePairOptions {
  /** Injectable for tests. Defaults to a monotonic local id. */
  makeId?: () => string;
  /** Injectable for tests. Defaults to `{ offEventId: makeId(), onEventId: makeId() }`. */
  makeEventIds?: () => { offEventId: string; onEventId: string };
  /** Injectable for tests. Defaults to `Date.now`. */
  now?: () => number;
}

let localCounter = 0;

/**
 * Push a new pending pair. No-ops (returns the same stack) if either player is
 * already caught in a pending pair — otherwise the same player could be staged
 * both on and off in one batch — or if the ids are missing or identical.
 */
export function stagePair(
  stack: PendingPair[],
  outId: string,
  inId: string,
  options: StagePairOptions = {},
): PendingPair[] {
  if (!outId || !inId || outId === inId) return stack;

  const locked = lockedPlayerIds(stack);
  if (locked.has(outId) || locked.has(inId)) return stack;

  const makeId = options.makeId ?? (() => `pending-${Date.now()}-${(localCounter += 1)}`);
  const makeEventIds =
    options.makeEventIds ?? (() => ({ offEventId: makeId(), onEventId: makeId() }));
  const now = options.now ?? (() => Date.now());

  const { offEventId, onEventId } = makeEventIds();

  return [
    ...stack,
    { id: makeId(), outId, inId, stagedAt: now(), offEventId, onEventId },
  ];
}

/** Pop the newest pending pair — the "Undo last" affordance. Stable when empty. */
export function peelLast(stack: PendingPair[]): PendingPair[] {
  if (stack.length === 0) return stack;
  return stack.slice(0, -1);
}

/** Every player id currently locked by a pending pair (both directions). */
export function lockedPlayerIds(stack: PendingPair[]): Set<string> {
  const ids = new Set<string>();
  for (const pair of stack) {
    ids.add(pair.outId);
    ids.add(pair.inId);
  }
  return ids;
}

/** Staging time of the oldest pending pair, or null when the stack is empty. */
export function oldestStagedAt(stack: PendingPair[]): number | null {
  if (stack.length === 0) return null;
  let oldest = stack[0].stagedAt;
  for (const pair of stack) {
    if (pair.stagedAt < oldest) oldest = pair.stagedAt;
  }
  return oldest;
}

export interface EffectiveLineup {
  pitchIds: string[];
  benchIds: string[];
}

/**
 * The lineup the tile grid renders while substitutions are staged.
 *
 * Changed 6 September 2026 (UX-007 FIX 6): staged pairs no longer move players
 * between the pitch and the bench. A player staged to come on keeps their bench
 * slot and a player staged to come off keeps their pitch slot — the grid flags
 * both as pending (via `lockedPlayerIds`) rather than relocating them, and only
 * reshuffles once Submit commits the batch and the committed lineup reloads.
 * Reordering tiles under a coach's thumb at the exact moment they are staging a
 * change is the wrong time to move the target; it is also what made a staged
 * player disappear from the grid entirely when the committed lists shifted under
 * a partial submit (DEFECT 4).
 *
 * So this is now just the committed lineup with duplicates removed and order
 * preserved. It is kept as the single place that defines "what the grid shows".
 */
export function effectiveLineup(
  committedPitchIds: string[],
  committedBenchIds: string[],
): EffectiveLineup {
  const seen = new Set<string>();
  const dedupe = (ids: string[]) =>
    ids.filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  return {
    pitchIds: dedupe(committedPitchIds),
    benchIds: dedupe(committedBenchIds),
  };
}
