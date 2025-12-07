import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FixedMatchHeaderProps {
  teamName: string;
  opponentName: string;
  ourScore: number;
  opponentScore: number;
  currentTime: string;
  totalTime: string;
  periodNumber: number;
  matchStatus: string;
  className?: string;
}

export function FixedMatchHeader({
  teamName,
  opponentName,
  ourScore,
  opponentScore,
  currentTime,
  totalTime,
  periodNumber,
  matchStatus,
  className,
}: FixedMatchHeaderProps) {
  const isLive = matchStatus === 'in_progress';
  const isPaused = matchStatus === 'paused';

  return (
    <div className={cn(
      "sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Score Display */}
        <div className="flex items-center gap-4 flex-1">
          {/* Our Team */}
          <div className="flex flex-col items-center min-w-0">
            <span className="text-xs text-muted-foreground truncate max-w-[80px]">{teamName}</span>
            <span className="text-2xl font-bold tabular-nums">{ourScore}</span>
          </div>

          {/* Separator */}
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-muted-foreground">-</span>
          </div>

          {/* Opponent */}
          <div className="flex flex-col items-center min-w-0">
            <span className="text-xs text-muted-foreground truncate max-w-[80px]">{opponentName}</span>
            <span className="text-2xl font-bold tabular-nums">{opponentScore}</span>
          </div>
        </div>

        {/* Timer Display */}
        <div className="flex flex-col items-end gap-1 flex-1">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xl font-mono font-bold tabular-nums">{currentTime}</span>
          </div>
          <div className="flex items-center gap-2">
            {periodNumber > 0 && (
              <Badge variant="outline" className="text-xs">
                P{periodNumber}
              </Badge>
            )}
            {isLive && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-red-600 dark:text-red-400">LIVE</span>
              </div>
            )}
            {isPaused && (
              <Badge variant="secondary" className="text-xs">
                PAUSED
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
