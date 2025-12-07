import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Goal, Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface QuickGoalButtonProps {
  players: Player[];
  onGoalScored: (playerId: string) => Promise<void>;
  disabled?: boolean;
}

const RECENT_SCORERS_KEY = 'sideline-recent-scorers';
const MAX_RECENT_SCORERS = 5;

export function QuickGoalButton({ players, onGoalScored, disabled }: QuickGoalButtonProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [recentScorers, setRecentScorers] = useState<string[]>([]);

  // Load recent scorers from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SCORERS_KEY);
      if (stored) {
        setRecentScorers(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load recent scorers:', error);
    }
  }, []);

  // Save recent scorers to localStorage
  const addRecentScorer = (playerId: string) => {
    try {
      const updated = [playerId, ...recentScorers.filter(id => id !== playerId)].slice(0, MAX_RECENT_SCORERS);
      setRecentScorers(updated);
      localStorage.setItem(RECENT_SCORERS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent scorer:', error);
    }
  };

  const handleGoalScored = async (playerId: string) => {
    setIsLoading(true);
    try {
      await onGoalScored(playerId);
      addRecentScorer(playerId);
      setOpen(false);
      setSearchTerm('');
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsLoading(false);
    }
  };

  // Filter players based on search
  const filteredPlayers = players.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.jersey_number?.toString().includes(searchTerm)
  );

  // Get recent scorer player objects
  const recentScorerPlayers = recentScorers
    .map(id => players.find(p => p.id === id))
    .filter((p): p is Player => !!p);

  const getPlayerDisplay = (player: Player) => {
    const number = player.jersey_number ? `#${player.jersey_number}` : '';
    return `${number} ${player.first_name} ${player.last_name}`.trim();
  };

  const content = (
    <div className="space-y-4">
      {/* Recent Scorers - Quick Tap */}
      {recentScorerPlayers.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Recent Scorers (Quick Tap)</p>
          <div className="grid grid-cols-1 gap-2">
            {recentScorerPlayers.map(player => (
              <Button
                key={player.id}
                onClick={() => handleGoalScored(player.id)}
                disabled={isLoading}
                size="lg"
                variant="outline"
                className="h-14 text-left justify-start font-medium hover:bg-green-50 dark:hover:bg-green-950 hover:border-green-500"
              >
                <Goal className="h-5 w-5 mr-3 text-green-600" />
                <span className="flex-1">{getPlayerDisplay(player)}</span>
                <Check className="h-4 w-4 text-green-600" />
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search player name or number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          autoFocus={!isMobile}
        />
      </div>

      {/* All Players */}
      <ScrollArea className="h-[300px]">
        <div className="space-y-1">
          <p className="text-sm font-medium mb-2">All Players</p>
          {filteredPlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No players found
            </p>
          ) : (
            filteredPlayers.map(player => (
              <Button
                key={player.id}
                onClick={() => handleGoalScored(player.id)}
                disabled={isLoading}
                variant="ghost"
                className="w-full h-12 justify-start font-normal hover:bg-green-50 dark:hover:bg-green-950"
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
  );

  return (
    <>
      {/* Large Goal Button */}
      <Button
        onClick={() => setOpen(true)}
        disabled={disabled || players.length === 0}
        size="lg"
        className="w-full h-16 text-lg font-bold bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
      >
        <Goal className="h-6 w-6 mr-3" />
        ⚽ GOAL
      </Button>

      {/* Player Selection Dialog/Sheet */}
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-[85dvh] p-4">
            <SheetHeader>
              <SheetTitle>Who Scored?</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              {content}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Who Scored?</DialogTitle>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
