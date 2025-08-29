import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

interface Club {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  team_type: string;
  club_id: string;
  created_at: string;
  club: Club;
}

interface TeamSettingsProps {
  team: Team;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTeamUpdate: () => void;
}

type TeamType = '5-a-side' | '7-a-side' | '9-a-side' | '11-a-side';
const TEAM_TYPES = [
  { value: '5-a-side' as TeamType, label: '5-a-side' },
  { value: '7-a-side' as TeamType, label: '7-a-side' },
  { value: '9-a-side' as TeamType, label: '9-a-side' },
  { value: '11-a-side' as TeamType, label: '11-a-side' },
];

export function TeamSettings({ team, open, onOpenChange, onTeamUpdate }: TeamSettingsProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editedTeam, setEditedTeam] = useState({
    name: team.name,
    team_type: team.team_type as TeamType,
  });

  const updateTeam = async () => {
    if (!editedTeam.name.trim()) {
      toast({
        title: "Error",
        description: "Team name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('teams')
        .update({
          name: editedTeam.name.trim(),
          team_type: editedTeam.team_type,
        })
        .eq('id', team.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team updated successfully",
      });

      onOpenChange(false);
      onTeamUpdate();
    } catch (error) {
      console.error('Error updating team:', error);
      toast({
        title: "Error",
        description: "Failed to update team",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteTeam = async () => {
    try {
      setDeleting(true);
      
      // First check if team has any players
      const { data: teamPlayers, error: playersError } = await supabase
        .from('team_players')
        .select('id')
        .eq('team_id', team.id);

      if (playersError) throw playersError;

      if (teamPlayers && teamPlayers.length > 0) {
        toast({
          title: "Cannot Delete Team",
          description: "Remove all players from the team before deleting it",
          variant: "destructive",
        });
        return;
      }

      // Delete the team
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team deleted successfully",
      });

      onOpenChange(false);
      onTeamUpdate();
    } catch (error) {
      console.error('Error deleting team:', error);
      toast({
        title: "Error",
        description: "Failed to delete team",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    setEditedTeam({
      name: team.name,
      team_type: team.team_type as TeamType,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Team Settings</DialogTitle>
          <DialogDescription>
            Edit team details or delete the team
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Team Name</Label>
            <Input
              id="edit-name"
              value={editedTeam.name}
              onChange={(e) => setEditedTeam({ ...editedTeam, name: e.target.value })}
              placeholder="Enter team name"
            />
          </div>
          
          <div>
            <Label htmlFor="edit-type">Team Type</Label>
            <Select value={editedTeam.team_type} onValueChange={(value: TeamType) => setEditedTeam({ ...editedTeam, team_type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAM_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-between pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Team
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Team</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{team.name}"? This action cannot be undone.
                    All players must be removed from the team before it can be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteTeam} disabled={deleting}>
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-2">
              <Button onClick={updateTeam} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}