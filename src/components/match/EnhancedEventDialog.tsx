import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { PlayerSelector } from '@/components/match/PlayerSelector';

// Floodlight — see docs/brand/BRAND.md. Scoped locally, per the precedent set by the
// header/tile-grid branches (DESIGN-002 covers the app-wide token migration). These
// notice panels are informational, not the dialog's action, so Pitch Blue — matching
// the same informational treatment used in MatchLockingBanner.
const INFO_BG = 'rgba(11, 95, 204, 0.08)';
const INFO_BORDER = 'rgba(11, 95, 204, 0.35)';
const INFO_TEXT = '#0B5FCC';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface MatchPeriod {
  id: string;
  period_number: number;
  period_type?: 'period' | 'penalties';
  planned_duration_minutes: number;
}

interface EnhancedEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixtureId: string;
  currentPeriod?: MatchPeriod;
  currentMinute: number;
  totalMatchMinute: number;
  /**
   * Flat squad list. Used as-is (with a DB fallback fetch if empty) when
   * `pitchPlayers`/`benchPlayers` are omitted — the shape the post-match
   * editor (`EventsTable.tsx`) passes, which has no live on-pitch/bench split.
   */
  players: Player[];
  /**
   * On-pitch and bench players, in the SAME order as the match screen's
   * player tile grid (UX-029) — both are just the committed lineup order,
   * pitch/bench split, so reusing them here means the scorer list never
   * invents a second ordering. When provided, these replace `players` for
   * display: the scorer/assist pickers show "On pitch" then "Bench" as two
   * ordered groups instead of one flat list, so a substituted-off scorer
   * stays reachable (UX-029).
   */
  pitchPlayers?: Player[];
  benchPlayers?: Player[];
  onEventRecorded?: () => void;
}

