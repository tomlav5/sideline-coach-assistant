import { useEffect, useRef } from 'react';

/**
 * Auto-apply substitutions staged during a break, once the next period has
 * started (BUG-041 follow-up, UX-039 phase 1).
 *
 * Since BUG-041, Submit between periods is refused and the pairs stay staged. A
 * coach who makes half-time changes in a huddle will not reliably remember a
 * second Submit after kick-off, and a forgotten pending pair leaves the
 * on-screen pitch wrong AND the substitution unrecorded. So they are committed
 * automatically — through the normal Submit path — when the next period starts.
 *
 * The danger is the minute. Submit stamps player_time_logs with
 * Math.floor(currentSeconds / 60), and `currentSeconds` is whatever the timer
 * last reported. Fired straight from the Start Period click, it could still
 * hold the PREVIOUS period's elapsed time (a reload during the break can report
 * the ended period at its full length), stamping a half-time change at minute
 * 30 of the new period. So this waits for all three of:
 *
 *  - `startedPeriodId` — Start Period on THIS device actually started a period
 *    (row inserted). Not set if the starter check, the claim or the insert
 *    failed, and reset by a remount, so a reload cannot apply anything.
 *  - `reportedPeriodId === startedPeriodId` — the timer is now reporting the
 *    new period. The tracker's `handleTimerUpdate` sets the period id and
 *    `currentSeconds` from the same timer report, so in the render where these
 *    match, `currentSeconds` (and `submit`'s closure over it) is the NEW
 *    period's elapsed time.
 *  - `transitionsSettled` — the period-transition effect has finished opening
 *    spells in the new period. Applying while it is mid-loop lets it find the
 *    outgoing player with only a closed row and open a live spell for a player
 *    who is on the bench.
 *
 * The new period being open (actual_end_time null) is guaranteed at insert, and
 * re-checked against the database by submitSubstitutions' resolveCurrentPeriod,
 * which refuses a closed period — so a period ended in the instant before this
 * fires is refused, not written into.
 *
 * Fires at most once per started period: the id is recorded BEFORE the submit
 * is awaited, so a re-render, realtime update or re-run cannot apply twice. A
 * failed submit is not retried — `submit` has already shown its error toast and
 * left the pairs staged for a manual Submit; the period itself is untouched.
 */
export interface AutoApplyPendingSubsArgs {
  startedPeriodId: string | null;
  reportedPeriodId: string | null | undefined;
  transitionsSettled: boolean;
  pendingCount: number;
  recordingLocked: boolean;
  /** The normal Submit path. Rejects if the batch did not fully commit. */
  submit: () => Promise<void>;
  /** Called once, after every pending pair committed. */
  onApplied: (count: number) => void;
}

export function useAutoApplyPendingSubs({
  startedPeriodId,
  reportedPeriodId,
  transitionsSettled,
  pendingCount,
  recordingLocked,
  submit,
  onApplied,
}: AutoApplyPendingSubsArgs): void {
  const handledPeriodIdRef = useRef<string | null>(null);
  // Latest callbacks, so the effect calls the version from the render it runs
  // after — whose closure holds that render's currentSeconds.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const onAppliedRef = useRef(onApplied);
  onAppliedRef.current = onApplied;

  useEffect(() => {
    if (!startedPeriodId) return;
    if (handledPeriodIdRef.current === startedPeriodId) return;
    if (reportedPeriodId !== startedPeriodId) return;
    if (!transitionsSettled) return;

    handledPeriodIdRef.current = startedPeriodId;

    if (pendingCount === 0) return;
    if (recordingLocked) {
      console.warn(
        `[autoApplyPendingSubs] period ${startedPeriodId} started with ${pendingCount} ` +
          `staged substitution(s), but recording is locked (not the active tracker) — ` +
          `not applied; they remain staged.`,
      );
      return;
    }

    const count = pendingCount;
    submitRef.current().then(
      () => onAppliedRef.current(count),
      (error) => {
        // submit has already toasted and left the pairs staged; the period
        // stays started. Nothing else to do but make it diagnosable.
        console.warn(
          `[autoApplyPendingSubs] auto-apply for period ${startedPeriodId} did not ` +
            `fully commit; remaining pairs stay staged for a manual Submit.`,
          error,
        );
      },
    );
  }, [startedPeriodId, reportedPeriodId, transitionsSettled, pendingCount, recordingLocked]);
}
