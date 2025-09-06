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
  isPenalty: boolean;
  players: Player[];
  onTypeChange: (type: 'goal' | 'assist') => void;
  onTeamChange: (isOurTeam: boolean) => void;
  onPlayerChange: (playerId: string) => void;
  onAssistPlayerChange: (playerId: string) => void;
  onPenaltyChange: (isPenalty: boolean) => void;
  onConfirm: () => void;
}

export function EventDialog({
  open,
  onOpenChange,
  type,
  isOurTeam,
  selectedPlayer,
  assistPlayer,
  isPenalty,
  players,
  onTypeChange,
  onTeamChange,
  onPlayerChange,
  onAssistPlayerChange,
  onPenaltyChange,
  onConfirm
}: EventDialogProps) {

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onOpenChange(false);
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
            Record a goal for your team or the opposition
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Team Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Which team scored?</Label>
            <div className="grid grid-cols-2 gap-3">
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  isOurTeam 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
                onClick={() => onTeamChange(true)}
              >
                <div className="text-center">
                  <div className="font-semibold">Our Team</div>
                  <div className="text-sm opacity-75">Home/Away</div>
                </div>
              </div>
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  !isOurTeam 
                    ? 'border-destructive bg-destructive/10 text-destructive' 
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
                onClick={() => onTeamChange(false)}
              >
                <div className="text-center">
                  <div className="font-semibold">Opposition</div>
                  <div className="text-sm opacity-75">Opponent Goal</div>
                </div>
              </div>
            </div>
          </div>

          {/* Our Team Goal Details */}
          {isOurTeam && (
            <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 text-primary font-medium">
                <Target className="h-4 w-4" />
                Our Team Goal Details
              </div>
              
              <div>
                <Label>Goal Scorer *</Label>
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
                    <SelectItem value="none">No assist</SelectItem>
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

              <div className="flex items-center space-x-2 p-3 bg-background rounded border">
                <Checkbox 
                  id="penalty" 
                  checked={isPenalty}
                  onCheckedChange={onPenaltyChange}
                />
                <Label htmlFor="penalty" className="flex items-center gap-2">
                  <span>Penalty Goal</span>
                  <span className="text-xs text-muted-foreground">(scored from penalty spot)</span>
                </Label>
              </div>
            </div>
          )}

          {/* Opposition Goal Info */}
          {!isOurTeam && (
            <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
              <div className="flex items-center gap-2 text-destructive font-medium mb-2">
                <Target className="h-4 w-4" />
                Opposition Goal
              </div>
              <p className="text-sm text-muted-foreground">
                Recording a goal for the opposing team. No additional details required.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleConfirm} 
              disabled={isOurTeam && !selectedPlayer}
              className="flex-1"
            >
              {isOurTeam ? "Record Our Goal" : "Record Opposition Goal"}
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