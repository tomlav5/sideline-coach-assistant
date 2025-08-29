import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerCard } from '@/components/players/PlayerCard';
import { PlayerDialog } from '@/components/players/PlayerDialog';
import { TeamAssignmentDialog } from '@/components/players/TeamAssignmentDialog';

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
  const { user } = useAuth();
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (user) {
      fetchPlayers();
      fetchClubs();
      fetchTeams();
    }
  }, [user]);

  const fetchClubs = async () => {
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setClubs(data || []);
    } catch (error) {
      console.error('Error fetching clubs:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, team_type, club_id')
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('players')
        .select(`
          *,
          club:clubs(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch team assignments for each player
      const playersWithTeams = await Promise.all(
        (data || []).map(async (player) => {
          const { data: teamData } = await supabase
            .from('team_players')
            .select(`
              team:teams(id, name, team_type, club_id)
            `)
            .eq('player_id', player.id);
          
          return {
            ...player,
            teams: teamData?.map(tp => tp.team).filter(Boolean) || []
          };
        })
      );
      
      setPlayers(playersWithTeams);
    } catch (error) {
      console.error('Error fetching players:', error);
      toast({
        title: "Error",
        description: "Failed to load players",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTeamAssignment = (player: Player) => {
    setSelectedPlayer(player);
    setAssignDialogOpen(true);
  };

  const handleAssignmentUpdate = () => {
    fetchPlayers();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Players</h1>
          <p className="text-muted-foreground">Manage club players and team assignments</p>
        </div>
        
        <Button 
          className="touch-target"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Player
        </Button>
      </div>

      {players.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No players yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first player to start building your squad
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Player
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onPlayerUpdate={fetchPlayers}
              onTeamAssignment={handleTeamAssignment}
            />
          ))}
        </div>
      )}

      <PlayerDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        clubs={clubs}
        onPlayerCreated={fetchPlayers}
      />

      <TeamAssignmentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        player={selectedPlayer}
        availableTeams={teams}
        onAssignmentUpdate={handleAssignmentUpdate}
      />
    </div>
  );
}