import { useRef, useState, type MutableRefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader as AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useEnhancedMatchTimer } from '@/hooks/useEnhancedMatchTimer';
import { Play, Pause, Square, Plus, Timer, RefreshCw, AlertTriangle, Target } from 'lucide-react';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { canActOnMatch, type TrackerHolder } from '@/lib/trackerGate';

// Floodlight — see docs/brand/BRAND.md. Scoped locally to this component, per the
// precedent set by the header/tile-grid branches (DESIGN-002 covers the app-wide
// token migration; this is not that).
const FLOODLIGHT = {
  navy: '#101724',
  amber: '#F5A524',
  pitchBlue: '#0B5FCC',
  card: '#FFFFFF',
  edge: '#CBD3DC',
  slate: '#5A6474',
};

// Semantic critical — only for "something is about to be lost" (the Discard action
// in the UX-010 guard). Never decorative.
const RED_DEEP = '#B4232C';

interface EnhancedMatchControlsProps {
  fixtureId: string;
  // currentSeconds/totalSeconds are the second-level values behind currentMinute/totalMinute —
  // for display only (UX-009). Never derive minute_in_period/total_match_minute from them.
  // periodId/isRunning are the live period identity and running flag straight from
  // useEnhancedMatchTimer — the parent's own periods/fixture state is only loaded on
  // mount, so it needs these to drive per-player timers while a period runs (DEFECT 1).
  onTimerUpdate?: (
    currentMinute: number,
    totalMinute: number,
    periodNumber: number,
    currentSeconds: number,
    totalSeconds: number,
    periodId?: string | null,
    isRunning?: boolean
  ) => void;
  forceRefresh?: boolean;
  // Ownership gate (client-side only — see SEC-003 for the still-open server-side
  // half). Who holds fixtures.active_tracker_id, from useRealtimeMatchSync, with
  // "not known yet" kept distinct from "nobody" (see lib/trackerGate.ts). Required on
  // purpose: an omitted prop must not be able to mean "permitted".
  trackerHolder: TrackerHolder;
  // Claim-on-start. Start Period on a match nobody holds claims tracking for the person
  // pressing it first, and starts only if the claim succeeded — so a started match is
  // never one the starter was refused ownership of. Resolves false if the claim was
  // refused or failed; the claim path has already told the user why. Required for the
  // same reason as trackerHolder: an omitted prop must not mean "start without claiming".
  onClaimTracking: () => Promise<boolean>;
  // Owned by the parent, held true by Start Period from press until its writes are done.
  // Claiming flips isActiveTracker, which triggers two refreshes that must NOT overlap
  // the period insert: the parent's loadMatchData (setLoading(true) swaps the whole page
  // for a skeleton, unmounting this component mid-write) and this component's
  // forceRefresh reload (can read the new period next to a stale current_period_id).
  // Both skip while this is set. Doubles as the re-entry guard against a double-tap.
  startInFlightRef: MutableRefObject<boolean>;
  // UX-010 guard: ending a period or the match with staged substitutions still
  // pending would silently lose them and leave the on-screen pitch out of sync
  // with the real one. The parent owns the pending stack; it passes the count and
  // the two ways out (submit or discard) rather than lifting the whole stack here.
  pendingSubCount?: number;
  /** Commit the pending substitutions. Rejects if the batch did not fully commit. */
  onSubmitPendingSubs?: () => Promise<void>;
  /** Drop the pending substitutions. */
  onDiscardPendingSubs?: () => void;
}

