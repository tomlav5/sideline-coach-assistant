import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

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

interface TeamAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: Player | null;
  availableTeams: Team[];
  onAssignmentUpdate: () => void;
}

export function TeamAssignmentDialog({ 
  open, 
  onOpenChange, 
  player, 
  availableTeams, 
  onAssignmentUpdate 
}: TeamAssignmentDialogProps) {
  const { toast } = useToast();
  const [assigning, setAssigning] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  // Update selected teams when player changes
  useEffect(() => {
    if (player && open) {
      setSelectedTeams(player.teams?.map(t => t.id) || []);
    }
  }, [player, open]);

  const assignToTeams = async () => {
    if (!player) return;

    try {
      setAssigning(true);
      
      // Remove existing team assignments
      await supabase
        .from('team_players')
        .delete()
        .eq('player_id', player.id);

      // Add new team assignments
      if (selectedTeams.length > 0) {
        const assignments = selectedTeams.map(teamId => ({
          player_id: player.id,
          team_id: teamId,
        }));

        const { error } = await supabase
          .from('team_players')
          .insert(assignments);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Team assignments updated successfully",
      });

      onOpenChange(false);
      onAssignmentUpdate();
    } catch (error) {
      console.error('Error assigning teams:', error);
      toast({
        title: "Error",
        description: "Failed to update team assignments",
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

  const getPlayerTeamsForClub = () => {
    if (!player) return [];
    return availableTeams.filter(team => team.club_id === player.club_id);
  };

  const handleCancel = () => {
    setSelectedTeams(player?.teams?.map(t => t.id) || []);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Teams</DialogTitle>
          <DialogDescription>
            Select which teams {player?.first_name} {player?.last_name} should be part of
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {player && getPlayerTeamsForClub().length > 0 ? (
            getPlayerTeamsForClub().map((team) => (
              <div key={team.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`team-${team.id}`}
                  checked={selectedTeams.includes(team.id)}
                  onCheckedChange={(checked) => handleTeamToggle(team.id, checked as boolean)}
                />
                <label
                  htmlFor={`team-${team.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {team.name} ({team.team_type.replace('-', ' ')})
                </label>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No teams available for this club. Create teams first.
            </p>
          )}
          
          <div className="flex gap-2 pt-4">
            <Button onClick={assignToTeams} disabled={assigning} className="flex-1">
              {assigning ? "Updating..." : "Update Teams"}
            </Button>
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}