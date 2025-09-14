import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number | null;
}

interface SubstitutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerOut: string;
  playerIn: string;
  onPlayersChange: (playerOut: string, playerIn: string) => void;
  activePlayers: Player[];
  substitutePlayers: Player[];
  onConfirm: () => void;
  isHalftime?: boolean;
}

export function SubstitutionDialog({
  open,
  onOpenChange,
  playerOut,
  playerIn,
  onPlayersChange,
  activePlayers,
  substitutePlayers,
  onConfirm,
  isHalftime = false
}: SubstitutionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            {isHalftime ? 'Halftime Substitution' : 'Make Substitution'}
          </DialogTitle>
          <DialogDescription>
            {isHalftime 
              ? 'Set up changes for the second half. Players will be swapped when the second half begins.'
              : 'Replace a player currently on the field'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Player Coming Off</Label>
            <Select 
              value={playerOut} 
              onValueChange={(value) => onPlayersChange(value, playerIn)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select player to substitute" />
              </SelectTrigger>
              <SelectContent>
                {activePlayers.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.jersey_number ? `#${player.jersey_number} ` : ''}{player.first_name} {player.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Player Coming On</Label>
            <Select 
              value={playerIn} 
              onValueChange={(value) => onPlayersChange(playerOut, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select substitute player" />
              </SelectTrigger>
              <SelectContent>
                {substitutePlayers.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.jersey_number ? `#${player.jersey_number} ` : ''}{player.first_name} {player.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={onConfirm} 
              disabled={!playerOut || !playerIn}
            >
              Make Substitution
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}