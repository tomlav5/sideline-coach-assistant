import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useEnhancedMatchTimer } from '@/hooks/useEnhancedMatchTimer';
import { Play, Pause, Square, Plus, Timer, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EnhancedMatchControlsProps {
  fixtureId: string;
  onTimerUpdate?: (currentMinute: number, totalMinute: number, periodNumber: number) => void;
  forceRefresh?: boolean;
}

export function EnhancedMatchControls({ fixtureId, onTimerUpdate, forceRefresh }: EnhancedMatchControlsProps) {

  const {
    timerState,
    startNewPeriod,
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
    onSaveState: () => {
      const currentPeriodNumber = timerState.currentPeriod?.period_number || 0;
      onTimerUpdate?.(getCurrentMinute(), getTotalMatchMinute(), currentPeriodNumber);
    }
  });
  const { toast } = useToast();

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
                  P{period.period_number}
                  {period.actual_end_time && ' ✓'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="space-y-2">
          {/* Start Period / Pause Period Button */}
          {canStartPeriod && (
            <Button
              onClick={handleStartNewPeriod}
              className="w-full flex items-center justify-center gap-2"
              size="lg"
            >
              <Play className="h-4 w-4" />
              Start Period
            </Button>
          )}

          {canPausePeriod && (
            <Button
              onClick={pauseTimer}
              variant="secondary"
              className="w-full flex items-center justify-center gap-2"
              size="lg"
            >
              <Pause className="h-4 w-4" />
              Pause Period
            </Button>
          )}

          {canResumePeriod && (
            <Button
              onClick={resumeTimer}
              className="w-full flex items-center justify-center gap-2"
              size="lg"
            >
              <Play className="h-4 w-4" />
              Resume Period
            </Button>
          )}

          {/* Refresh State Button - for troubleshooting paused states */}
          <Button
            onClick={loadMatchState}
            variant="ghost"
            size="sm"
            className="w-full flex items-center justify-center gap-2 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh Timer State
          </Button>

          {/* End Period Button */}
          {canEndPeriod && (
            <Button
              onClick={endCurrentPeriod}
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
            >
              <Square className="h-4 w-4" />
              End Period
            </Button>
          )}

          {/* End Match Button */}
          <Button
            onClick={endMatch}
            variant="destructive"
            disabled={!canEndMatch}
            className="w-full flex items-center justify-center gap-2"
          >
            <Square className="h-4 w-4" />
            End Match
          </Button>
        </div>

        {/* Instructions */}
        {timerState.matchStatus === 'not_started' && (
          <div className="text-sm text-muted-foreground text-center p-4 bg-muted rounded-lg">
            Click "Start Period" to begin the first period of the match
          </div>
        )}
        {timerState.matchStatus === 'paused' && timerState.currentPeriod && (
          <div className="text-sm text-muted-foreground text-center p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            Period {timerState.currentPeriod.period_number} is paused. Click "Resume Period" to continue.
          </div>
        )}
      </CardContent>
    </Card>
  );
}