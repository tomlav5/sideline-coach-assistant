import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePlayers } from '@/hooks/usePlayers';
import { useTeams } from '@/hooks/useTeams';
import { useClubs } from '@/hooks/useClubs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, User, Users, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerCard } from '@/components/players/PlayerCard';
import { PlayerDialog } from '@/components/players/PlayerDialog';
import { TeamAssignmentDialog } from '@/components/players/TeamAssignmentDialog';
import { BulkTeamAssignmentDialog } from '@/components/players/BulkTeamAssignmentDialog';

interface Club {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  team_type: string;
  club_id: string;
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  club_id: string;
  created_at: string;
  club: Club;
  teams?: Team[];
}

export default function Players() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: players = [], isLoading, error } = usePlayers();
  const { data: teams = [] } = useTeams();
  const { data: clubs = [] } = useClubs();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [deleting, setDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Memoized filtered players for performance
  const filteredPlayers = useMemo(() => {
    if (teamFilter === 'all') {
      return players;
    } else if (teamFilter === 'unassigned') {
      return players.filter(player => !player.teams || player.teams.length === 0);
    } else {
      return players.filter(player => 
        player.teams?.some(team => team.id === teamFilter)
      );
    }
  }, [players, teamFilter]);

  // Handle URL team filter parameter
  useEffect(() => {
    const teamParam = searchParams.get('team');
    if (teamParam && teamParam !== teamFilter) {
      setTeamFilter(teamParam);
    }
  }, [searchParams, teamFilter]);

  // Check if user is admin for any selected players' clubs
  useEffect(() => {
    checkAdminRole();
  }, [user, selectedPlayers]);

  const checkAdminRole = async () => {
    if (!user || selectedPlayers.length === 0) {
      setIsAdmin(false);
      return;
    }
    
    try {
      // Check if user is admin for the first selected player's club
      // (assuming all selected players are from same club in most cases)
      const { data, error } = await supabase
        .from('club_members')
        .select('role')
        .eq('club_id', selectedPlayers[0].club_id)
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      setIsAdmin(data?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
    }
  };

  const handleTeamAssignment = (player: Player) => {
    setSelectedPlayer(player);
    setAssignDialogOpen(true);
  };

  const handleAssignmentUpdate = () => {
    // React Query will automatically refetch and update the UI
    setSelectedPlayers([]);
  };

  const handlePlayerSelection = (player: Player, selected: boolean) => {
    if (selected) {
      setSelectedPlayers([...selectedPlayers, player]);
    } else {
      setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id));
    }
  };

  const handleBulkTeamAssignment = () => {
    setBulkAssignDialogOpen(true);
  };

  const handleBulkDelete = () => {
    if (!isAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only club admins can delete players",
        variant: "destructive",
      });
      return;
    }
    setDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (!isAdmin || selectedPlayers.length === 0) return;
    
    try {
      setDeleting(true);
      const playerIds = selectedPlayers.map(p => p.id);
      
      // Delete team assignments first (though CASCADE should handle this)
      const { error: teamError } = await supabase
        .from('team_players')
        .delete()
        .in('player_id', playerIds);

      if (teamError) {
        console.error('Error removing team assignments:', teamError);
      }

      // Delete all selected players
      const { error } = await supabase
        .from('players')
        .delete()
        .in('id', playerIds);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Deleted ${selectedPlayers.length} player${selectedPlayers.length !== 1 ? 's' : ''}`,
      });

      // Invalidate queries to refresh UI immediately
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      setSelectedPlayers([]);
      setDeleteDialogOpen(false);
    } catch (error: any) {
      console.error('Error deleting players:', error);
      toast({
        title: "Error Deleting Players",
        description: error.message || "Failed to delete players. They may have match history that cannot be removed.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const filterPlayersByTeam = (teamId: string) => {
    setTeamFilter(teamId);
    setSelectedPlayers([]);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border-b border-border py-3 px-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Players</h1>
            <p className="text-muted-foreground">Manage club players and team assignments</p>
          </div>
          
          <div className="flex gap-2">
            {selectedPlayers.length > 0 && (
              <>
                <Button 
                  variant="outline"
                  onClick={handleBulkTeamAssignment}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Assign {selectedPlayers.length}
                </Button>
                {isAdmin && (
                  <Button 
                    variant="destructive"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete {selectedPlayers.length}
                  </Button>
                )}
              </>
            )}
            <Button 
              className="touch-target"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Player
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Filter by team:</span>
            <Select value={teamFilter} onValueChange={filterPlayersByTeam}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedPlayers.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {selectedPlayers.length} player(s) selected
            </div>
          )}
        </div>
      </div>

      {filteredPlayers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {teamFilter === 'all' ? 'No players yet' : 'No players found'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {teamFilter === 'all' 
                ? 'Add your first player to start building your squad'
                : 'No players match the current filter'
              }
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Player
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {filteredPlayers
            .sort((a, b) => {
              const lastNameA = a.last_name || '';
              const lastNameB = b.last_name || '';
              return lastNameA.localeCompare(lastNameB);
            })
            .map((player, index) => (
            <PlayerCard
              key={player.id}
              player={player}
              onPlayerUpdate={() => {}} // React Query handles updates automatically
              onTeamAssignment={handleTeamAssignment}
              isSelected={selectedPlayers.some(p => p.id === player.id)}
              onSelectionChange={handlePlayerSelection}
            />
          ))}
        </div>
      )}

      <PlayerDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        clubs={clubs}
        onPlayerCreated={() => {}} // React Query handles updates automatically
      />

      <TeamAssignmentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        player={selectedPlayer}
        availableTeams={teams}
        onAssignmentUpdate={handleAssignmentUpdate}
      />

      <BulkTeamAssignmentDialog
        open={bulkAssignDialogOpen}
        onOpenChange={setBulkAssignDialogOpen}
        players={selectedPlayers}
        availableTeams={teams}
        onAssignmentUpdate={handleAssignmentUpdate}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedPlayers.length} Player{selectedPlayers.length !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the following player{selectedPlayers.length !== 1 ? 's' : ''}?
              <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
                {selectedPlayers.map(p => (
                  <div key={p.id} className="text-sm font-medium text-foreground">
                    • {p.first_name} {p.last_name}
                    {p.jersey_number && ` (#${p.jersey_number})`}
                  </div>
                ))}
              </div>
              <p className="mt-3">
                This action cannot be undone. Players will be removed from all teams and their match event records will be preserved but anonymized.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBulkDelete} 
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : `Delete ${selectedPlayers.length} Player${selectedPlayers.length !== 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}