import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useEnhancedMatchTimer } from '@/hooks/useEnhancedMatchTimer';
import { Play, Pause, Square, Plus, Timer } from 'lucide-react';

interface EnhancedMatchControlsProps {
  fixtureId: string;
  onTimerUpdate?: (currentMinute: number, totalMinute: number, periodNumber: number) => void;
}

export function EnhancedMatchControls({ fixtureId, onTimerUpdate }: EnhancedMatchControlsProps) {
  const [newPeriodDuration, setNewPeriodDuration] = useState(25);
  const [showNewPeriodDialog, setShowNewPeriodDialog] = useState(false);

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
  } = useEnhancedMatchTimer({
    fixtureId,
    onSaveState: () => {
      const currentPeriodNumber = timerState.currentPeriod?.period_number || 0;
      onTimerUpdate?.(getCurrentMinute(), getTotalMatchMinute(), currentPeriodNumber);
    }
  });

  const handleStartNewPeriod = async () => {
    await startNewPeriod(newPeriodDuration);
    setShowNewPeriodDialog(false);
    setNewPeriodDuration(25);
  };

  const canStartNewPeriod = !timerState.isRunning && timerState.matchStatus !== 'completed';
  const canPause = timerState.isRunning;
  const canResume = timerState.matchStatus === 'paused' && timerState.currentPeriod;
  const canEndPeriod = timerState.currentPeriod && !timerState.isRunning;
  const canEndMatch = timerState.periods.length > 0;

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
          <div className="text-3xl font-mono font-bold">
            {formatTime(timerState.currentTime)}
          </div>
          {timerState.currentPeriod && (
            <div className="text-sm text-muted-foreground">
              Period {timerState.currentPeriod.period_number} • Total: {formatTime(timerState.totalMatchTime)}
            </div>
          )}
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
                  P{period.period_number} ({period.planned_duration_minutes}min)
                  {period.actual_end_time && ' ✓'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {/* Start New Period */}
          <Dialog open={showNewPeriodDialog} onOpenChange={setShowNewPeriodDialog}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                disabled={!canStartNewPeriod}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Period
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start New Period</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={newPeriodDuration}
                    onChange={(e) => setNewPeriodDuration(Number(e.target.value))}
                    min={1}
                    max={90}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleStartNewPeriod} className="flex-1">
                    Start Period {timerState.periods.length + 1}
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewPeriodDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Pause/Resume */}
          {canPause && (
            <Button onClick={pauseTimer} variant="secondary" className="flex items-center gap-2">
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          )}

          {canResume && (
            <Button onClick={resumeTimer} className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Resume
            </Button>
          )}

          {/* End Period */}
          {canEndPeriod && (
            <Button onClick={endCurrentPeriod} variant="outline" className="flex items-center gap-2">
              <Square className="h-4 w-4" />
              End Period
            </Button>
          )}

          {/* End Match */}
          {canEndMatch && (
            <Button
              onClick={endMatch}
              variant="destructive"
              className="col-span-2 flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              End Match
            </Button>
          )}
        </div>

        {/* Instructions */}
        {timerState.matchStatus === 'not_started' && (
          <div className="text-sm text-muted-foreground text-center p-4 bg-muted rounded-lg">
            Click "New Period" to start the first period of the match
          </div>
        )}
      </CardContent>
    </Card>
  );
}