export function EnhancedEventDialog({
  open,
  onOpenChange,
  fixtureId,
  currentPeriod,
  currentMinute,
  totalMatchMinute,
  players,
  pitchPlayers,
  benchPlayers,
  onEventRecorded
}: EnhancedEventDialogProps) {
  const isMobile = useIsMobile();
  const [eventType, setEventType] = useState<'goal'>('goal');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [assistPlayer, setAssistPlayer] = useState('');
  const [isOurTeam, setIsOurTeam] = useState(true);
  const [isPenalty, setIsPenalty] = useState(false);
  const [customMinute, setCustomMinute] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resolvedPeriod, setResolvedPeriod] = useState<MatchPeriod | undefined>(currentPeriod);
  const [activePlayers, setActivePlayers] = useState<Player[]>(players);

  useEffect(() => {
    // On open, resolve current period if not provided and load active players
    const loadContext = async () => {
      try {
        // Resolve current period
        if (!currentPeriod) {
          const { data: fx, error: fxErr } = await supabase
            .from('fixtures')
            .select('current_period_id')
            .eq('id', fixtureId)
            .single();
          if (fxErr) throw fxErr;
          if (fx?.current_period_id) {
            const { data: period, error: pErr } = await supabase
              .from('match_periods')
              .select('id, period_number, period_type, planned_duration_minutes')
              .eq('id', fx.current_period_id)
              .single();
            if (pErr) throw pErr;
            setResolvedPeriod(period as any);
          } else {
            setResolvedPeriod(undefined);
          }
        } else {
          setResolvedPeriod(currentPeriod);
        }

        // The pitch/bench split (when the caller has one) drives display
        // directly via playerGroups below — this flat-list resolution is
        // only for callers without it (the post-match editor).
        if (!pitchPlayers && !benchPlayers) {
          // Use players passed from parent (active players) or fallback to all available players
          setActivePlayers(players);

          // Fallback: if empty, load team players from DB
          if (!players || players.length === 0) {
            try {
              const { data: fx2 } = await supabase
                .from('fixtures')
                .select('team_id')
                .eq('id', fixtureId)
                .single();
              if (fx2?.team_id) {
                const { data: teamPlayers } = await supabase
                  .from('team_players')
                  .select('players(*)')
                  .eq('team_id', fx2.team_id);
                const fallback = (teamPlayers || [])
                  .map((tp: any) => tp.players)
                  .filter(Boolean);
                if (fallback.length > 0) setActivePlayers(fallback as any);
              }
            } catch (err) {
              console.warn('Fallback player load failed:', err);
            }
          }
        }
      } catch (e) {
        console.error('Failed loading event context:', e);
        setResolvedPeriod(currentPeriod);
        setActivePlayers(players);
      }
    };

    if (open) {
      loadContext();
    }
  }, [open, fixtureId, currentPeriod, players, pitchPlayers, benchPlayers]);

  // UX-029: when the caller supplies the live pitch/bench split, show it as
  // two ordered groups — "On pitch" first, in tile-grid order, then "Bench"
  // (also in tile-grid order) — rather than one flat, unstably-ordered list.
  // `undefined` here tells PlayerSelector to fall back to its flat `players`
  // prop, which is how the post-match editor (no pitch/bench state) keeps
  // working unchanged.
  const playerGroups = useMemo(() => {
    if (!pitchPlayers && !benchPlayers) return undefined;
    return [
      { label: 'On pitch', players: pitchPlayers ?? [] },
      { label: 'Bench', players: benchPlayers ?? [] },
    ];
  }, [pitchPlayers, benchPlayers]);

  const availableCount = playerGroups
    ? (pitchPlayers?.length ?? 0) + (benchPlayers?.length ?? 0)
    : activePlayers.length;

  const handleSubmit = async () => {
    if (!resolvedPeriod) {
      console.error('No active period to record event');
      return;
    }

    if (eventType === 'goal' && !selectedPlayer && isOurTeam) {
      console.error('Please select a player for the goal');
      return;
    }

    setIsLoading(true);

    try {
      const isPenaltyPeriod = resolvedPeriod.period_type === 'penalties';
      const minuteToUse = customMinute ? parseInt(customMinute) : currentMinute;
      
      const eventData = {
        fixture_id: fixtureId,
        period_id: (resolvedPeriod || currentPeriod)!.id,
        event_type: eventType,
        player_id: selectedPlayer || null,
        assist_player_id: assistPlayer || null,
        minute_in_period: minuteToUse,
        total_match_minute: customMinute ? totalMatchMinute + (parseInt(customMinute) - currentMinute) : totalMatchMinute,
        is_our_team: isOurTeam,
        is_penalty: eventType === 'goal' ? (isPenaltyPeriod || isPenalty) : false,
        notes: notes || null,
        is_retrospective: false,
        client_event_id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };

      const { error } = await supabase
        .from('match_events')
        .upsert(eventData, { onConflict: 'client_event_id' });

      if (error) throw error;

      // Reset form
      setSelectedPlayer('');
      setAssistPlayer('');
      setIsPenalty(false);
      setCustomMinute('');
      setNotes('');
      
      onEventRecorded?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error recording event:', error);
      console.error('Failed to record event:', error?.message);
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <div className="space-y-4 px-1">
          {/* Event Type - Only Goal (assists are recorded as attributes of goals) */}
          <div className="p-3 rounded-lg border" style={{ backgroundColor: INFO_BG, borderColor: INFO_BORDER }}>
            <div className="text-sm font-medium" style={{ color: INFO_TEXT }}>⚽ Recording Goal Event</div>
            <div className="text-xs mt-1" style={{ color: INFO_TEXT }}>Assists are recorded below as part of the goal</div>
          </div>

          {/* Team Selection */}
          <div className="space-y-2">
            <Label>Team</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isOurTeam ? 'default' : 'outline'}
                onClick={() => setIsOurTeam(true)}
                className="flex-1"
              >
                Our Team
              </Button>
              <Button
                type="button"
                variant={!isOurTeam ? 'destructive' : 'outline'}
                onClick={() => setIsOurTeam(false)}
                className="flex-1"
              >
                Opponent
              </Button>
            </div>
          </div>

          {/* Player Selection (only for our team) */}
          {isOurTeam && (
            <div>
              <Label>Goal Scorer</Label>
              <PlayerSelector
                players={activePlayers}
                groups={playerGroups}
                value={selectedPlayer}
                onValueChange={(value) => {
                  setSelectedPlayer(value);
                  // Clear assist player when scorer changes to avoid confusion
                  setAssistPlayer('');
                }}
                placeholder="Select goal scorer"
                emptyMessage="No active players available"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {availableCount} player{availableCount !== 1 ? 's' : ''} available • Type to search
              </p>
            </div>
          )}

          {/* Assist Player (only for goals from our team, not in penalty shootout) */}
          {eventType === 'goal' && isOurTeam && resolvedPeriod?.period_type !== 'penalties' && (
            <div>
              <Label>Assist Player (optional)</Label>
              <PlayerSelector
                players={activePlayers}
                groups={playerGroups}
                value={assistPlayer === '' ? 'none' : assistPlayer}
                onValueChange={(v) => setAssistPlayer(v === 'none' ? '' : v)}
                placeholder="Select assist player"
                emptyMessage="No players available"
                excludePlayerId={selectedPlayer}
                allowNone={true}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Search cleared • Type to find a player
              </p>
            </div>
          )}

          {/* Penalty Checkbox (only for goals, not in penalty shootout) */}
          {eventType === 'goal' && (!resolvedPeriod || resolvedPeriod.period_type !== 'penalties') && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="penalty"
                checked={isPenalty}
                onCheckedChange={(checked) => setIsPenalty(checked === true)}
              />
              <Label htmlFor="penalty">Penalty Kick</Label>
            </div>
          )}

          {/* Penalty shootout indicator */}
          {resolvedPeriod?.period_type === 'penalties' && (
            <div className="p-3 rounded-lg border" style={{ backgroundColor: INFO_BG, borderColor: INFO_BORDER }}>
              <div className="text-sm font-medium" style={{ color: INFO_TEXT }}>⚽ Penalty Shootout</div>
              <div className="text-xs" style={{ color: INFO_TEXT }}>All goals are automatically marked as penalties</div>
            </div>
          )}

          {/* Time Override / Shot Number */}
          <div>
            <Label>
              {resolvedPeriod?.period_type === 'penalties' 
                ? 'Shot Number (leave empty for automatic)' 
                : `Minute (leave empty for current time: ${currentMinute})`}
            </Label>
            <Input
              type="number"
              value={customMinute}
              onChange={(e) => setCustomMinute(e.target.value)}
              placeholder={`Current: ${currentMinute}`}
              min={0}
              max={currentPeriod?.planned_duration_minutes || 90}
            />
          </div>

          {/* Notes */}
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this event..."
            />
          </div>

          {/* Current Context */}
          {resolvedPeriod && (
            <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
              {resolvedPeriod.period_type === 'penalties' 
                ? `⚽ Penalty Shootout • Shot ${currentMinute}` 
                : `P${resolvedPeriod.period_number} • Minute ${currentMinute} • Total ${totalMatchMinute}`}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !resolvedPeriod}
              className="flex-1"
            >
              {isLoading ? 'Recording...' : `Record ${eventType.charAt(0).toUpperCase() + eventType.slice(1)}`}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
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
            <SheetTitle>Record Match Event</SheetTitle>
            <SheetDescription>Choose team, player, and details, then record the event.</SheetDescription>
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
          <DialogTitle>Record Match Event</DialogTitle>
          <DialogDescription>Choose team, player, and details, then record the event.</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}