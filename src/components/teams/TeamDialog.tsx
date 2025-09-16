import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Club {
  id: string;
  name: string;
}

interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubs: Club[];
  onTeamCreated: () => void;
}

const TEAM_TYPES = [
  { value: '5-a-side', label: '5-a-side' },
  { value: '7-a-side', label: '7-a-side' },
  { value: '9-a-side', label: '9-a-side' },
  { value: '11-a-side', label: '11-a-side' },
];

export function TeamDialog({ open, onOpenChange, clubs, onTeamCreated }: TeamDialogProps) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [newTeam, setNewTeam] = useState({
    name: '',
    team_type: '11-a-side' as const,
    club_id: '',
  });

  const createTeam = async () => {
    if (!newTeam.name.trim() || !newTeam.club_id) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      const { error } = await supabase
        .from('teams')
        .insert([{
          name: newTeam.name.trim(),
          team_type: newTeam.team_type,
          club_id: newTeam.club_id,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team created successfully",
      });

      onOpenChange(false);
      setNewTeam({ name: '', team_type: '11-a-side', club_id: '' });
      onTeamCreated();
    } catch (error) {
      console.error('Error creating team:', error);
      toast({
        title: "Error",
        description: "Failed to create team",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setNewTeam({ name: '', team_type: '11-a-side', club_id: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-standard">
        <DialogHeader>
          <DialogTitle>Create New Team</DialogTitle>
          <DialogDescription>
            Add a new team to your club
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="club">Club</Label>
            <Select value={newTeam.club_id} onValueChange={(value) => setNewTeam({ ...newTeam, club_id: value })}>
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
          
          <div>
            <Label htmlFor="name">Team Name</Label>
            <Input
              id="name"
              value={newTeam.name}
              onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
              placeholder="Enter team name"
            />
          </div>
          
          <div>
            <Label htmlFor="type">Team Type</Label>
            <Select value={newTeam.team_type} onValueChange={(value: any) => setNewTeam({ ...newTeam, team_type: value })}>
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
          
          <div className="flex gap-2 pt-4">
            <Button onClick={createTeam} disabled={creating} className="flex-1">
              {creating ? "Creating..." : "Create Team"}
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