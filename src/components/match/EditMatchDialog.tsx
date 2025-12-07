import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useEditMatchData } from '@/hooks/useEditMatchData';
import { Edit, Trash2, Clock, Users, Calendar, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface MatchEvent {
  id: string;
  event_type: string;
  minute_in_period: number;
  total_match_minute: number;
  period_id: string;
  is_our_team: boolean;
  is_penalty?: boolean;
  player_id?: string;
  assist_player_id?: string | null;
  notes?: string;
  players?: {
    first_name: string;
    last_name: string;
  };
  assist_players?: {
    first_name: string;
    last_name: string;
  };
  match_periods?: {
    period_number: number;
  };
}

interface PlayerTime {
  id: string;
  player_id: string;
  period_id: string;
  time_on_minute: number | null;
  time_off_minute: number | null;
  is_starter: boolean;
  total_period_minutes: number;
  players: {
    first_name: string;
    last_name: string;
    jersey_number?: number;
  };
  match_periods: {
    period_number: number;
    planned_duration_minutes: number;
  };
}

interface MatchPeriod {
  id: string;
  period_number: number;
  planned_duration_minutes: number;
  actual_start_time?: string;
  actual_end_time?: string;
  is_active: boolean;
}

interface EditMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixtureId: string;
  events: MatchEvent[];
  playerTimes: PlayerTime[];
  periods: MatchPeriod[];
  players: Player[];
  onUpdate?: () => void;
}

