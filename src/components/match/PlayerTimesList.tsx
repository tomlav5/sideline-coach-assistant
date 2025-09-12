import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PlayerTime {
  player_id: string;
  time_on: number | null;
  time_off: number | null;
  total_minutes: number;
  is_starter: boolean;
  half: 'first' | 'second';
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface PlayerTimesListProps {
  playerTimes: PlayerTime[];
  players: Player[];
  getPlayerName: (playerId: string) => string;
  getActiveMinutes: (playerTime: PlayerTime) => number;
}

export const PlayerTimesList = memo(({
  playerTimes,
  players,
  getPlayerName,
  getActiveMinutes
}: PlayerTimesListProps) => {
  const sortedPlayerTimes = useMemo(() => 
    playerTimes.sort((a, b) => {
      const playerA = players.find(p => p.id === a.player_id);
      const playerB = players.find(p => p.id === b.player_id);
      const numberA = playerA?.jersey_number || 999;
      const numberB = playerB?.jersey_number || 999;
      return numberA - numberB;
    }), [playerTimes, players]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Player Times</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedPlayerTimes.map((pt) => {
            const player = players.find(p => p.id === pt.player_id);
            const activeMinutes = getActiveMinutes(pt);
            
            return (
              <div key={`${pt.player_id}-${pt.half}`} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {player?.jersey_number && (
                    <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center text-xs">
                      {player.jersey_number}
                    </Badge>
                  )}
                  <div>
                    <div className="font-medium">{getPlayerName(pt.player_id)}</div>
                    <div className="text-sm text-muted-foreground">
                      {pt.half.charAt(0).toUpperCase() + pt.half.slice(1)} Half
                      {pt.is_starter && <span className="ml-2">(Starter)</span>}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-medium">{activeMinutes} min</div>
                  <div className="text-xs text-muted-foreground">
                    {pt.time_on !== null && `On: ${pt.time_on}'`}
                    {pt.time_off !== null && ` Off: ${pt.time_off}'`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

PlayerTimesList.displayName = 'PlayerTimesList';