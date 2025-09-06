import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  Square, 
  Clock, 
  Target, 
  ArrowUpDown,
  Flag
} from 'lucide-react';

interface MatchControlsProps {
  matchPhase: string;
  isRunning: boolean;
  currentHalf: 'first' | 'second';
  currentTime: number;
  formatTime: (seconds: number) => string;
  onStartMatch: () => void;
  onToggleTimer: () => void;
  onEndFirstHalf: () => void;
  onStartSecondHalf: () => void;
  onEndMatch: () => void;
  onRecordGoal: () => void;
  onMakeSubstitution: () => void;
  isSquadSelected: boolean;
}

export function MatchControls({
  matchPhase,
  isRunning,
  currentHalf,
  currentTime,
  formatTime,
  onStartMatch,
  onToggleTimer,
  onEndFirstHalf,
  onStartSecondHalf,
  onEndMatch,
  onRecordGoal,
  onMakeSubstitution,
  isSquadSelected
}: MatchControlsProps) {
  const getPhaseDisplay = () => {
    switch (matchPhase) {
      case 'pre-match':
        return 'Pre-Match';
      case 'first-half':
        return 'First Half';
      case 'half-time':
        return 'Half Time';
      case 'second-half':
        return 'Second Half';
      case 'completed':
        return 'Full Time';
      default:
        return 'Match';
    }
  };

  const getPhaseColor = () => {
    switch (matchPhase) {
      case 'pre-match':
        return 'secondary';
      case 'first-half':
      case 'second-half':
        return isRunning ? 'default' : 'outline';
      case 'half-time':
        return 'secondary';
      case 'completed':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (!isSquadSelected) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Flag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Squad Selected</h3>
          <p className="text-muted-foreground">
            Please select your squad from the fixture details before starting the match.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Timer Display */}
          <div className="text-center space-y-2">
            <Badge variant={getPhaseColor()} className="text-sm px-3 py-1">
              {getPhaseDisplay()}
            </Badge>
            <div className="text-4xl font-mono font-bold">
              {formatTime(currentTime)}
            </div>
          </div>

          {/* Primary Controls */}
          <div className="flex justify-center gap-3">
            {matchPhase === 'pre-match' && (
              <Button onClick={onStartMatch} size="lg">
                <Play className="h-5 w-5 mr-2" />
                Start Match
              </Button>
            )}

            {(matchPhase === 'first-half' || matchPhase === 'second-half') && (
              <>
                <Button onClick={onToggleTimer} variant="outline" size="lg">
                  {isRunning ? (
                    <>
                      <Pause className="h-5 w-5 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5 mr-2" />
                      Resume
                    </>
                  )}
                </Button>

                {matchPhase === 'first-half' && (
                  <Button onClick={onEndFirstHalf} variant="secondary" size="lg">
                    <Square className="h-5 w-5 mr-2" />
                    End First Half
                  </Button>
                )}

                {matchPhase === 'second-half' && (
                  <Button onClick={onEndMatch} variant="secondary" size="lg">
                    <Square className="h-5 w-5 mr-2" />
                    End Match
                  </Button>
                )}
              </>
            )}

            {matchPhase === 'half-time' && (
              <Button onClick={onStartSecondHalf} size="lg">
                <Play className="h-5 w-5 mr-2" />
                Start Second Half
              </Button>
            )}
          </div>

          {/* Event Controls */}
          {(matchPhase === 'first-half' || matchPhase === 'second-half') && (
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={onRecordGoal} variant="outline">
                <Target className="h-4 w-4 mr-2" />
                Record Goal
              </Button>
              <Button onClick={onMakeSubstitution} variant="outline">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Substitution
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}