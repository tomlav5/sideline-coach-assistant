import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface MatchEvent {
  id: string;
  event_type: string;
  total_match_minute: number;
  period_id: string;
  player_id?: string;
}

interface PlayerTime {
  id: string;
  player_id: string;
  period_id: string;
  time_on_minute: number | null;
  time_off_minute: number | null;
  total_period_minutes: number;
}

interface MatchPeriod {
  id: string;
  period_number: number;
  planned_duration_minutes: number;
}

interface ValidationPanelProps {
  fixtureId: string;
  events: MatchEvent[];
  playerTimes: PlayerTime[];
  periods: MatchPeriod[];
}

export function ValidationPanel({ fixtureId, events, playerTimes, periods }: ValidationPanelProps) {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    runValidation();
  }, [events, playerTimes, periods]);

  const runValidation = () => {
    setIsValidating(true);
    const newWarnings: string[] = [];

    // Check for events without players
    const eventsWithoutPlayers = events.filter(e => e.event_type === 'goal' && !e.player_id);
    if (eventsWithoutPlayers.length > 0) {
      newWarnings.push(`${eventsWithoutPlayers.length} goal event(s) missing player assignment`);
    }

    // Check for events in non-existent periods
    const periodIds = new Set(periods.map(p => p.id));
    const orphanedEvents = events.filter(e => !periodIds.has(e.period_id));
    if (orphanedEvents.length > 0) {
      newWarnings.push(`${orphanedEvents.length} event(s) reference non-existent periods`);
    }

    // Check for overlapping player times in same period
    const playerPeriodMap = new Map<string, PlayerTime[]>();
    playerTimes.forEach(pt => {
      const key = `${pt.player_id}-${pt.period_id}`;
      if (!playerPeriodMap.has(key)) {
        playerPeriodMap.set(key, []);
      }
      playerPeriodMap.get(key)!.push(pt);
    });

    playerPeriodMap.forEach((times, key) => {
      if (times.length > 1) {
        newWarnings.push(`Player has ${times.length} time logs in the same period (${key})`);
      }
    });

    // Check for negative playing time
    const negativeTimes = playerTimes.filter(pt => {
      if (pt.time_on_minute !== null && pt.time_off_minute !== null) {
        return pt.time_off_minute < pt.time_on_minute;
      }
      return false;
    });
    if (negativeTimes.length > 0) {
      newWarnings.push(`${negativeTimes.length} player time log(s) have negative duration`);
    }

    // Check for player times exceeding period duration
    const exceedingTimes = playerTimes.filter(pt => {
      const period = periods.find(p => p.id === pt.period_id);
      if (!period) return false;
      const timeOff = pt.time_off_minute ?? period.planned_duration_minutes;
      return timeOff > period.planned_duration_minutes;
    });
    if (exceedingTimes.length > 0) {
      newWarnings.push(`${exceedingTimes.length} player time log(s) exceed period duration`);
    }

    // Check for periods without player times
    const periodsWithoutPlayers = periods.filter(p => {
      const hasPlayers = playerTimes.some(pt => pt.period_id === p.id);
      return !hasPlayers && p.planned_duration_minutes > 0;
    });
    if (periodsWithoutPlayers.length > 0) {
      newWarnings.push(`${periodsWithoutPlayers.length} period(s) have no player time logs`);
    }

    setWarnings(newWarnings);
    setIsValidating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {warnings.length === 0 ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-600">All Checks Passed</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-yellow-600">{warnings.length} Warning(s) Found</span>
            </>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={runValidation}
          disabled={isValidating}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isValidating ? 'animate-spin' : ''}`} />
          Re-validate
        </Button>
      </div>

      {warnings.length === 0 ? (
        <div className="text-center py-12 bg-green-50 dark:bg-green-900/10 rounded-lg">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No data inconsistencies detected. All match data appears valid.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The following issues were detected in your match data:
          </p>
          <div className="space-y-2">
            {warnings.map((warning, index) => (
              <div 
                key={index} 
                className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
              >
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{warning}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> These are warnings, not errors. Your match data has been saved, 
              but you may want to review and correct these issues for accurate reporting.
            </p>
          </div>
        </div>
      )}

      <Separator className="my-6" />

      <div className="space-y-3">
        <h4 className="font-medium text-sm">Data Summary</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{events.length}</div>
            <div className="text-xs text-muted-foreground">Total Events</div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{events.filter(e => e.event_type === 'goal').length}</div>
            <div className="text-xs text-muted-foreground">Goals</div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{playerTimes.length}</div>
            <div className="text-xs text-muted-foreground">Time Logs</div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{periods.length}</div>
            <div className="text-xs text-muted-foreground">Periods</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium text-sm">Period Breakdown</h4>
        <div className="space-y-2">
          {periods.map((period) => {
            const periodEvents = events.filter(e => e.period_id === period.id);
            const periodPlayers = playerTimes.filter(pt => pt.period_id === period.id);
            
            return (
              <div key={period.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <Badge variant="outline">Period {period.period_number}</Badge>
                  <span className="text-sm text-muted-foreground ml-2">
                    {period.planned_duration_minutes} min
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>{periodEvents.length} events</span>
                  <span>{periodPlayers.length} time logs</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
