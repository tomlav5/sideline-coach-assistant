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

interface PlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubs: Club[];
  onPlayerCreated: () => void;
}

export function PlayerDialog({ open, onOpenChange, clubs, onPlayerCreated }: PlayerDialogProps) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    first_name: '',
    last_name: '',
    jersey_number: '',
    club_id: '',
  });

  const createPlayer = async () => {
    if (!newPlayer.first_name.trim() || !newPlayer.last_name.trim() || !newPlayer.club_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
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

      const { error } = await supabase
        .from('players')
        .insert([playerData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Player created successfully",
      });

      onOpenChange(false);
      setNewPlayer({ first_name: '', last_name: '', jersey_number: '', club_id: '' });
      onPlayerCreated();
    } catch (error) {
      console.error('Error creating player:', error);
      toast({
        title: "Error",
        description: "Failed to create player",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setNewPlayer({ first_name: '', last_name: '', jersey_number: '', club_id: '' });
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