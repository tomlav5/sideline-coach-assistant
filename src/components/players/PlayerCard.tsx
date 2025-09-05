import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Settings } from 'lucide-react';
import { useState } from 'react';
import { PlayerSettings } from './PlayerSettings';

interface Club {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  team_type: string;
  club_id: string;
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  club_id: string;
  created_at: string;
  club: Club;
  teams?: Team[];
}

interface PlayerCardProps {
  player: Player;
  onPlayerUpdate: () => void;
  onTeamAssignment: (player: Player) => void;
  isSelected?: boolean;
  onSelectionChange?: (player: Player, selected: boolean) => void;
}

export function PlayerCard({ 
  player, 
  onPlayerUpdate, 
  onTeamAssignment, 
  isSelected = false, 
  onSelectionChange 
}: PlayerCardProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <Card className={`hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {onSelectionChange && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelectionChange(player, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm truncate">
                  {player.first_name} {player.last_name}
                </h3>
                {player.jersey_number && (
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    #{player.jersey_number}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground">{player.club.name}</p>
                {player.teams && player.teams.length > 0 && (
                  <div className="flex gap-1">
                    {player.teams.slice(0, 2).map((team) => (
                      <Badge key={team.id} variant="secondary" className="text-xs px-1 py-0">
                        {team.name}
                      </Badge>
                    ))}
                    {player.teams.length > 2 && (
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        +{player.teams.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-1">
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => onTeamAssignment(player)}
                className="h-8 w-8 p-0"
              >
                <Users className="h-3 w-3" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setSettingsOpen(true)}
                className="h-8 w-8 p-0"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PlayerSettings
        player={player}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onPlayerUpdate={onPlayerUpdate}
      />
    </>
  );
}