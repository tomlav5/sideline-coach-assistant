import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface MatchHeaderProps {
  teamName: string;
  opponent: string;
  ourScore: number;
  theirScore: number;
  currentTime: string;
  matchPhase: string;
}

export const MatchHeader = memo(({
  teamName,
  opponent,
  ourScore,
  theirScore,
  currentTime,
  matchPhase
}: MatchHeaderProps) => {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-right">
              <div className="text-lg font-semibold">{teamName}</div>
              <div className="text-3xl font-bold text-primary">{ourScore}</div>
            </div>
            <div className="text-2xl font-bold text-muted-foreground">VS</div>
            <div className="text-left">
              <div className="text-lg font-semibold">{opponent}</div>
              <div className="text-3xl font-bold text-primary">{theirScore}</div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground uppercase tracking-wide">{matchPhase}</div>
            {currentTime && (
              <div className="text-2xl font-mono font-bold">{currentTime}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

MatchHeader.displayName = 'MatchHeader';