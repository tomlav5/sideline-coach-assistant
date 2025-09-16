import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface MatchPeriod {
  id: string;
  period_number: number;
  planned_duration_minutes: number;
}

interface EnhancedEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixtureId: string;
  currentPeriod?: MatchPeriod;
  currentMinute: number;
  totalMatchMinute: number;
  players: Player[];
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
  onEventRecorded
}: EnhancedEventDialogProps) {
  const [eventType, setEventType] = useState<'goal' | 'assist'>('goal');
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
              .select('id, period_number, planned_duration_minutes')
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
      } catch (e) {
        console.error('Failed loading event context:', e);
        setResolvedPeriod(currentPeriod);
        setActivePlayers(players);
      }
    };

    if (open) {
      loadContext();
    }
  }, [open, fixtureId, currentPeriod, players]);

  const handleSubmit = async () => {
    if (!resolvedPeriod) {
      toast.error('No active period to record event');
      return;
    }

    if (eventType === 'goal' && !selectedPlayer && isOurTeam) {
      toast.error('Please select a player for the goal');
      return;
    }

    setIsLoading(true);

    try {
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
        is_penalty: eventType === 'goal' ? isPenalty : false,
        notes: notes || null,
        is_retrospective: false,
      };

      const { error } = await supabase
        .from('match_events')
        .insert(eventData);

      if (error) throw error;

      toast.success(`${eventType.charAt(0).toUpperCase() + eventType.slice(1)} recorded successfully`);
      
      // Reset form
      setSelectedPlayer('');
      setAssistPlayer('');
      setIsPenalty(false);
      setCustomMinute('');
      setNotes('');
      
      onEventRecorded?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error recording event:', error);
      toast.error('Failed to record event');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Match Event</DialogTitle>
          <DialogDescription>Choose team, player, and details, then record the event.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-1">
          {/* Event Type */}
          <div>
            <Label>Event Type</Label>
            <Select value={eventType} onValueChange={(value: 'goal' | 'assist') => setEventType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="goal">Goal</SelectItem>
                <SelectItem value="assist">Assist</SelectItem>
              </SelectContent>
            </Select>
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
              <Label>Player</Label>
              <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  {activePlayers.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.first_name} {player.last_name}
                      {player.jersey_number && ` (#${player.jersey_number})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Assist Player (only for goals from our team) */}
          {eventType === 'goal' && isOurTeam && (
            <div>
              <Label>Assist Player (optional)</Label>
              <Select
                value={assistPlayer === '' ? 'none' : assistPlayer}
                onValueChange={(v) => setAssistPlayer(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assist player" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No assist</SelectItem>
                  {activePlayers
                    .filter(p => p.id !== selectedPlayer)
                    .map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.first_name} {player.last_name}
                      {player.jersey_number && ` (#${player.jersey_number})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Penalty Checkbox (only for goals) */}
          {eventType === 'goal' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="penalty"
                checked={isPenalty}
                onCheckedChange={(checked) => setIsPenalty(checked === true)}
              />
              <Label htmlFor="penalty">Penalty</Label>
            </div>
          )}

          {/* Time Override */}
          <div>
            <Label>Minute (leave empty for current time: {currentMinute})</Label>
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
              P{resolvedPeriod.period_number} • Minute {currentMinute} • Total {totalMatchMinute}
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
      </DialogContent>
    </Dialog>
  );
}