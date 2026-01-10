import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Trash2, Check, X, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface PlayerTimesTableProps {
  playerTimes: PlayerTime[];
  periods: MatchPeriod[];
  players: Player[];
  fixtureId: string;
  onUpdate: () => void;
  onHasChanges: (hasChanges: boolean) => void;
}

export function PlayerTimesTable({ playerTimes, periods, players, fixtureId, onUpdate, onHasChanges }: PlayerTimesTableProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PlayerTime>>({});
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    player_id: '',
    period_id: '',
    time_on_minute: 0,
    time_off_minute: null as number | null,
    is_starter: false,
  });

  const startEdit = (time: PlayerTime) => {
    setEditingId(time.id);
    setEditForm({
      time_on_minute: time.time_on_minute,
      time_off_minute: time.time_off_minute,
      is_starter: time.is_starter,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (timeId: string) => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('player_time_logs')
        .update({
          time_on_minute: editForm.time_on_minute,
          time_off_minute: editForm.time_off_minute,
          is_starter: editForm.is_starter || false,
        })
        .eq('id', timeId);

      if (error) throw error;

      toast({
        title: "Player Time Updated",
        description: "Player time log has been updated successfully",
      });

      setEditingId(null);
      setEditForm({});
      onUpdate();
    } catch (error: any) {
      console.error('Error updating player time:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update player time",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deletePlayerTime = async (timeId: string) => {
    try {
      const { error } = await supabase
        .from('player_time_logs')
        .delete()
        .eq('id', timeId);

      if (error) throw error;

      toast({
        title: "Player Time Deleted",
        description: "Player time log has been removed successfully",
      });

      onUpdate();
    } catch (error: any) {
      console.error('Error deleting player time:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete player time",
        variant: "destructive",
      });
    }
  };

  const addPlayerTime = async () => {
    if (!addForm.player_id || !addForm.period_id) {
      toast({
        title: "Missing Information",
        description: "Please select a player and period",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const period = periods.find(p => p.id === addForm.period_id);
      const timeOff = addForm.time_off_minute ?? period?.planned_duration_minutes ?? 0;
      const timeOn = addForm.time_on_minute ?? 0;
      const totalMinutes = Math.max(0, timeOff - timeOn);

      const { error } = await supabase
        .from('player_time_logs')
        .insert({
          fixture_id: fixtureId,
          player_id: addForm.player_id,
          period_id: addForm.period_id,
          time_on_minute: timeOn,
          time_off_minute: addForm.time_off_minute,
          is_starter: addForm.is_starter,
          total_period_minutes: totalMinutes,
        });

      if (error) throw error;

      toast({
        title: "Player Time Added",
        description: "Player time log has been added successfully",
      });

      setShowAddDialog(false);
      setAddForm({
        player_id: '',
        period_id: '',
        time_on_minute: 0,
        time_off_minute: null,
        is_starter: false,
      });
      onUpdate();
    } catch (error: any) {
      console.error('Error adding player time:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to add player time",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getPlayerName = (player: { first_name: string; last_name: string; jersey_number?: number }) => {
    const number = player.jersey_number ? `#${player.jersey_number} ` : '';
    return `${number}${player.first_name} ${player.last_name}`;
  };

  if (playerTimes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No player time logs recorded yet</p>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add First Player Time
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Player Time
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Starter</TableHead>
              <TableHead>Time On</TableHead>
              <TableHead>Time Off</TableHead>
              <TableHead>Total Minutes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {playerTimes.map((time) => (
              <TableRow key={time.id}>
                {editingId === time.id ? (
                  <>
                    <TableCell>
                      <Badge variant="outline">P{time.match_periods.period_number}</Badge>
                    </TableCell>
                    <TableCell>{getPlayerName(time.players)}</TableCell>
                    <TableCell>
                      <Checkbox
                        checked={editForm.is_starter || false}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, is_starter: !!checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.time_on_minute ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, time_on_minute: e.target.value ? Number(e.target.value) : null })}
                        className="h-8 w-20"
                        min={0}
                        max={time.match_periods.planned_duration_minutes}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.time_off_minute ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, time_off_minute: e.target.value ? Number(e.target.value) : null })}
                        className="h-8 w-20"
                        min={0}
                        max={time.match_periods.planned_duration_minutes}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {((editForm.time_off_minute ?? time.match_periods.planned_duration_minutes) - (editForm.time_on_minute ?? 0))}m
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveEdit(time.id)}
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
                      <Badge variant="outline">P{time.match_periods.period_number}</Badge>
                    </TableCell>
                    <TableCell>{getPlayerName(time.players)}</TableCell>
                    <TableCell>
                      {time.is_starter ? (
                        <Badge variant="default" className="text-xs">Starter</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Sub</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">{time.time_on_minute ?? 0}'</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">{time.time_off_minute ?? time.match_periods.planned_duration_minutes}'</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-medium">{time.total_period_minutes}m</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(time)}
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
                              <AlertDialogAction
                                onClick={() => deletePlayerTime(time.id)}
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

      {/* Add Player Time Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Player Time Log</DialogTitle>
            <DialogDescription>
              Record a player's time for a specific period
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Player</Label>
              <Select value={addForm.player_id} onValueChange={(value) => setAddForm({ ...addForm, player_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {getPlayerName(player)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Period</Label>
              <Select value={addForm.period_id} onValueChange={(value) => setAddForm({ ...addForm, period_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      Period {period.period_number} ({period.planned_duration_minutes} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="starter-add"
                checked={addForm.is_starter}
                onCheckedChange={(checked) => setAddForm({ ...addForm, is_starter: !!checked })}
              />
              <Label htmlFor="starter-add">Started Period</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Time On (minutes)</Label>
                <Input
                  type="number"
                  value={addForm.time_on_minute}
                  onChange={(e) => setAddForm({ ...addForm, time_on_minute: Number(e.target.value) })}
                  min={0}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Time Off (minutes)</Label>
                <Input
                  type="number"
                  value={addForm.time_off_minute ?? ''}
                  onChange={(e) => setAddForm({ ...addForm, time_off_minute: e.target.value ? Number(e.target.value) : null })}
                  min={0}
                  placeholder="Full period"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={addPlayerTime} disabled={saving}>
                {saving ? 'Adding...' : 'Add Player Time'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
