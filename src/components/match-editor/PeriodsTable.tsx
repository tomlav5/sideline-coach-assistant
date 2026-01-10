import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Trash2, Check, X, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MatchPeriod {
  id: string;
  period_number: number;
  period_type: string;
  planned_duration_minutes: number;
  actual_start_time?: string;
  actual_end_time?: string;
  is_active: boolean;
}

interface PeriodsTableProps {
  periods: MatchPeriod[];
  fixtureId: string;
  onUpdate: () => void;
  onHasChanges: (hasChanges: boolean) => void;
}

export function PeriodsTable({ periods, fixtureId, onUpdate, onHasChanges }: PeriodsTableProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MatchPeriod>>({});
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    period_type: 'period' as 'period' | 'penalties',
    planned_duration_minutes: 25,
  });

  const startEdit = (period: MatchPeriod) => {
    setEditingId(period.id);
    setEditForm({
      planned_duration_minutes: period.planned_duration_minutes,
      period_type: period.period_type,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (periodId: string) => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('match_periods')
        .update({
          planned_duration_minutes: editForm.planned_duration_minutes,
        })
        .eq('id', periodId);

      if (error) throw error;

      toast({
        title: "Period Updated",
        description: "Period has been updated successfully",
      });

      setEditingId(null);
      setEditForm({});
      onUpdate();
    } catch (error: any) {
      console.error('Error updating period:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update period",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deletePeriod = async (periodId: string) => {
    try {
      const { error } = await supabase
        .from('match_periods')
        .delete()
        .eq('id', periodId);

      if (error) throw error;

      toast({
        title: "Period Deleted",
        description: "Period has been removed successfully",
      });

      onUpdate();
    } catch (error: any) {
      console.error('Error deleting period:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete period. It may contain events or player times.",
        variant: "destructive",
      });
    }
  };

  const addPeriod = async () => {
    try {
      setSaving(true);

      const nextPeriodNumber = Math.max(...periods.map(p => p.period_number), 0) + 1;

      const { error } = await supabase
        .from('match_periods')
        .insert({
          fixture_id: fixtureId,
          period_number: nextPeriodNumber,
          period_type: addForm.period_type,
          planned_duration_minutes: addForm.period_type === 'penalties' ? 0 : addForm.planned_duration_minutes,
          is_active: false,
        });

      if (error) throw error;

      toast({
        title: "Period Added",
        description: `Period ${nextPeriodNumber} has been added successfully`,
      });

      setShowAddDialog(false);
      setAddForm({
        period_type: 'period',
        planned_duration_minutes: 25,
      });
      onUpdate();
    } catch (error: any) {
      console.error('Error adding period:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to add period",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (periods.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No periods recorded yet</p>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add First Period
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Period
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period Number</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.map((period) => (
              <TableRow key={period.id}>
                {editingId === period.id ? (
                  <>
                    <TableCell>
                      <Badge>Period {period.period_number}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {period.period_type === 'penalties' ? 'Penalties' : 'Regular'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {period.period_type !== 'penalties' ? (
                        <Input
                          type="number"
                          value={editForm.planned_duration_minutes}
                          onChange={(e) => setEditForm({ ...editForm, planned_duration_minutes: Number(e.target.value) })}
                          className="h-8 w-24"
                          min={1}
                          max={90}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {period.is_active && (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveEdit(period.id)}
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
                      <Badge>Period {period.period_number}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {period.period_type === 'penalties' ? 'Penalties' : 'Regular'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">
                        {period.planned_duration_minutes > 0 ? `${period.planned_duration_minutes} min` : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {period.is_active && (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(period)}
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
                                This will delete Period {period.period_number} if it has no associated events or player times. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deletePeriod(period.id)}
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

      {/* Add Period Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Match Period</DialogTitle>
            <DialogDescription>
              Add a new period to the match (e.g., extra time, penalty shootout)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Period Type</Label>
              <Select 
                value={addForm.period_type} 
                onValueChange={(value: 'period' | 'penalties') => setAddForm({ ...addForm, period_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="period">Regular Period</SelectItem>
                  <SelectItem value="penalties">Penalty Shootout</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {addForm.period_type === 'period' && (
              <div>
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={addForm.planned_duration_minutes}
                  onChange={(e) => setAddForm({ ...addForm, planned_duration_minutes: Number(e.target.value) })}
                  min={1}
                  max={90}
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={addPeriod} disabled={saving}>
                {saving ? 'Adding...' : 'Add Period'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
