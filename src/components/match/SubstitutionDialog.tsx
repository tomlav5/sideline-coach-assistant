import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Plus, X } from 'lucide-react';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number | null;
}

export interface SubstitutionPair {
  id: string;
  playerOut: string;
  playerIn: string;
}

interface SubstitutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activePlayers: Player[];
  substitutePlayers: Player[];
  onConfirm: (pairs: SubstitutionPair[]) => void;
  isHalftime?: boolean;
}

export function SubstitutionDialog({
  open,
  onOpenChange,
  activePlayers,
  substitutePlayers,
  onConfirm,
  isHalftime = false
}: SubstitutionDialogProps) {
  const isMobile = useIsMobile();
  const [substitutionPairs, setSubstitutionPairs] = useState<SubstitutionPair[]>([{
    id: crypto.randomUUID(),
    playerOut: '',
    playerIn: ''
  }]);

  // Reset pairs when dialog opens
  useEffect(() => {
    if (open) {
      setSubstitutionPairs([{
        id: crypto.randomUUID(),
        playerOut: '',
        playerIn: ''
      }]);
    }
  }, [open]);

  const addSubstitutionPair = () => {
    setSubstitutionPairs([...substitutionPairs, {
      id: crypto.randomUUID(),
      playerOut: '',
      playerIn: ''
    }]);
  };

  const removeSubstitutionPair = (id: string) => {
    if (substitutionPairs.length > 1) {
      setSubstitutionPairs(substitutionPairs.filter(pair => pair.id !== id));
    }
  };

  const updatePair = (id: string, field: 'playerOut' | 'playerIn', value: string) => {
    setSubstitutionPairs(substitutionPairs.map(pair => 
      pair.id === id ? { ...pair, [field]: value } : pair
    ));
  };

  const getUsedPlayerOutIds = (excludeId: string) => {
    return substitutionPairs
      .filter(pair => pair.id !== excludeId && pair.playerOut)
      .map(pair => pair.playerOut);
  };

  const getUsedPlayerInIds = (excludeId: string) => {
    return substitutionPairs
      .filter(pair => pair.id !== excludeId && pair.playerIn)
      .map(pair => pair.playerIn);
  };

  const isValid = substitutionPairs.every(pair => pair.playerOut && pair.playerIn) && 
                  substitutionPairs.length > 0;

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(substitutionPairs);
      onOpenChange(false);
    }
  };

  const content = (
    <div className="space-y-4">
      <div className="space-y-3">
        {substitutionPairs.map((pair, index) => (
          <div key={pair.id} className="p-3 border rounded-lg space-y-3 relative">
            {substitutionPairs.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-6 w-6 p-0"
                onClick={() => removeSubstitutionPair(pair.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <div className="text-sm font-medium text-muted-foreground">Substitution {index + 1}</div>
            
            <div>
              <Label>Player Coming Off</Label>
              <Select 
                value={pair.playerOut} 
                onValueChange={(value) => updatePair(pair.id, 'playerOut', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select player to substitute" />
                </SelectTrigger>
                <SelectContent>
                  {activePlayers
                    .filter(player => !getUsedPlayerOutIds(pair.id).includes(player.id))
                    .map((player) => (
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
                value={pair.playerIn} 
                onValueChange={(value) => updatePair(pair.id, 'playerIn', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select substitute player" />
                </SelectTrigger>
                <SelectContent>
                  {substitutePlayers
                    .filter(player => !getUsedPlayerInIds(pair.id).includes(player.id))
                    .map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.jersey_number ? `#${player.jersey_number} ` : ''}{player.first_name} {player.last_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={addSubstitutionPair}
        className="w-full"
        disabled={activePlayers.length <= substitutionPairs.length || substitutePlayers.length <= substitutionPairs.length}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Another Substitution
      </Button>

      <div className="flex gap-2 pt-4">
        <Button 
          onClick={handleConfirm} 
          disabled={!isValid}
          className="flex-1"
        >
          Make {substitutionPairs.length > 1 ? `${substitutionPairs.length} Substitutions` : 'Substitution'}
        </Button>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85dvh] p-4 overflow-auto pb-[max(16px,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              {isHalftime ? 'Halftime Substitution' : 'Make Substitution'}
            </SheetTitle>
            <SheetDescription>
              {isHalftime 
                ? 'Set up changes for the second half. Players will be swapped when the second half begins.'
                : 'Replace one or more players currently on the field. You can make multiple substitutions at once.'
              }
            </SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-standard">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            {isHalftime ? 'Halftime Substitution' : 'Make Substitution'}
          </DialogTitle>
          <DialogDescription>
            {isHalftime 
              ? 'Set up changes for the second half. Players will be swapped when the second half begins.'
              : 'Replace one or more players currently on the field. You can make multiple substitutions at once.'
            }
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}