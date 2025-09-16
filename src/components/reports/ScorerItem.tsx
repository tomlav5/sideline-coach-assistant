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
    <div style={style} className="px-4">
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium">{scorer.player_name}</span>
              <Badge variant="outline" className="text-xs">
                {scorer.team_name}
              </Badge>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span className="flex items-center space-x-1">
                <span className="font-medium text-foreground">{scorer.goals}</span>
                <span>goals</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="font-medium text-foreground">{scorer.assists}</span>
                <span>assists</span>
              </span>
              <span className="flex items-center space-x-1">
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