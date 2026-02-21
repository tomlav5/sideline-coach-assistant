import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, UserPlus, Users } from 'lucide-react';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface EditSquadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixtureId: string;
  teamId: string;
  currentSquadPlayerIds: string[];
  onSquadUpdated: () => void;
}

export function EditSquadDialog({
  open,
  onOpenChange,
  fixtureId,
  teamId,
  currentSquadPlayerIds,
  onSquadUpdated,
}: EditSquadDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open) {
      loadAvailablePlayers();
    } else {
      // Reset on close
      setSelectedPlayerIds(new Set());
      setSearchTerm('');
    }
  }, [open]);

  const loadAvailablePlayers = async () => {
    try {
      setLoading(true);

      console.log('[EditSquadDialog] Loading players for team:', teamId);
      console.log('[EditSquadDialog] Current squad player IDs:', currentSquadPlayerIds);

      // Fetch all team players
      const { data: teamPlayersData, error } = await supabase
        .from('team_players')
        .select(`
          players (
            id,
            first_name,
            last_name,
            jersey_number
          )
        `)
        .eq('team_id', teamId);

      if (error) {
        console.error('[EditSquadDialog] Query error:', error);
        throw error;
      }

      console.log('[EditSquadDialog] Raw query result:', teamPlayersData);

      // Extract players from the join result
      const allPlayers = (teamPlayersData || [])
        .map(tp => tp.players)
        .filter(p => p != null) as Player[];

      console.log('[EditSquadDialog] All team players:', allPlayers.length, allPlayers);
      
      // Filter out players already in squad
      const available = allPlayers.filter(
        p => !currentSquadPlayerIds.includes(p.id)
      );

      console.log('[EditSquadDialog] Available players (not in squad):', available.length, available);

      setAvailablePlayers(available);

      if (available.length === 0 && allPlayers.length > 0) {
        toast({
          title: 'All Players Selected',
          description: 'All team players are already in the match squad',
        });
      } else if (allPlayers.length === 0) {
        toast({
          title: 'No Team Players',
          description: 'No players found for this team',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('[EditSquadDialog] Error loading available players:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load available players',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePlayerSelection = (playerId: string) => {
    setSelectedPlayerIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  const handleAddPlayers = async () => {
    if (selectedPlayerIds.size === 0) {
      toast({
        title: 'No Players Selected',
        description: 'Please select at least one player to add',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      // Fetch current fixture data
      const { data: fixtureData, error: fixtureError } = await supabase
        .from('fixtures')
        .select('selected_squad_data')
        .eq('id', fixtureId)
        .single();

      if (fixtureError) throw fixtureError;

      const currentSquadData = (fixtureData.selected_squad_data as any) || {};
      const currentSelectedIds = currentSquadData.selectedPlayerIds || [];
      const currentSubstitutes = currentSquadData.substitutes || [];

      // Get full player objects for new players
      const newPlayers = availablePlayers.filter(p =>
        selectedPlayerIds.has(p.id)
      );

      // Update squad data
      const updatedSquadData = {
        ...currentSquadData,
        selectedPlayerIds: [...currentSelectedIds, ...Array.from(selectedPlayerIds)],
        substitutes: [
          ...currentSubstitutes,
          ...newPlayers.map(p => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            jersey_number: p.jersey_number,
          })),
        ],
        lastUpdated: new Date().toISOString(),
      };

      // Update fixture
      const { error: updateError } = await supabase
        .from('fixtures')
        .update({ selected_squad_data: updatedSquadData })
        .eq('id', fixtureId);

      if (updateError) throw updateError;

      // Create player_match_status records for new players (as substitutes)
      const statusRecords = Array.from(selectedPlayerIds).map(playerId => ({
        fixture_id: fixtureId,
        player_id: playerId,
        is_on_field: false, // Added as substitutes
      }));

      const { error: statusError } = await supabase
        .from('player_match_status')
        .upsert(statusRecords, { onConflict: 'fixture_id,player_id' });

      if (statusError) throw statusError;

      toast({
        title: '✅ Players Added',
        description: `Successfully added ${selectedPlayerIds.size} player${
          selectedPlayerIds.size > 1 ? 's' : ''
        } to the squad`,
      });

      onSquadUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error adding players:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add players to squad',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredPlayers = availablePlayers.filter(p =>
    `${p.first_name} ${p.last_name}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase()) ||
    p.jersey_number?.toString().includes(searchTerm)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Players to Squad
          </DialogTitle>
          <DialogDescription>
            Select players to add to the match squad. New players will be added as
            substitutes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or number..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Player List */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mb-2 opacity-50" />
                <p className="font-medium">No Available Players</p>
                <p className="text-sm">
                  {searchTerm
                    ? 'No players match your search'
                    : 'All team players are already in the squad'}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredPlayers.map(player => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => togglePlayerSelection(player.id)}
                  >
                    <Checkbox
                      checked={selectedPlayerIds.has(player.id)}
                      onCheckedChange={() => togglePlayerSelection(player.id)}
                      onClick={e => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {player.jersey_number && (
                          <Badge variant="outline" className="shrink-0">
                            #{player.jersey_number}
                          </Badge>
                        )}
                        <span className="font-medium truncate">
                          {player.first_name} {player.last_name}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selection Summary */}
          {selectedPlayerIds.size > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
              <Users className="h-4 w-4" />
              <span>
                {selectedPlayerIds.size} player{selectedPlayerIds.size > 1 ? 's' : ''}{' '}
                selected
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleAddPlayers}
            disabled={selectedPlayerIds.size === 0 || saving}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Add {selectedPlayerIds.size > 0 ? selectedPlayerIds.size : ''} Player
                {selectedPlayerIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
