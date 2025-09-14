import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
  const { toast } = useToast();

  const handleRemoveFromTeam = async (teamId: string, teamName: string) => {
    try {
      const { error } = await supabase
        .from('team_players')
        .delete()
        .eq('player_id', player.id)
        .eq('team_id', teamId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Removed ${player.first_name} ${player.last_name} from ${teamName}`,
      });

      onPlayerUpdate();
    } catch (error) {
      console.error('Error removing player from team:', error);
      toast({
        title: "Error",
        description: "Failed to remove player from team",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className={`border-b border-border py-3 px-4 hover:bg-muted/50 transition-colors ${isSelected ? 'bg-accent/50' : ''}`}>
        <div className="flex items-center gap-3">
          {onSelectionChange && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelectionChange(player, e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 flex-shrink-0"
            />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm">
                  {player.first_name} {player.last_name}
                </h3>
                {player.jersey_number && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 flex-shrink-0">
                    #{player.jersey_number}
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <p className="text-xs text-muted-foreground">{player.club.name}</p>
                {player.teams && player.teams.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {player.teams.map((team) => (
                      <Badge 
                        key={team.id} 
                        variant="secondary" 
                        className="text-xs px-1.5 py-0 flex items-center gap-1 group hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <span>{team.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFromTeam(team.id, team.name);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-2 w-2" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-1 flex-shrink-0">
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
      </div>

      <PlayerSettings
        player={player}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onPlayerUpdate={onPlayerUpdate}
      />
    </>
  );
}