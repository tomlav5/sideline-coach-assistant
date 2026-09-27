import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Goal } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PlayerPickerList } from '@/components/match/PlayerPickerList';

// Floodlight — see docs/brand/BRAND.md. Scoped locally, per the precedent set by the
// header/tile-grid branches (DESIGN-002 covers the app-wide token migration).
const FLOODLIGHT = {
  amber: '#F5A524',
  navy: '#101724',
  slate: '#5A6474',
};

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface QuickGoalButtonProps {
  /**
   * On-pitch and bench players, in the SAME order as the match screen's
   * player tile grid (UX-029) — see EnhancedEventDialog's equivalent props,
   * both fed from EnhancedMatchTracker's effectivePitch/effectiveBench so
   * this dialog and that one always show the same players in the same order.
   */
  pitchPlayers: Player[];
  benchPlayers: Player[];
  onGoalScored: (playerId: string, isOurTeam: boolean, assistPlayerId?: string, isPenalty?: boolean) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickGoalButton({ pitchPlayers, benchPlayers, onGoalScored, open, onOpenChange }: QuickGoalButtonProps) {
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOurTeam, setIsOurTeam] = useState(true);
  const [selectedScorer, setSelectedScorer] = useState<string | null>(null);
  const [showAssistSelect, setShowAssistSelect] = useState(false);
  const [isPenalty, setIsPenalty] = useState(false);

  // On-pitch first, then bench, both in tile-grid order (UX-029) — the
  // scorer step's own groups, passed straight to PlayerPickerList.
  const playerGroups = [
    { label: 'On pitch', players: pitchPlayers },
    { label: 'Bench', players: benchPlayers },
  ];

  const handleScorerSelected = (playerId: string) => {
    setSelectedScorer(playerId);
    // UX-033: don't carry a scorer-step search into the assist step — they
    // share this one `searchTerm` field across the two steps.
    setSearchTerm('');
    // Show assist selection for our team goals
    setShowAssistSelect(true);
  };

  const handleOpponentGoal = async () => {
    setIsLoading(true);
    try {
      // Opponent goals don't require player selection
      await onGoalScored('', false, undefined, isPenalty);
      resetDialog();
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoalScored = async (scorerId: string, assistId: string | null) => {
    setIsLoading(true);
    try {
      await onGoalScored(scorerId, isOurTeam, assistId || undefined, isPenalty);
      resetDialog();
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsLoading(false);
    }
  };

  const resetDialog = () => {
    onOpenChange(false);
    setSearchTerm('');
    setIsOurTeam(true);
    setSelectedScorer(null);
    setShowAssistSelect(false);
    setIsPenalty(false);
  };

  // UX-038: bench players stay selectable as the assist provider — a goal
  // recorded a little late can have a real assister who has since come off —
  // but grouped below On pitch, same as the scorer step, never presented as
  // equally likely. Scorer excluded from both groups (UX-033): a player
  // can't assist their own goal.
  const assistGroups = [
    { label: 'On pitch', players: pitchPlayers.filter(p => p.id !== selectedScorer) },
    { label: 'Bench', players: benchPlayers.filter(p => p.id !== selectedScorer) },
  ];

  const assistContent = (
    <PlayerPickerList
      groups={assistGroups}
      onSelect={(playerId) => handleGoalScored(selectedScorer!, playerId)}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Search for assist provider..."
      leadingAction={{ label: 'No Assist', onSelect: () => handleGoalScored(selectedScorer!, null) }}
      disabled={isLoading}
      autoFocusSearch={!isMobile}
    />
  );

  const content = (
    <div className="space-y-4">
      {/* Team Toggle */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <Button
          onClick={() => setIsOurTeam(true)}
          variant={isOurTeam ? "default" : "ghost"}
          className="flex-1"
          size="sm"
        >
          Our Goal
        </Button>
        <Button
          onClick={() => setIsOurTeam(false)}
          variant={!isOurTeam ? "default" : "ghost"}
          className="flex-1"
          size="sm"
        >
          Opponent Goal
        </Button>
      </div>

      {/* Opponent Goal - Simple Confirmation */}
      {!isOurTeam ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Record a goal for the opposing team
          </p>
          
          {/* Penalty Checkbox */}
          <div className="flex items-center justify-center space-x-2">
            <Checkbox
              id="penalty-opponent"
              checked={isPenalty}
              onCheckedChange={(checked) => setIsPenalty(checked === true)}
            />
            <Label htmlFor="penalty-opponent">Penalty Kick</Label>
          </div>
          
          <Button
            onClick={handleOpponentGoal}
            disabled={isLoading}
            size="lg"
            className="w-full h-16 text-lg font-semibold border-0 hover:brightness-95"
            style={{ backgroundColor: FLOODLIGHT.amber, color: FLOODLIGHT.navy }}
          >
            <Goal className="h-6 w-6 mr-3" />
            Confirm Opponent Goal
          </Button>
        </div>
      ) : (
        <>
          {/* Penalty Checkbox for Our Team */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="penalty-our-team"
              checked={isPenalty}
              onCheckedChange={(checked) => setIsPenalty(checked === true)}
            />
            <Label htmlFor="penalty-our-team">Penalty Kick</Label>
          </div>

          {/* Goal Scorer — on-pitch players first, then bench, both in the
              same order as the match screen's tile grid (UX-029). Replaces
              the old "Recent Scorers (Quick Tap)" localStorage list, which
              was global across matches and reshuffled after every goal.
              Inline list (UX-036), not a combobox — a coach tapping the
              amber Goal button touchline-side needs the names on screen in
              one tap, not a picker that opens a second control. */}
          <div>
            <p className="text-sm font-medium mb-2">Goal Scorer</p>
            <PlayerPickerList
              groups={playerGroups}
              onSelect={handleScorerSelected}
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              emptyMessage="No active players available"
              disabled={isLoading}
              autoFocusSearch={!isMobile}
            />
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Player Selection Dialog/Sheet */}
      {isMobile ? (
        <Sheet open={open} onOpenChange={(open) => !open && resetDialog()}>
          {/* overflow-auto: the inline picker list (UX-036) plus the team
              toggle/penalty checkbox above it can run taller than 85dvh on a
              small phone even though the list itself self-scrolls — without
              this the excess was simply clipped, not reachable by scrolling
              the sheet. Matches EnhancedEventDialog's Sheet, which already
              has this. */}
          <SheetContent side="bottom" className="h-[85dvh] p-4 overflow-auto">
            <SheetHeader>
              <SheetTitle>{showAssistSelect ? 'Who Assisted?' : 'Who Scored?'}</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              {showAssistSelect ? assistContent : content}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={(open) => !open && resetDialog()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{showAssistSelect ? 'Who Assisted?' : 'Who Scored?'}</DialogTitle>
            </DialogHeader>
            {showAssistSelect ? assistContent : content}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
