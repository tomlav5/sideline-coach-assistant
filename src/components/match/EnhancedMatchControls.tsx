import { useState } from 'react';
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
  pendingSubCount = 0,
  onSubmitPendingSubs,
  onDiscardPendingSubs,
}: EnhancedMatchControlsProps) {

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

  // Force refresh when control is taken
  useEffect(() => {
    if (forceRefresh) {
      loadMatchState();
    }
  }, [forceRefresh, loadMatchState]);

  const handleStartNewPeriod = async () => {
    // Require at least one starter (is_on_field=true) before starting a period
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
    await startNewPeriod();
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

  const requestEndPeriod = () => {
    if (pendingSubCount > 0) {
      setSubGuard('period');
      return;
    }
    endCurrentPeriod();
  };

  const requestEndMatch = () => {
    if (pendingSubCount > 0) {
      setSubGuard('match');
      return;
    }
    endMatch();
  };

  const runGuard = async (mode: 'submit' | 'discard') => {
    const target = subGuard;
    if (!target) return;
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
              className="w-full flex items-center justify-center gap-2 h-14 text-base font-semibold border-0 hover:brightness-95"
              style={{ backgroundColor: FLOODLIGHT.amber, color: FLOODLIGHT.navy }}
            >
              <Play className="h-5 w-5" />
              Start Period
            </Button>
          )}

          {/* Pause — reversible and low-stakes, so it stays quiet: Card ground, navy
              text, Edge border. */}
          {canPausePeriod && (
            <Button
              onClick={pauseTimer}
              variant="outline"
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
                disabled={!canEndMatch}
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