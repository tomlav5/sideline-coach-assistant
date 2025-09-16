import React, { memo } from 'react';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PlayingTimeItemProps {
  player: {
    player_id: string;
    player_name: string;
    team_name: string;
    total_minutes: number;
    matches_played: number;
    average_minutes: number;
    competition_type?: string;
    competition_name?: string;
  };
  formatMinutes: (minutes: number) => string;
  style?: React.CSSProperties;
}

const PlayingTimeItem = memo(({ player, formatMinutes, style }: PlayingTimeItemProps) => {
  return (
    <div style={style} className="px-4">
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium">{player.player_name}</span>
              <Badge variant="outline" className="text-xs">
                {player.team_name}
              </Badge>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span className="flex items-center space-x-1">
                <span className="font-medium text-foreground">{formatMinutes(player.total_minutes)}</span>
                <span>total</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="font-medium text-foreground">{player.matches_played}</span>
                <span>matches</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="font-medium text-primary">{formatMinutes(player.average_minutes)}</span>
                <span>avg</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

PlayingTimeItem.displayName = 'PlayingTimeItem';

export { PlayingTimeItem };