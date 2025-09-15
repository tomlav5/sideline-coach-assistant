import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePlayers } from '@/hooks/usePlayers';
import { useTeams } from '@/hooks/useTeams';
import { useClubs } from '@/hooks/useClubs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, User, Users } from 'lucide-react';
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
  const { data: players = [], isLoading, error } = usePlayers();
  const { data: teams = [] } = useTeams();
  const { data: clubs = [] } = useClubs();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [teamFilter, setTeamFilter] = useState<string>('all');

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
              <Button 
                variant="outline"
                onClick={handleBulkTeamAssignment}
              >
                <Users className="h-4 w-4 mr-2" />
                Assign {selectedPlayers.length} to Teams
              </Button>
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
    </div>
  );
}