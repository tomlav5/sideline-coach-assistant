import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRetrospectiveMatch } from '@/hooks/useRetrospectiveMatch';
import { Plus, Trash2, Goal, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface RetrospectiveMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixtureId: string;
  players: Player[];
  onComplete?: () => void;
}

interface Period {
  period_number: number;
  duration_minutes: number;
}

interface MatchEvent {
  id: string;
  event_type: 'goal' | 'assist';
  player_id?: string;
  assist_player_id?: string;
  period_number: number;
  minute_in_period: number;
  is_our_team: boolean;
  is_penalty: boolean;
  notes: string;
}

interface PlayerTime {
  id: string;
  player_id: string;
  period_number: number;
  time_on_minute?: number;
  time_off_minute?: number;
  is_starter: boolean;
}

export function RetrospectiveMatchDialog({
  open,
  onOpenChange,
  fixtureId,
  players,
  onComplete
}: RetrospectiveMatchDialogProps) {
  const isMobile = useIsMobile();
  const [periods, setPeriods] = useState<Period[]>([{ period_number: 1, duration_minutes: 25 }]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [playerTimes, setPlayerTimes] = useState<PlayerTime[]>([]);
  const [currentTab, setCurrentTab] = useState<'periods' | 'events' | 'players'>('periods');

  const { saveRetrospectiveMatch, isLoading } = useRetrospectiveMatch();

  const addPeriod = () => {
    const nextNumber = Math.max(...periods.map(p => p.period_number)) + 1;
    setPeriods([...periods, { period_number: nextNumber, duration_minutes: 25 }]);
  };

  const removePeriod = (periodNumber: number) => {
    if (periods.length === 1) {
      toast.error('Must have at least one period');
      return;
    }
    setPeriods(periods.filter(p => p.period_number !== periodNumber));
    setEvents(events.filter(e => e.period_number !== periodNumber));
    setPlayerTimes(playerTimes.filter(pt => pt.period_number !== periodNumber));
  };

  const updatePeriod = (periodNumber: number, duration: number) => {
    setPeriods(periods.map(p => 
      p.period_number === periodNumber ? { ...p, duration_minutes: duration } : p
    ));
  };

  const addEvent = () => {
    const newEvent: MatchEvent = {
      id: Math.random().toString(),
      event_type: 'goal',
      period_number: 1,
      minute_in_period: 1,
      is_our_team: true,
      is_penalty: false,
      notes: '',
    };
    setEvents([...events, newEvent]);
  };

  const updateEvent = (id: string, updates: Partial<MatchEvent>) => {
    setEvents(events.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const removeEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const addPlayerTime = () => {
    const newPlayerTime: PlayerTime = {
      id: Math.random().toString(),
      player_id: '',
      period_number: 1,
      is_starter: true,
    };
    setPlayerTimes([...playerTimes, newPlayerTime]);
  };

  const updatePlayerTime = (id: string, updates: Partial<PlayerTime>) => {
    setPlayerTimes(playerTimes.map(pt => pt.id === id ? { ...pt, ...updates } : pt));
  };

  const removePlayerTime = (id: string) => {
    setPlayerTimes(playerTimes.filter(pt => pt.id !== id));
  };

  const handleSave = async () => {
    if (periods.length === 0) {
      toast.error('Must have at least one period');
      return;
    }

    const retroData = {
      fixture_id: fixtureId,
      periods,
      events: events.map(e => ({
        event_type: e.event_type,
        player_id: e.player_id,
        assist_player_id: e.assist_player_id,
        period_number: e.period_number,
        minute_in_period: e.minute_in_period,
        is_our_team: e.is_our_team,
        is_penalty: e.is_penalty,
        notes: e.notes,
      })),
      player_times: playerTimes.map(pt => ({
        player_id: pt.player_id,
        period_number: pt.period_number,
        time_on_minute: pt.time_on_minute,
        time_off_minute: pt.time_off_minute,
        is_starter: pt.is_starter,
      })),
    };

    const success = await saveRetrospectiveMatch(retroData);
    if (success) {
      onComplete?.();
      onOpenChange(false);
    }
  };

  const getPlayerName = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player ? `${player.first_name} ${player.last_name}` : 'Unknown Player';
  };

  const content = (
    <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={currentTab === 'periods' ? 'default' : 'outline'}
              onClick={() => setCurrentTab('periods')}
              size="sm"
            >
              Periods
            </Button>
            <Button
              variant={currentTab === 'events' ? 'default' : 'outline'}
              onClick={() => setCurrentTab('events')}
              size="sm"
            >
              Events
            </Button>
            <Button
              variant={currentTab === 'players' ? 'default' : 'outline'}
              onClick={() => setCurrentTab('players')}
              size="sm"
            >
              Playing Time
            </Button>
          </div>

          {/* Periods Tab */}
          {currentTab === 'periods' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span>Match Periods</span>
                  <Button onClick={addPeriod} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Period
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {periods.map((period) => (
                  <div key={period.period_number} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Badge>Period {period.period_number}</Badge>
                    <div className="flex items-center gap-2">
                      <Label>Duration:</Label>
                      <Input
                        type="number"
                        value={period.duration_minutes}
                        onChange={(e) => updatePeriod(period.period_number, Number(e.target.value))}
                        className="w-20"
                        min={1}
                        max={90}
                      />
                      <span className="text-sm text-muted-foreground">minutes</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePeriod(period.period_number)}
                      className="ml-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Events Tab */}
          {currentTab === 'events' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span>Match Events</span>
                  <Button onClick={addEvent} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Event
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="grid grid-cols-2 gap-3 p-3 border rounded-lg">
                    <div className="space-y-2">
                      <div>
                        <Label>Type</Label>
                        <Select value={event.event_type} onValueChange={(value: 'goal' | 'assist') => updateEvent(event.id, { event_type: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="goal">Goal</SelectItem>
                            <SelectItem value="assist">Assist</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Player</Label>
                        <Select value={event.player_id || ''} onValueChange={(value) => updateEvent(event.id, { player_id: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select player" />
                          </SelectTrigger>
                          <SelectContent>
                            {players.map((player) => (
                              <SelectItem key={player.id} value={player.id}>
                                {player.first_name} {player.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {event.event_type === 'goal' && (
                        <div>
                          <Label>Assist (optional)</Label>
                          <Select
                            value={(event.assist_player_id ?? '') === '' ? 'none' : (event.assist_player_id as string)}
                            onValueChange={(value) => updateEvent(event.id, { assist_player_id: value === 'none' ? undefined : value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select assist player" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No assist</SelectItem>
                              {players.map((player) => (
                                <SelectItem key={player.id} value={player.id}>
                                  {player.first_name} {player.last_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Period</Label>
                          <Select value={event.period_number.toString()} onValueChange={(value) => updateEvent(event.id, { period_number: Number(value) })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {periods.map((period) => (
                                <SelectItem key={period.period_number} value={period.period_number.toString()}>
                                  P{period.period_number}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label>Minute in Period</Label>
                          <Input
                            type="number"
                            value={event.minute_in_period}
                            onChange={(e) => updateEvent(event.id, { minute_in_period: Number(e.target.value) })}
                            min={1}
                            max={90}
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`our-team-${event.id}`}
                          checked={event.is_our_team}
                          onCheckedChange={(checked) => updateEvent(event.id, { is_our_team: !!checked })}
                        />
                        <Label htmlFor={`our-team-${event.id}`}>Our Team</Label>
                      </div>

                      {event.event_type === 'goal' && (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`penalty-${event.id}`}
                            checked={event.is_penalty}
                            onCheckedChange={(checked) => updateEvent(event.id, { is_penalty: !!checked })}
                          />
                          <Label htmlFor={`penalty-${event.id}`}>Penalty</Label>
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEvent(event.id)}
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Player Times Tab */}
          {currentTab === 'players' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span>Player Playing Time</span>
                  <Button onClick={addPlayerTime} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Player
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {playerTimes.map((playerTime) => (
                  <div key={playerTime.id} className="grid grid-cols-2 gap-3 p-3 border rounded-lg">
                    <div className="space-y-2">
                      <div>
                        <Label>Player</Label>
                        <Select value={playerTime.player_id} onValueChange={(value) => updatePlayerTime(playerTime.id, { player_id: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select player" />
                          </SelectTrigger>
                          <SelectContent>
                            {players.map((player) => (
                              <SelectItem key={player.id} value={player.id}>
                                {player.first_name} {player.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Period</Label>
                        <Select value={playerTime.period_number.toString()} onValueChange={(value) => updatePlayerTime(playerTime.id, { period_number: Number(value) })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {periods.map((period) => (
                                <SelectItem key={period.period_number} value={period.period_number.toString()}>
                                  P{period.period_number}
                                </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`starter-${playerTime.id}`}
                          checked={playerTime.is_starter}
                          onCheckedChange={(checked) => updatePlayerTime(playerTime.id, { is_starter: !!checked })}
                        />
                        <Label htmlFor={`starter-${playerTime.id}`}>Started Period</Label>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Time On (min)</Label>
                          <Input
                            type="number"
                            value={playerTime.time_on_minute || ''}
                            onChange={(e) => updatePlayerTime(playerTime.id, { time_on_minute: e.target.value ? Number(e.target.value) : undefined })}
                            placeholder="If subbed on"
                            min={0}
                            max={90}
                          />
                        </div>
                        
                        <div>
                          <Label>Time Off (min)</Label>
                          <Input
                            type="number"
                            value={playerTime.time_off_minute || ''}
                            onChange={(e) => updatePlayerTime(playerTime.id, { time_off_minute: e.target.value ? Number(e.target.value) : undefined })}
                            placeholder="If subbed off"
                            min={0}
                            max={90}
                          />
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePlayerTime(playerTime.id)}
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85dvh] p-4 overflow-auto pb-[max(16px,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Log Retrospective Match Data</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Retrospective Match Data</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}