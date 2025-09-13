import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

  const handleSubmit = async () => {
    if (!currentPeriod) {
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
        period_id: currentPeriod.id,
        event_type: eventType,
        player_id: selectedPlayer || null,
        assist_player_id: assistPlayer || null,
        minute_in_period: minuteToUse,
        total_match_minute: totalMatchMinute + (parseInt(customMinute || '0') - currentMinute),
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Match Event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
          <div className="flex items-center space-x-2">
            <Checkbox
              id="our-team"
              checked={isOurTeam}
              onCheckedChange={(checked) => setIsOurTeam(checked === true)}
            />
            <Label htmlFor="our-team">Our Team</Label>
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
                  {players.map((player) => (
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
              <Select value={assistPlayer} onValueChange={setAssistPlayer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assist player" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No assist</SelectItem>
                  {players
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
          {currentPeriod && (
            <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
              Period {currentPeriod.period_number} • Minute {currentMinute} • Total Match Minute {totalMatchMinute}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !currentPeriod}
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