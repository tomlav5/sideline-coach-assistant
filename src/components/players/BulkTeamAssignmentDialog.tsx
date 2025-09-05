import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

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
  teams?: Team[];
}

interface BulkTeamAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: Player[];
  availableTeams: Team[];
  onAssignmentUpdate: () => void;
}

export function BulkTeamAssignmentDialog({ 
  open, 
  onOpenChange, 
  players, 
  availableTeams, 
  onAssignmentUpdate 
}: BulkTeamAssignmentDialogProps) {
  const { toast } = useToast();
  const [assigning, setAssigning] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedTeams([]);
    }
  }, [open]);

  const assignToTeams = async () => {
    if (players.length === 0 || selectedTeams.length === 0) return;

    try {
      setAssigning(true);
      
      // Create assignments for all selected players and teams
      const assignments = [];
      for (const player of players) {
        for (const teamId of selectedTeams) {
          assignments.push({
            player_id: player.id,
            team_id: teamId,
          });
        }
      }

      const { error } = await supabase
        .from('team_players')
        .insert(assignments);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Added ${players.length} players to ${selectedTeams.length} team(s)`,
      });

      onOpenChange(false);
      onAssignmentUpdate();
    } catch (error) {
      console.error('Error assigning teams:', error);
      toast({
        title: "Error",
        description: "Failed to assign players to teams",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleTeamToggle = (teamId: string, checked: boolean) => {
    if (checked) {
      setSelectedTeams([...selectedTeams, teamId]);
    } else {
      setSelectedTeams(selectedTeams.filter(id => id !== teamId));
    }
  };

  const getAvailableTeams = () => {
    if (players.length === 0) return [];
    // Get teams that belong to the same clubs as the selected players
    const clubIds = [...new Set(players.map(p => p.club_id))];
    return availableTeams.filter(team => clubIds.includes(team.club_id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Team Assignment</DialogTitle>
          <DialogDescription>
            Assign {players.length} selected player(s) to teams
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Selected Players:</p>
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {players.map((player) => (
                <Badge key={player.id} variant="secondary" className="text-xs">
                  {player.first_name} {player.last_name}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Select Teams:</p>
            {getAvailableTeams().length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {getAvailableTeams().map((team) => (
                  <div key={team.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`bulk-team-${team.id}`}
                      checked={selectedTeams.includes(team.id)}
                      onCheckedChange={(checked) => handleTeamToggle(team.id, checked as boolean)}
                    />
                    <label
                      htmlFor={`bulk-team-${team.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {team.name} ({team.team_type.replace('-', ' ')})
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No teams available for the selected players' clubs.
              </p>
            )}
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={assignToTeams} 
              disabled={assigning || selectedTeams.length === 0} 
              className="flex-1"
            >
              {assigning ? "Assigning..." : `Assign to ${selectedTeams.length} Team(s)`}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}