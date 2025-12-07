import React, { memo } from 'react';
import { Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ScorerItemProps {
  scorer: {
    player_id: string;
    player_name: string;
    team_name: string;
    goals: number;
    assists: number;
    total_contributions?: number;
    competition_type?: string;
    competition_name?: string;
  };
  style?: React.CSSProperties;
}

const ScorerItem = memo(({ scorer, style }: ScorerItemProps) => {
  const totalContributions = scorer.total_contributions || (scorer.goals + scorer.assists);

  return (
    <div style={style} className="px-2 sm:px-4">
      <div className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 mb-1">
              <span className="font-medium text-sm sm:text-base truncate">{scorer.player_name}</span>
              <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0 h-5 w-fit">
                {scorer.team_name}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-0.5 text-xs sm:text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="font-medium text-foreground">{scorer.goals}</span>
                <span>goals</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-medium text-foreground">{scorer.assists}</span>
                <span>assists</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-medium text-primary">{totalContributions}</span>
                <span>total</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ScorerItem.displayName = 'ScorerItem';

export { ScorerItem };