export function EditMatchDialog({
  open,
  onOpenChange,
  fixtureId,
  events,
  playerTimes,
  periods,
  players,
  onUpdate
}: EditMatchDialogProps) {
  const isMobile = useIsMobile();
  const [currentTab, setCurrentTab] = useState<'events' | 'times' | 'periods' | 'validation'>('events');
  const [editingEvent, setEditingEvent] = useState<MatchEvent | null>(null);
  const [editingTime, setEditingTime] = useState<PlayerTime | null>(null);
  const [editingPeriod, setEditingPeriod] = useState<MatchPeriod | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const {
    isLoading,
    updateEvent,
    deleteEvent,
    updatePlayerTime,
    deletePlayerTime,
    updatePeriod,
    deletePeriod,
    validateMatchData,
  } = useEditMatchData();

  useEffect(() => {
    if (open && currentTab === 'validation') {
      loadValidation();
    }
  }, [open, currentTab, fixtureId]);

  const loadValidation = async () => {
    const warnings = await validateMatchData(fixtureId);
    setValidationWarnings(warnings);
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent) return;

    const success = await updateEvent(editingEvent.id, {
      player_id: editingEvent.player_id,
      assist_player_id: editingEvent.assist_player_id,
      minute_in_period: editingEvent.minute_in_period,
      is_penalty: editingEvent.is_penalty,
      notes: editingEvent.notes,
    });

    if (success) {
      setEditingEvent(null);
      onUpdate?.();
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    const success = await deleteEvent(eventId);
    if (success) {
      onUpdate?.();
    }
  };

  const handleUpdatePlayerTime = async () => {
    if (!editingTime) return;

    const success = await updatePlayerTime(editingTime.id, {
      time_on_minute: editingTime.time_on_minute,
      time_off_minute: editingTime.time_off_minute,
      is_starter: editingTime.is_starter,
    });

    if (success) {
      setEditingTime(null);
      onUpdate?.();
    }
  };

  const handleDeletePlayerTime = async (timeId: string) => {
    const success = await deletePlayerTime(timeId);
    if (success) {
      onUpdate?.();
    }
  };

  const handleUpdatePeriod = async () => {
    if (!editingPeriod) return;

    const success = await updatePeriod(editingPeriod.id, {
      planned_duration_minutes: editingPeriod.planned_duration_minutes,
    });

    if (success) {
      setEditingPeriod(null);
      onUpdate?.();
    }
  };

  const handleDeletePeriod = async (periodId: string) => {
    const success = await deletePeriod(periodId);
    if (success) {
      onUpdate?.();
    }
  };

  const getPlayerName = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player ? `${player.first_name} ${player.last_name}` : 'Unknown';
  };

  const content = (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={currentTab === 'events' ? 'default' : 'outline'}
          onClick={() => setCurrentTab('events')}
          size="sm"
        >
          <Edit className="h-4 w-4 mr-1" />
          Events ({events.length})
        </Button>
        <Button
          variant={currentTab === 'times' ? 'default' : 'outline'}
          onClick={() => setCurrentTab('times')}
          size="sm"
        >
          <Clock className="h-4 w-4 mr-1" />
          Player Times ({playerTimes.length})
        </Button>
        <Button
          variant={currentTab === 'periods' ? 'default' : 'outline'}
          onClick={() => setCurrentTab('periods')}
          size="sm"
        >
          <Calendar className="h-4 w-4 mr-1" />
          Periods ({periods.length})
        </Button>
        <Button
          variant={currentTab === 'validation' ? 'default' : 'outline'}
          onClick={() => setCurrentTab('validation')}
          size="sm"
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Validation
        </Button>
      </div>

      <ScrollArea className="h-[60vh]">
        {/* EVENTS TAB */}
        {currentTab === 'events' && (
          <div className="space-y-3 pr-4">
            {events.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No events recorded</p>
            ) : (
              events.map((event) => (
                <Card key={event.id} className="relative">
                  <CardContent className="p-4">
                    {editingEvent?.id === event.id ? (
                      // EDIT MODE
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Player</Label>
                            <Select 
                              value={editingEvent.player_id || ''} 
                              onValueChange={(value) => setEditingEvent({...editingEvent, player_id: value})}
                            >
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
                            <Label>Minute</Label>
                            <Input
                              type="number"
                              value={editingEvent.minute_in_period}
                              onChange={(e) => setEditingEvent({...editingEvent, minute_in_period: Number(e.target.value)})}
                              min={0}
                              max={90}
                            />
                          </div>
                        </div>

                        {event.event_type === 'goal' && (
                          <>
                            <div>
                              <Label>Assist (optional)</Label>
                              <Select
                                value={editingEvent.assist_player_id === null ? 'none' : (editingEvent.assist_player_id || 'none')}
                                onValueChange={(value) => setEditingEvent({...editingEvent, assist_player_id: value === 'none' ? null : value})}
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

                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`penalty-edit-${event.id}`}
                                checked={editingEvent.is_penalty || false}
                                onCheckedChange={(checked) => setEditingEvent({...editingEvent, is_penalty: !!checked})}
                              />
                              <Label htmlFor={`penalty-edit-${event.id}`}>Penalty</Label>
                            </div>
                          </>
                        )}

                        <div className="flex gap-2">
                          <Button onClick={handleUpdateEvent} disabled={isLoading} size="sm">
                            Save
                          </Button>
                          <Button onClick={() => setEditingEvent(null)} variant="outline" size="sm">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // VIEW MODE
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={event.is_our_team ? 'default' : 'secondary'}>
                                {event.event_type}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                Period {event.match_periods?.period_number} - {event.minute_in_period}'
                              </span>
                              {event.is_penalty && (
                                <Badge variant="outline">Penalty</Badge>
                              )}
                            </div>
                            <p className="font-medium">
                              {event.players ? `${event.players.first_name} ${event.players.last_name}` : 'Unknown'}
                            </p>
                            {event.assist_players && (
                              <p className="text-sm text-muted-foreground">
                                Assist: {event.assist_players.first_name} {event.assist_players.last_name}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingEvent(event)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this event. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteEvent(event.id)} className="bg-destructive text-destructive-foreground">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* PLAYER TIMES TAB */}
        {currentTab === 'times' && (
          <div className="space-y-3 pr-4">
            {playerTimes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No player time logs</p>
            ) : (
              playerTimes.map((time) => (
                <Card key={time.id}>
                  <CardContent className="p-4">
                    {editingTime?.id === time.id ? (
                      // EDIT MODE
                      <div className="space-y-3">
                        <div className="font-medium">
                          {time.players.first_name} {time.players.last_name} - Period {time.match_periods.period_number}
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`starter-edit-${time.id}`}
                            checked={editingTime.is_starter}
                            onCheckedChange={(checked) => setEditingTime({...editingTime, is_starter: !!checked})}
                          />
                          <Label htmlFor={`starter-edit-${time.id}`}>Started Period</Label>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Time On (min)</Label>
                            <Input
                              type="number"
                              value={editingTime.time_on_minute ?? ''}
                              onChange={(e) => setEditingTime({...editingTime, time_on_minute: e.target.value ? Number(e.target.value) : null})}
                              min={0}
                              max={time.match_periods.planned_duration_minutes}
                              placeholder="Start minute"
                            />
                          </div>
                          <div>
                            <Label>Time Off (min)</Label>
                            <Input
                              type="number"
                              value={editingTime.time_off_minute ?? ''}
                              onChange={(e) => setEditingTime({...editingTime, time_off_minute: e.target.value ? Number(e.target.value) : null})}
                              min={0}
                              max={time.match_periods.planned_duration_minutes}
                              placeholder="End minute"
                            />
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground">
                          Period Duration: {time.match_periods.planned_duration_minutes} minutes
                        </div>

                        <div className="flex gap-2">
                          <Button onClick={handleUpdatePlayerTime} disabled={isLoading} size="sm">
                            Save
                          </Button>
                          <Button onClick={() => setEditingTime(null)} variant="outline" size="sm">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // VIEW MODE
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge>Period {time.match_periods.period_number}</Badge>
                            {time.is_starter && <Badge variant="outline">Starter</Badge>}
                          </div>
                          <p className="font-medium">
                            {time.players.first_name} {time.players.last_name}
                            {time.players.jersey_number && ` #${time.players.jersey_number}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            On: {time.time_on_minute ?? 0}' | Off: {time.time_off_minute ?? time.match_periods.planned_duration_minutes}' | 
                            Total: {time.total_period_minutes}'
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingTime(time)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Player Time?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this player's time log. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeletePlayerTime(time.id)} className="bg-destructive text-destructive-foreground">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* PERIODS TAB */}
        {currentTab === 'periods' && (
          <div className="space-y-3 pr-4">
            {periods.map((period) => (
              <Card key={period.id}>
                <CardContent className="p-4">
                  {editingPeriod?.id === period.id ? (
                    // EDIT MODE
                    <div className="space-y-3">
                      <div className="font-medium">Period {period.period_number}</div>

                      <div>
                        <Label>Duration (minutes)</Label>
                        <Input
                          type="number"
                          value={editingPeriod.planned_duration_minutes}
                          onChange={(e) => setEditingPeriod({...editingPeriod, planned_duration_minutes: Number(e.target.value)})}
                          min={1}
                          max={90}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleUpdatePeriod} disabled={isLoading} size="sm">
                          Save
                        </Button>
                        <Button onClick={() => setEditingPeriod(null)} variant="outline" size="sm">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // VIEW MODE
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Period {period.period_number}</div>
                        <p className="text-sm text-muted-foreground">
                          Duration: {period.planned_duration_minutes} minutes
                        </p>
                        {period.is_active && (
                          <Badge variant="outline" className="mt-1">Active</Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingPeriod(period)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" disabled={period.is_active}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Period?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will delete the period only if it has no events or player times. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeletePeriod(period.id)} className="bg-destructive text-destructive-foreground">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* VALIDATION TAB */}
        {currentTab === 'validation' && (
          <div className="space-y-3 pr-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Data Validation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {validationWarnings.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-green-600 dark:text-green-400 mb-2">✓ All checks passed</div>
                    <p className="text-sm text-muted-foreground">No data inconsistencies found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Found {validationWarnings.length} warning(s):</p>
                    <ul className="space-y-2">
                      {validationWarnings.map((warning, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                          <span>{warning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Separator className="my-4" />

                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Summary:</strong></p>
                  <p>• Events: {events.length}</p>
                  <p>• Player Time Logs: {playerTimes.length}</p>
                  <p>• Periods: {periods.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </ScrollArea>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85dvh] p-4 overflow-hidden pb-[max(16px,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Edit Match Data</SheetTitle>
            <SheetDescription>
              Update events, player times, and periods
            </SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-large max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Match Data</DialogTitle>
          <DialogDescription>
            Update events, player times, and periods. Changes are saved immediately.
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
