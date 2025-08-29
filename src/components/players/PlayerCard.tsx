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
}

export function PlayerCard({ player, onPlayerUpdate, onTeamAssignment }: PlayerCardProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg">
                {player.first_name} {player.last_name}
                {player.jersey_number && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    #{player.jersey_number}
                  </span>
                )}
              </CardTitle>
              <CardDescription>{player.club.name}</CardDescription>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-2">Teams:</p>
              {player.teams && player.teams.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {player.teams.map((team) => (
                    <Badge key={team.id} variant="secondary" className="text-xs">
                      {team.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not assigned to any team</p>
              )}
            </div>
            
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onTeamAssignment(player)}
              className="w-full"
            >
              <Users className="h-4 w-4 mr-1" />
              Manage Teams
            </Button>
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