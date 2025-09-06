import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Target } from 'lucide-react';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
}

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'goal' | 'assist';
  isOurTeam: boolean;
  selectedPlayer: string;
  assistPlayer: string;
  players: Player[];
  onTypeChange: (type: 'goal' | 'assist') => void;
  onTeamChange: (isOurTeam: boolean) => void;
  onPlayerChange: (playerId: string) => void;
  onAssistPlayerChange: (playerId: string) => void;
  onConfirm: () => void;
}

export function EventDialog({
  open,
  onOpenChange,
  type,
  isOurTeam,
  selectedPlayer,
  assistPlayer,
  players,
  onTypeChange,
  onTeamChange,
  onPlayerChange,
  onAssistPlayerChange,
  onConfirm
}: EventDialogProps) {
  const [isPenalty, setIsPenalty] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    setIsPenalty(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
    setIsPenalty(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Record Goal
          </DialogTitle>
          <DialogDescription>
            Record a goal and optional assist for the match
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="our-team" 
              checked={isOurTeam}
              onCheckedChange={onTeamChange}
            />
            <Label htmlFor="our-team">Our team scored</Label>
          </div>

          {isOurTeam && (
            <>
              <div>
                <Label>Goal Scorer</Label>
                <Select value={selectedPlayer} onValueChange={onPlayerChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select player who scored" />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        #{player.jersey_number || '?'} {player.first_name} {player.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Assist (Optional)</Label>
                <Select value={assistPlayer} onValueChange={onAssistPlayerChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select player who assisted (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No assist</SelectItem>
                    {players
                      .filter(player => player.id !== selectedPlayer)
                      .map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          #{player.jersey_number || '?'} {player.first_name} {player.last_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="penalty" 
                  checked={isPenalty}
                  onCheckedChange={(checked) => setIsPenalty(checked === true)}
                />
                <Label htmlFor="penalty">Penalty goal</Label>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleConfirm} disabled={isOurTeam && !selectedPlayer}>
              Record Goal
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}