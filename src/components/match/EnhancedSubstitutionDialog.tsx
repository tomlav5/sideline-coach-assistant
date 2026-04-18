import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUpDown, Plus, X, Search, ArrowRight, Check } from 'lucide-react';

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

interface EnhancedSubstitutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activePlayers: Player[];
  substitutePlayers: Player[];
  onConfirm: (pairs: SubstitutionPair[]) => void;
  isHalftime?: boolean;
  preSelectedPlayerIn?: string;
}

const RECENT_SUBS_KEY = 'sideline-recent-subs';
const MAX_RECENT_SUBS = 5;

export function EnhancedSubstitutionDialog({
  open,
  onOpenChange,
  activePlayers,
  substitutePlayers,
  onConfirm,
  isHalftime = false,
  preSelectedPlayerIn
}: EnhancedSubstitutionDialogProps) {
  const isMobile = useIsMobile();
  
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  const [substitutionPairs, setSubstitutionPairs] = useState<SubstitutionPair[]>([]);
  const [currentStep, setCurrentStep] = useState<'select-in' | 'select-out' | 'review'>('select-in');
  const [currentPairId, setCurrentPairId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [recentSubsIn, setRecentSubsIn] = useState<string[]>([]);

  // Load recent subs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SUBS_KEY);
      if (stored) {
        setRecentSubsIn(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load recent subs:', error);
    }
  }, []);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setSubstitutionPairs([]);
      setSearchTerm('');
      if (preSelectedPlayerIn) {
        // Start with pre-selected player
        const newPairId = generateId();
        setCurrentPairId(newPairId);
        setSubstitutionPairs([{ id: newPairId, playerOut: '', playerIn: preSelectedPlayerIn }]);
        setCurrentStep('select-out');
      } else {
        setCurrentStep('select-in');
        setCurrentPairId(null);
      }
    }
  }, [open, preSelectedPlayerIn]);

  const addRecentSub = (playerId: string) => {
    try {
      const updated = [playerId, ...recentSubsIn.filter(id => id !== playerId)].slice(0, MAX_RECENT_SUBS);
      setRecentSubsIn(updated);
      localStorage.setItem(RECENT_SUBS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent sub:', error);
    }
  };

  const handlePlayerInSelected = (playerId: string) => {
    const newPairId = generateId();
    setCurrentPairId(newPairId);
    setSubstitutionPairs([...substitutionPairs, { id: newPairId, playerOut: '', playerIn: playerId }]);
    setSearchTerm('');
    setCurrentStep('select-out');
  };

  const handlePlayerOutSelected = (playerId: string) => {
    if (!currentPairId) return;
    
    setSubstitutionPairs(
      substitutionPairs.map(pair =>
        pair.id === currentPairId ? { ...pair, playerOut: playerId } : pair
      )
    );
    
    addRecentSub(substitutionPairs.find(p => p.id === currentPairId)!.playerIn);
    setSearchTerm('');
    setCurrentStep('review');
    setCurrentPairId(null);
  };

  const removePair = (id: string) => {
    setSubstitutionPairs(substitutionPairs.filter(pair => pair.id !== id));
    if (substitutionPairs.length === 1) {
      // If removing last pair, go back to start
      setCurrentStep('select-in');
    }
  };

  const handleAddAnother = () => {
    setSearchTerm('');
    setCurrentStep('select-in');
  };

  const handleConfirm = () => {
    if (substitutionPairs.length > 0 && substitutionPairs.every(p => p.playerIn && p.playerOut)) {
      onConfirm(substitutionPairs);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setSubstitutionPairs([]);
    setCurrentStep('select-in');
    setSearchTerm('');
    onOpenChange(false);
  };

  const getPlayerDisplay = (player: Player) => {
    const number = player.jersey_number ? `#${player.jersey_number}` : '';
    return `${number} ${player.first_name} ${player.last_name}`.trim();
  };

  // Filter out already selected players
  const usedSubIds = substitutionPairs.map(p => p.playerIn);
  const usedActiveIds = substitutionPairs.map(p => p.playerOut).filter(Boolean);
  
  const availableSubPlayers = substitutePlayers.filter(p => !usedSubIds.includes(p.id));
  const availableActivePlayers = activePlayers.filter(p => !usedActiveIds.includes(p.id));

  // Search filtering
  const filteredSubPlayers = availableSubPlayers.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.jersey_number?.toString().includes(searchTerm)
  );

  const filteredActivePlayers = availableActivePlayers.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.jersey_number?.toString().includes(searchTerm)
  );

  // Recent subs players
  const recentSubPlayers = recentSubsIn
    .map(id => substitutePlayers.find(p => p.id === id))
    .filter((p): p is Player => !!p && availableSubPlayers.some(ap => ap.id === p.id));

  // Step 1: Select Player Coming ON
  const selectInContent = (
    <div className="space-y-4">
      {/* Recent Subs */}
      {recentSubPlayers.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2 text-muted-foreground">Recent Substitutes (Quick Tap)</p>
          <div className="grid grid-cols-1 gap-2">
            {recentSubPlayers.map(player => (
              <Button
                key={player.id}
                onClick={() => handlePlayerInSelected(player.id)}
                size="lg"
                variant="outline"
                className="h-14 justify-start font-medium hover:bg-yellow-50 dark:hover:bg-yellow-950 hover:border-yellow-500"
              >
                <ArrowUpDown className="h-5 w-5 mr-3 text-yellow-600" />
                {player.jersey_number && (
                  <Badge variant="outline" className="mr-2">
                    #{player.jersey_number}
                  </Badge>
                )}
                <span className="flex-1 text-left">{player.first_name} {player.last_name}</span>
                <Check className="h-4 w-4 text-yellow-600" />
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search substitute players..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          autoFocus={!isMobile}
        />
      </div>

      {/* All Substitute Players */}
      <div>
        <p className="text-sm font-medium mb-2 text-muted-foreground">All Substitute Players</p>
        <ScrollArea className="h-[300px] border rounded-lg bg-muted/30">
          <div className="space-y-1 p-3">
            {filteredSubPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {availableSubPlayers.length === 0 ? 'All substitutes have been used' : 'No players found'}
              </p>
            ) : (
              filteredSubPlayers.map(player => (
                <Button
                  key={player.id}
                  onClick={() => handlePlayerInSelected(player.id)}
                  variant="ghost"
                  className="w-full h-12 justify-start font-normal bg-background hover:bg-accent"
                >
                  {player.jersey_number && (
                    <Badge variant="outline" className="mr-2">
                      #{player.jersey_number}
                    </Badge>
                  )}
                  {player.first_name} {player.last_name}
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );

  // Step 2: Select Player Coming OFF
  const currentPair = substitutionPairs.find(p => p.id === currentPairId);
  const playerComingIn = currentPair ? substitutePlayers.find(p => p.id === currentPair.playerIn) : null;

  const selectOutContent = (
    <div className="space-y-4">
      {/* Show selected player coming in */}
      {playerComingIn && (
        <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <div className="text-xs font-medium text-muted-foreground mb-1">COMING ON</div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-green-600" />
            {playerComingIn.jersey_number && (
              <Badge variant="outline" className="border-green-600 text-green-700">
                #{playerComingIn.jersey_number}
              </Badge>
            )}
            <span className="font-semibold">{playerComingIn.first_name} {playerComingIn.last_name}</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search active players..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          autoFocus={!isMobile}
        />
      </div>

      {/* Active Players */}
      <div>
        <p className="text-sm font-medium mb-2 text-muted-foreground">Select Player Coming OFF</p>
        <ScrollArea className="h-[300px] border rounded-lg bg-muted/30">
          <div className="space-y-1 p-3">
            {filteredActivePlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {availableActivePlayers.length === 0 ? 'All active players have been subbed' : 'No players found'}
              </p>
            ) : (
              filteredActivePlayers.map(player => (
                <Button
                  key={player.id}
                  onClick={() => handlePlayerOutSelected(player.id)}
                  variant="ghost"
                  className="w-full h-12 justify-start font-normal bg-background hover:bg-accent"
                >
                  {player.jersey_number && (
                    <Badge variant="outline" className="mr-2">
                      #{player.jersey_number}
                    </Badge>
                  )}
                  {player.first_name} {player.last_name}
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <Button
        variant="outline"
        onClick={() => {
          // Cancel current pair and go back
          setSubstitutionPairs(substitutionPairs.filter(p => p.id !== currentPairId));
          setCurrentStep('select-in');
          setSearchTerm('');
        }}
        className="w-full"
      >
        ← Back
      </Button>
    </div>
  );

  // Step 3: Review all substitutions
  const reviewContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Substitutions to Make ({substitutionPairs.length})</p>
        {substitutionPairs.map((pair, index) => {
          const playerIn = substitutePlayers.find(p => p.id === pair.playerIn);
          const playerOut = activePlayers.find(p => p.id === pair.playerOut);
          
          return (
            <div key={pair.id} className="p-3 border rounded-lg space-y-2 relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-6 w-6 p-0"
                onClick={() => removePair(pair.id)}
              >
                <X className="h-4 w-4" />
              </Button>
              
              <div className="text-xs font-medium text-muted-foreground">SUBSTITUTION {index + 1}</div>
              
              <div className="flex items-center gap-3">
                {/* Player OUT */}
                <div className="flex-1 p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <div className="text-[10px] font-medium text-muted-foreground mb-1">OFF</div>
                  <div className="flex items-center gap-1">
                    {playerOut?.jersey_number && (
                      <Badge variant="outline" className="text-xs">
                        #{playerOut.jersey_number}
                      </Badge>
                    )}
                    <span className="text-sm font-medium truncate">
                      {playerOut?.first_name} {playerOut?.last_name}
                    </span>
                  </div>
                </div>

                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />

                {/* Player IN */}
                <div className="flex-1 p-2 rounded bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <div className="text-[10px] font-medium text-muted-foreground mb-1">ON</div>
                  <div className="flex items-center gap-1">
                    {playerIn?.jersey_number && (
                      <Badge variant="outline" className="text-xs">
                        #{playerIn.jersey_number}
                      </Badge>
                    )}
                    <span className="text-sm font-medium truncate">
                      {playerIn?.first_name} {playerIn?.last_name}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        variant="outline"
        onClick={handleAddAnother}
        className="w-full"
        disabled={availableSubPlayers.length === 0 || availableActivePlayers.length === 0}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Another Substitution
      </Button>

      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleConfirm}
          className="flex-1 h-12 text-base font-semibold bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-800"
        >
          <Check className="h-5 w-5 mr-2" />
          Make {substitutionPairs.length > 1 ? `${substitutionPairs.length} Subs` : 'Substitution'}
        </Button>
        <Button variant="outline" onClick={handleCancel} className="flex-1 h-12">
          Cancel
        </Button>
      </div>
    </div>
  );

  const content = currentStep === 'select-in' ? selectInContent : 
                  currentStep === 'select-out' ? selectOutContent : 
                  reviewContent;

  const title = currentStep === 'select-in' ? 'Who is Coming ON?' :
                currentStep === 'select-out' ? 'Who is Coming OFF?' :
                'Review Substitutions';

  const description = currentStep === 'select-in' ? 'Select substitute player to bring on' :
                      currentStep === 'select-out' ? 'Select active player to take off' :
                      'Review and confirm all substitutions';

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85dvh] p-4 overflow-auto pb-[max(16px,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              {title}
            </SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
