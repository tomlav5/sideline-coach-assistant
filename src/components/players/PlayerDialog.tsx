import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

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

interface PlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubs: Club[];
  onPlayerCreated: () => void;
}

export function PlayerDialog({ open, onOpenChange, clubs, onPlayerCreated }: PlayerDialogProps) {
  const [creating, setCreating] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [newPlayer, setNewPlayer] = useState({
    first_name: '',
    last_name: '',
    jersey_number: '',
    club_id: '',
  });

  useEffect(() => {
    if (open) {
      fetchTeams();
    }
  }, [open]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, team_type, club_id')
        .order('name');
      
      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const createPlayer = async () => {
    if (!newPlayer.first_name.trim() || !newPlayer.last_name.trim() || !newPlayer.club_id) {
      return;
    }

    try {
      setCreating(true);
      const playerData: any = {
        first_name: newPlayer.first_name.trim(),
        last_name: newPlayer.last_name.trim(),
        club_id: newPlayer.club_id,
      };

      if (newPlayer.jersey_number) {
        playerData.jersey_number = parseInt(newPlayer.jersey_number);
      }

      const { data, error } = await supabase
        .from('players')
        .insert([playerData])
        .select()
        .single();

      if (error) throw error;

      // Assign to selected teams
      if (selectedTeams.length > 0) {
        const teamAssignments = selectedTeams.map(teamId => ({
          player_id: data.id,
          team_id: teamId
        }));

        const { error: assignError } = await supabase
          .from('team_players')
          .insert(teamAssignments);

        if (assignError) throw assignError;
      }

      onOpenChange(false);
      setNewPlayer({ first_name: '', last_name: '', jersey_number: '', club_id: '' });
      setSelectedTeams([]);
      onPlayerCreated();
    } catch (error) {
      console.error('Error creating player:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setNewPlayer({ first_name: '', last_name: '', jersey_number: '', club_id: '' });
    setSelectedTeams([]);
  };

  const filteredTeams = teams.filter(team => team.club_id === newPlayer.club_id);

  const handleTeamToggle = (teamId: string, checked: boolean) => {
    if (checked) {
      setSelectedTeams(prev => [...prev, teamId]);
    } else {
      setSelectedTeams(prev => prev.filter(id => id !== teamId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Player</DialogTitle>
          <DialogDescription>
            Add a new player to your club
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="club">Club</Label>
            <Select value={newPlayer.club_id} onValueChange={(value) => setNewPlayer({ ...newPlayer, club_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a club" />
              </SelectTrigger>
              <SelectContent>
                {clubs.map((club) => (
                  <SelectItem key={club.id} value={club.id}>
                    {club.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={newPlayer.first_name}
                onChange={(e) => setNewPlayer({ ...newPlayer, first_name: e.target.value })}
                placeholder="John"
              />
            </div>
            <div>
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={newPlayer.last_name}
                onChange={(e) => setNewPlayer({ ...newPlayer, last_name: e.target.value })}
                placeholder="Doe"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="jersey_number">Jersey Number (Optional)</Label>
            <Input
              id="jersey_number"
              type="number"
              value={newPlayer.jersey_number}
              onChange={(e) => setNewPlayer({ ...newPlayer, jersey_number: e.target.value })}
              placeholder="10"
              min="1"
              max="99"
            />
          </div>

          {newPlayer.club_id && filteredTeams.length > 0 && (
            <div>
              <Label>Assign to Teams (Optional)</Label>
              <div className="space-y-2 mt-2 max-h-32 overflow-y-auto">
                {filteredTeams.map((team) => (
                  <div key={team.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`team-${team.id}`}
                      checked={selectedTeams.includes(team.id)}
                      onCheckedChange={(checked) => handleTeamToggle(team.id, checked as boolean)}
                    />
                    <Label htmlFor={`team-${team.id}`} className="text-sm">
                      {team.name} ({team.team_type})
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex gap-2 pt-4">
            <Button onClick={createPlayer} disabled={creating} className="flex-1">
              {creating ? "Adding..." : "Add Player"}
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