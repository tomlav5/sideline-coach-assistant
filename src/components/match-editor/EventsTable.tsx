import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, Check, X, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EnhancedEventDialog } from '@/components/match/EnhancedEventDialog';
import { supabase } from '@/integrations/supabase/client';

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
    jersey_number?: number;
  };
  assist_players?: {
    first_name: string;
    last_name: string;
    jersey_number?: number;
  };
  match_periods?: {
    period_number: number;
  };
}

interface MatchPeriod {
  id: string;
  period_number: number;
  period_type?: 'period' | 'penalties';
  planned_duration_minutes: number;
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface EventsTableProps {
  events: MatchEvent[];
  periods: MatchPeriod[];
  players: Player[];
  fixtureId: string;
  onUpdate: () => void;
  onHasChanges: (hasChanges: boolean) => void;
}

export function EventsTable({ events, periods, players, fixtureId, onUpdate, onHasChanges }: EventsTableProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MatchEvent>>({});
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedPeriodForAdd, setSelectedPeriodForAdd] = useState<MatchPeriod | null>(null);

  const startEdit = (event: MatchEvent) => {
    setEditingId(event.id);
    setEditForm({
      player_id: event.player_id,
      assist_player_id: event.assist_player_id,
      minute_in_period: event.minute_in_period,
      total_match_minute: event.total_match_minute,
      is_penalty: event.is_penalty,
      notes: event.notes,
      period_id: event.period_id,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (eventId: string) => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('match_events')
        .update({
          player_id: editForm.player_id || null,
          assist_player_id: editForm.assist_player_id || null,
          minute_in_period: editForm.minute_in_period,
          total_match_minute: editForm.total_match_minute,
          is_penalty: editForm.is_penalty || false,
          notes: editForm.notes || null,
        })
        .eq('id', eventId);

      if (error) throw error;

      toast({
        title: "Event Updated",
        description: "Event has been updated successfully",
      });

      setEditingId(null);
      setEditForm({});
      onUpdate();
    } catch (error: any) {
      console.error('Error updating event:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update event",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('match_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast({
        title: "Event Deleted",
        description: "Event has been removed successfully",
      });

      onUpdate();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete event",
        variant: "destructive",
      });
    }
  };

  const getPlayerName = (player?: { first_name: string; last_name: string; jersey_number?: number }) => {
    if (!player) return 'Unknown';
    const number = player.jersey_number ? `#${player.jersey_number} ` : '';
    return `${number}${player.first_name} ${player.last_name}`;
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No events recorded yet</p>
        <Button onClick={() => {
          if (periods.length > 0) {
            setSelectedPeriodForAdd(periods[0]);
            setShowAddDialog(true);
          } else {
            toast({
              title: "No Periods",
              description: "Please add a period first before recording events",
              variant: "destructive",
            });
          }
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Add First Event
        </Button>
        
        {selectedPeriodForAdd && (
          <EnhancedEventDialog
            open={showAddDialog}
            onOpenChange={setShowAddDialog}
            fixtureId={fixtureId}
            currentPeriod={selectedPeriodForAdd}
            currentMinute={0}
            totalMatchMinute={0}
            players={players}
            onEventRecorded={() => {
              setShowAddDialog(false);
              setSelectedPeriodForAdd(null);
              onUpdate();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => {
          if (periods.length > 0) {
            setSelectedPeriodForAdd(periods[periods.length - 1]);
            setShowAddDialog(true);
          } else {
            toast({
              title: "No Periods",
              description: "Please add a period first before recording events",
              variant: "destructive",
            });
          }
        }} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Minute</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Assist</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                {editingId === event.id ? (
                  <>
                    <TableCell>
                      <Select
                        value={editForm.period_id}
                        onValueChange={(value) => setEditForm({ ...editForm, period_id: value })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {periods.map((period) => (
                            <SelectItem key={period.id} value={period.id}>
                              Period {period.period_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.total_match_minute}
                        onChange={(e) => setEditForm({ ...editForm, total_match_minute: Number(e.target.value) })}
                        className="h-8 w-20"
                        min={0}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge>{event.event_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={event.is_our_team ? 'default' : 'secondary'}>
                        {event.is_our_team ? 'Us' : 'Them'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={editForm.player_id || 'none'}
                        onValueChange={(value) => setEditForm({ ...editForm, player_id: value === 'none' ? undefined : value })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Player</SelectItem>
                          {players.map((player) => (
                            <SelectItem key={player.id} value={player.id}>
                              {getPlayerName(player)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {event.event_type === 'goal' && (
                        <Select
                          value={editForm.assist_player_id === null || editForm.assist_player_id === undefined ? 'none' : editForm.assist_player_id}
                          onValueChange={(value) => setEditForm({ ...editForm, assist_player_id: value === 'none' ? null : value })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Assist</SelectItem>
                            {players.map((player) => (
                              <SelectItem key={player.id} value={player.id}>
                                {getPlayerName(player)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {event.event_type === 'goal' && (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`penalty-${event.id}`}
                            checked={editForm.is_penalty || false}
                            onCheckedChange={(checked) => setEditForm({ ...editForm, is_penalty: !!checked })}
                          />
                          <Label htmlFor={`penalty-${event.id}`} className="text-xs">Penalty</Label>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveEdit(event.id)}
                          disabled={saving}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>
                      <Badge variant="outline">
                        P{event.match_periods?.period_number || '?'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-medium">{event.total_match_minute}'</span>
                    </TableCell>
                    <TableCell>
                      <Badge>{event.event_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={event.is_our_team ? 'default' : 'secondary'}>
                        {event.is_our_team ? 'Us' : 'Them'}
                      </Badge>
                    </TableCell>
                    <TableCell>{getPlayerName(event.players)}</TableCell>
                    <TableCell>
                      {event.assist_players ? getPlayerName(event.assist_players) : '-'}
                    </TableCell>
                    <TableCell>
                      {event.is_penalty && (
                        <Badge variant="outline" className="text-xs">Penalty</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(event)}
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
                              <AlertDialogAction
                                onClick={() => deleteEvent(event.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedPeriodForAdd && (
        <EnhancedEventDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          fixtureId={fixtureId}
          currentPeriod={selectedPeriodForAdd}
          currentMinute={0}
          totalMatchMinute={0}
          players={players}
          onEventRecorded={() => {
            setShowAddDialog(false);
            setSelectedPeriodForAdd(null);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