export function EnhancedMatchControls({
  fixtureId,
  onTimerUpdate,
  forceRefresh,
  trackerHolder,
  onClaimTracking,
  startInFlightRef,
  pendingSubCount = 0,
  onSubmitPendingSubs,
  onDiscardPendingSubs,
}: EnhancedMatchControlsProps) {
  // Fail closed: act only when we positively know this client is the tracker, or
  // positively know active_tracker_id IS NULL. `unknown` (initial read still in
  // flight, or it failed) blocks — controls render disabled until it is known, never
  // enabled-then-disabled.
  //
  // CRITICAL — the permissive case: if nobody holds the match (`nobody`: never
  // claimed, or the tracker released), any club official must still be able to act.
  // It mirrors restart_match, which already allows action when active_tracker_id IS
  // NULL. Gating this out would strand a coach mid-game. (A tracker whose phone dies
  // is `other`, not `nobody` — the way out there is Take Control; see trackerGate.ts.)
  const canAct = canActOnMatch(trackerHolder);
  const trackerPending = trackerHolder === 'unknown';

  // The latest canAct, for checks made where the render closure is stale: inside a
  // confirmation dialog that was opened while permitted, or after an await. The
  // disabled trigger only stops a dialog OPENING — it does nothing to one already open.
  const canActRef = useRef(canAct);
  canActRef.current = canAct;

  const {
    timerState,
    startNewPeriod,
    startPenaltyShootout,
    pauseTimer,
    resumeTimer,
    endCurrentPeriod,
    endMatch,
    getCurrentMinute,
    getTotalMatchMinute,
    formatTime,
    loadMatchState,
  } = useEnhancedMatchTimer({
    fixtureId,
  });
  const { toast } = useToast();

  // Push timer updates to the parent from the timer's own state, not from a save
  // callback — a failed fixtures write must never freeze the coach's clock (BUG-020).
  // timerState.currentTime ticks every second with no database involvement, so this
  // fires every second regardless of write success.
  useEffect(() => {
    onTimerUpdate?.(
      getCurrentMinute(),
      getTotalMatchMinute(),
      timerState.currentPeriod?.period_number || 0,
      timerState.currentTime,
      timerState.totalMatchTime,
      timerState.currentPeriod?.id ?? null,
      timerState.isRunning,
    );
  }, [
    timerState.currentTime,
    timerState.totalMatchTime,
    timerState.currentPeriod?.id,
    timerState.currentPeriod?.period_number,
    timerState.isRunning,
    timerState.matchStatus,
    onTimerUpdate,
  ]);

  // Force refresh when control is taken. Skipped while Start Period is claiming and
  // writing — that claim is what flipped forceRefresh, and this reload reads
  // match_periods then fixtures, so overlapping the period insert can leave the screen
  // showing "not started" over a running period. startNewPeriod ends with its own
  // resync, so nothing is lost by skipping.
  useEffect(() => {
    if (forceRefresh && !startInFlightRef.current) {
      loadMatchState();
    }
  }, [forceRefresh, loadMatchState, startInFlightRef]);

  // Drives the "Starting…" label and disables the button while claim + start run, so a
  // slow claim on touchline signal doesn't look like a button that did nothing.
  const [starting, setStarting] = useState(false);

  const handleStartNewPeriod = async () => {
    // Re-entry guard. A second tap during the claim round trip would otherwise issue a
    // second period insert (both would compute the same next period number).
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setStarting(true);
    try {
      // Require at least one starter (is_on_field=true) before starting a period.
      // Runs BEFORE the claim: a start that will not proceed must not take ownership.
      try {
        const { data: onField } = await supabase
          .from('player_match_status')
          .select('player_id')
          .eq('fixture_id', fixtureId)
          .eq('is_on_field', true);
        if (!onField || onField.length === 0) {
          toast({
            title: 'No starters set',
            description: 'Select your starting players (on-field) before starting the period.',
            variant: 'destructive'
          });
          return;
        }
      } catch {}

      // Claim-on-start. Only when nobody holds the match: `self` already owns it (a
      // re-claim would reset tracking_started_at for nothing) and `other`/`unknown`
      // never reach here — their button is disabled. If the claim is refused (someone
      // else holds it and was active in the last 5 minutes) or fails, do NOT start.
      // claimMatchTracking has already toasted the specific reason and, on a refusal,
      // pulled local state in line so this button disables and the banner names the
      // tracker. The toast below replaces that one (TOAST_LIMIT is 1), so it has to say
      // on its own that nothing started — and be true for a network failure too, where
      // the banner will not have changed. If the claim succeeds but the start then
      // fails, the user keeps the claim and can retry — holding a match with no period
      // started is harmless.
      if (trackerHolder === 'nobody') {
        const claimed = await onClaimTracking();
        if (!claimed) {
          toast({
            title: 'Period not started',
            description:
              "You couldn't take control of this match, so nothing was started. " +
              'If someone else is tracking it, the banner above says so.',
            variant: 'destructive',
          });
          return;
        }
      }

      await startNewPeriod();
    } finally {
      startInFlightRef.current = false;
      setStarting(false);
    }
  };

  // The confirm action inside a dialog, and anything after an await, is a point of
  // action the disabled trigger cannot protect. Called when the latest canAct says the
  // caller no longer holds the match. `alreadyDone` says what did happen first, when
  // something did (a submit that committed before ownership was lost).
  const refuseNotTracker = (what: string, alreadyDone?: string) => {
    toast({
      title: 'Not applied — you are not the active tracker',
      description:
        `${alreadyDone ? `${alreadyDone} ` : ''}You are not the active tracker of this match, ` +
        `so ${what} was not applied.${alreadyDone ? '' : ' Nothing was changed.'} ` +
        'Use Take Control if you need to act.',
      variant: 'destructive',
    });
  };

  // Enhanced button logic to handle all resume scenarios
  const canStartPeriod = (!timerState.currentPeriod || timerState.currentPeriod.actual_end_time) && 
                         timerState.matchStatus !== 'completed';
  const canPausePeriod = timerState.isRunning && timerState.currentPeriod;
  // Show resume button when there's a current period that's not running (paused or stopped)
  const canResumePeriod = timerState.currentPeriod && !timerState.isRunning && 
                         (timerState.matchStatus === 'paused' || timerState.matchStatus === 'in_progress');
  const canEndPeriod = timerState.currentPeriod;
  const canEndMatch = timerState.periods.length > 0 && timerState.matchStatus !== 'completed';
  
  // Check if penalty shootout can be started
  const hasPenaltyShootout = timerState.periods.some(p => p.period_type === 'penalties');
  const canStartPenaltyShootout = timerState.periods.length > 0 &&
                                   !hasPenaltyShootout &&
                                   timerState.matchStatus !== 'completed' &&
                                   (!timerState.currentPeriod || timerState.currentPeriod.actual_end_time);

  // UX-010 unsubmitted-substitution guard. When pending subs exist, "End Period" /
  // "End Match" cannot run straight through — they open this dialog first, which
  // forces an explicit Submit or Discard. It is deliberately not dismissible into
  // an "end anyway": Cancel just keeps tracking.
  const [subGuard, setSubGuard] = useState<null | 'period' | 'match'>(null);
  const [guardBusy, setGuardBusy] = useState(false);

  // requestEndPeriod / requestEndMatch are the confirm actions of dialogs that were
  // opened while permitted; ownership may have changed since (a takeover, or the
  // displaced notice). Radix closes the dialog when its action is clicked, so refusing
  // here closes it — with the toast as the explanation — rather than proceeding.
  const requestEndPeriod = () => {
    if (!canActRef.current) {
      refuseNotTracker('ending the period');
      return;
    }
    if (pendingSubCount > 0) {
      setSubGuard('period');
      return;
    }
    endCurrentPeriod();
  };

  const requestEndMatch = () => {
    if (!canActRef.current) {
      refuseNotTracker('ending the match');
      return;
    }
    if (pendingSubCount > 0) {
      setSubGuard('match');
      return;
    }
    endMatch();
  };

  const runGuard = async (mode: 'submit' | 'discard') => {
    const target = subGuard;
    if (!target) return;
    const what = target === 'period' ? 'ending the period' : 'ending the match';
    // This dialog is controlled, so it does not close itself: close it explicitly. Checked
    // before anything is written — a displaced coach must not commit substitutions.
    if (!canActRef.current) {
      setSubGuard(null);
      refuseNotTracker(what);
      return;
    }
    setGuardBusy(true);
    try {
      if (mode === 'submit') {
        // Throws if the batch did not fully commit — in that case we stay on the
        // guard so the coach can retry or discard, and nothing is ended.
        await onSubmitPendingSubs?.();
      } else {
        onDiscardPendingSubs?.();
      }
    } catch {
      setGuardBusy(false);
      return;
    }
    setGuardBusy(false);
    setSubGuard(null);
    // Re-check at the point of action: the submit above is async, and ownership can
    // change while it is in flight. Say what did happen, because the substitutions
    // were committed (or dropped) even though the end was refused.
    if (!canActRef.current) {
      refuseNotTracker(
        what,
        mode === 'submit'
          ? 'Your substitutions were submitted before you lost control.'
          : 'Your pending substitutions were discarded before you lost control.',
      );
      return;
    }
    if (target === 'period') {
      endCurrentPeriod();
    } else {
      endMatch();
    }
  };

  const guardIsMatch = subGuard === 'match';
  const guardEndLabel = guardIsMatch ? 'end match' : 'end period';
  const guardPlural = pendingSubCount === 1 ? '' : 's';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Enhanced Match Timer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timer Display */}
        <div className="text-center space-y-2">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-sm text-muted-foreground">Period Time</div>
              <div className="text-2xl font-mono font-bold">
                {formatTime(timerState.currentTime)}
              </div>
              {timerState.currentPeriod && (
                <div className="text-xs text-muted-foreground">
                  P{timerState.currentPeriod.period_number}
                </div>
              )}
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Time</div>
              <div className="text-2xl font-mono font-bold">
                {formatTime(timerState.totalMatchTime)}
              </div>
              <div className="text-xs text-muted-foreground">
                Match
              </div>
            </div>
          </div>
          <Badge variant={
            timerState.matchStatus === 'in_progress' ? 'default' :
            timerState.matchStatus === 'paused' ? 'secondary' :
            timerState.matchStatus === 'completed' ? 'outline' : 'secondary'
          }>
            {timerState.matchStatus.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        {/* Periods Overview */}
        {timerState.periods.length > 0 && (
          <div>
            <Label className="text-sm font-medium">Periods</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {timerState.periods.map((period) => (
                <Badge
                  key={period.id}
                  variant={period.id === timerState.currentPeriod?.id ? 'default' : 'outline'}
                  className="text-xs"
                >
                  {period.period_type === 'penalties' ? '⚽ Penalties' : `P${period.period_number}`}
                  {period.actual_end_time && ' ✓'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="space-y-2">
          {/* Start Period — the primary action, and the only thing on screen when it
              appears: Signal Amber, navy text (amber on white fails contrast, so it
              never takes white text — see docs/brand/BRAND.md). */}
          {canStartPeriod && (
            <Button
              onClick={handleStartNewPeriod}
              disabled={!canAct || starting}
              className="w-full flex items-center justify-center gap-2 h-14 text-base font-semibold border-0 hover:brightness-95"
              style={{ backgroundColor: FLOODLIGHT.amber, color: FLOODLIGHT.navy }}
            >
              <Play className="h-5 w-5" />
              {starting ? 'Starting…' : 'Start Period'}
            </Button>
          )}

          {/* Pause — reversible and low-stakes, so it stays quiet: Card ground, navy
              text, Edge border. */}
          {canPausePeriod && (
            <Button
              onClick={pauseTimer}
              variant="outline"
              disabled={!canAct}
              className="w-full flex items-center justify-center gap-2 h-12 text-base border hover:brightness-95"
              style={{ backgroundColor: FLOODLIGHT.card, color: FLOODLIGHT.navy, borderColor: FLOODLIGHT.edge }}
            >
              <Pause className="h-5 w-5" />
              Pause Period
            </Button>
          )}

          {/* Resume — same action as Start Period, same colour. */}
          {canResumePeriod && (
            <Button
              onClick={resumeTimer}
              disabled={!canAct}
              className="w-full flex items-center justify-center gap-2 h-14 text-base font-semibold border-0 hover:brightness-95"
              style={{ backgroundColor: FLOODLIGHT.amber, color: FLOODLIGHT.navy }}
            >
              <Play className="h-5 w-5" />
              Resume Period
            </Button>
          )}

          {/* Start Penalty Shootout — a distinct, rare mode: Pitch Blue. */}
          {canStartPenaltyShootout && (
            <Button
              onClick={startPenaltyShootout}
              disabled={!canAct}
              className="w-full flex items-center justify-center gap-2 h-12 text-base font-semibold border-0 hover:brightness-95"
              style={{ backgroundColor: FLOODLIGHT.pitchBlue, color: '#FFFFFF' }}
            >
              <Target className="h-5 w-5" />
              Start Penalty Shootout
            </Button>
          )}

          {/* End Period — navy outline, navy text. Yellow-as-warning would fight
              amber-as-action; the confirmation dialog below carries the caution,
              not this button. */}
          {canEndPeriod && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={!canAct}
                  className="w-full flex items-center justify-center gap-2 h-12 border-2 hover:brightness-95"
                  style={{ borderColor: FLOODLIGHT.navy, color: FLOODLIGHT.navy, backgroundColor: FLOODLIGHT.card }}
                >
                  <AlertTriangle className="h-5 w-5" />
                  End Period
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End Current Period?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will stop the timer and close the current period. Player times will be recorded. You can start a new period afterward.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={requestEndPeriod}>
                    Yes, End Period
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* End Match Button - Red, Destructive, Strong Confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={!canEndMatch || !canAct}
                className="w-full flex items-center justify-center gap-2 h-12 text-base font-semibold mt-2"
              >
                <Square className="h-5 w-5" />
                End Match
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End Match?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark the match as completed, stop timing, close any open player logs, clear live tracking, and update reports. You can reopen later if needed.
                  <br /><br />
                  <strong>Are you sure you want to end this match?</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={requestEndMatch} className="bg-destructive hover:bg-destructive/90">
                  Yes, End Match
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Refresh Timer State — a troubleshooting escape hatch, not a primary
              control. Moved below the other buttons and shrunk so it can't be
              mistaken for one of them on a screen used one-handed in weather. */}
          <Button
            onClick={loadMatchState}
            variant="ghost"
            size="sm"
            className="w-full flex items-center justify-center gap-1.5 text-[11px] mt-3 opacity-70 hover:opacity-100"
            style={{ color: FLOODLIGHT.slate, minHeight: 44 }}
          >
            <RefreshCw className="h-3 w-3" />
            Refresh Timer State
          </Button>

          {/* UX-010 guard — shown only when a period/match end was requested with
              substitutions still staged. Forces Submit or Discard. */}
          <AlertDialog
            open={subGuard !== null}
            onOpenChange={(open) => {
              if (!open && !guardBusy) setSubGuard(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  {pendingSubCount} substitution{guardPlural} still pending
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Nothing has been written to the database yet. If you {guardEndLabel} now,
                  {pendingSubCount === 1 ? ' it' : ' they'} will be lost and the pitch on
                  screen will stop matching the pitch in front of you. Submit the pending
                  substitution{guardPlural} first, or discard {pendingSubCount === 1 ? 'it' : 'them'}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
                <Button
                  onClick={() => runGuard('submit')}
                  disabled={guardBusy}
                  className="w-full h-12 text-base font-semibold border-0 hover:brightness-95"
                  style={{ backgroundColor: FLOODLIGHT.amber, color: FLOODLIGHT.navy }}
                >
                  {guardBusy ? 'Submitting…' : `Submit ${pendingSubCount} & ${guardEndLabel}`}
                </Button>
                <Button
                  onClick={() => runGuard('discard')}
                  disabled={guardBusy}
                  className="w-full h-12 border-0 hover:brightness-110"
                  style={{ backgroundColor: RED_DEEP, color: '#FFFFFF' }}
                >
                  Discard &amp; {guardEndLabel}
                </Button>
                <AlertDialogCancel disabled={guardBusy} className="w-full mt-0">
                  Keep tracking
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Shown while the tracker read is in flight or has failed — the buttons above
            are already disabled. Sits below them, not above, so the tappable controls
            don't shift when it clears. "Reload" covers the failed-read case, where
            this never clears on its own. */}
        {trackerPending && (
          <p
            role="status"
            className="text-sm text-center"
            style={{ color: FLOODLIGHT.slate }}
          >
            Checking who is tracking this match… If this doesn't clear, reload the page.
          </p>
        )}

        {/* Instructions */}
        {timerState.matchStatus === 'not_started' && (
          <div className="text-sm text-muted-foreground text-center p-4 bg-muted rounded-lg">
            Click "Start Period" to begin the first period of the match
          </div>
        )}
        {timerState.matchStatus === 'paused' && timerState.currentPeriod && (
          <div
            className="text-sm text-center p-4 rounded-lg border-l-4"
            style={{ backgroundColor: FLOODLIGHT.card, borderColor: FLOODLIGHT.edge, borderLeftColor: FLOODLIGHT.amber, color: FLOODLIGHT.navy }}
          >
            Period {timerState.currentPeriod.period_number} is paused. Click "Resume Period" to continue.
          </div>
        )}
      </CardContent>
    </Card>
  );
}