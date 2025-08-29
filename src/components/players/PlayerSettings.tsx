import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

interface Club {
  id: string;
  name: string;
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  club_id: string;
  created_at: string;
  club: Club;
}

interface PlayerSettingsProps {
  player: Player;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlayerUpdate: () => void;
}

export function PlayerSettings({ player, open, onOpenChange, onPlayerUpdate }: PlayerSettingsProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editedPlayer, setEditedPlayer] = useState({
    first_name: player.first_name,
    last_name: player.last_name,
    jersey_number: player.jersey_number?.toString() || '',
  });

  const updatePlayer = async () => {
    if (!editedPlayer.first_name.trim() || !editedPlayer.last_name.trim()) {
      toast({
        title: "Error",
        description: "First name and last name are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const updateData: any = {
        first_name: editedPlayer.first_name.trim(),
        last_name: editedPlayer.last_name.trim(),
      };

      if (editedPlayer.jersey_number) {
        updateData.jersey_number = parseInt(editedPlayer.jersey_number);
      } else {
        updateData.jersey_number = null;
      }

      const { error } = await supabase
        .from('players')
        .update(updateData)
        .eq('id', player.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Player updated successfully",
      });

      onOpenChange(false);
      onPlayerUpdate();
    } catch (error) {
      console.error('Error updating player:', error);
      toast({
        title: "Error",
        description: "Failed to update player",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deletePlayer = async () => {
    try {
      setDeleting(true);
      
      // First remove from all teams
      await supabase
        .from('team_players')
        .delete()
        .eq('player_id', player.id);

      // Then delete the player
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', player.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Player deleted successfully",
      });

      onOpenChange(false);
      onPlayerUpdate();
    } catch (error) {
      console.error('Error deleting player:', error);
      toast({
        title: "Error",
        description: "Failed to delete player",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    setEditedPlayer({
      first_name: player.first_name,
      last_name: player.last_name,
      jersey_number: player.jersey_number?.toString() || '',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Player Settings</DialogTitle>
          <DialogDescription>
            Edit player details or remove the player
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-first-name">First Name</Label>
              <Input
                id="edit-first-name"
                value={editedPlayer.first_name}
                onChange={(e) => setEditedPlayer({ ...editedPlayer, first_name: e.target.value })}
                placeholder="John"
              />
            </div>
            <div>
              <Label htmlFor="edit-last-name">Last Name</Label>
              <Input
                id="edit-last-name"
                value={editedPlayer.last_name}
                onChange={(e) => setEditedPlayer({ ...editedPlayer, last_name: e.target.value })}
                placeholder="Doe"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="edit-jersey-number">Jersey Number (Optional)</Label>
            <Input
              id="edit-jersey-number"
              type="number"
              value={editedPlayer.jersey_number}
              onChange={(e) => setEditedPlayer({ ...editedPlayer, jersey_number: e.target.value })}
              placeholder="10"
              min="1"
              max="99"
            />
          </div>
          
          <div className="flex justify-between pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Player
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Player</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{player.first_name} {player.last_name}"? 
                    This action cannot be undone and will remove the player from all teams.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deletePlayer} disabled={deleting}>
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-2">
              <Button onClick={updatePlayer} disabled={saving}>
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