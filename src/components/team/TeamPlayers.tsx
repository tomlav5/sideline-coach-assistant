import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Users, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  club_id: string;
}

interface TeamPlayer {
  id: string;
  player_id: string;
  team_id: string;
  player: Player;
}

interface Team {
  id: string;
  name: string;
  club_id: string;
  team_type: string;
}

interface TeamPlayersProps {
  team: Team;
  onClose: () => void;
}

export function TeamPlayers({ team, onClose }: TeamPlayersProps) {
  const { toast } = useToast();
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchTeamPlayers();
    fetchAvailablePlayers();
  }, [team.id]);

  const fetchTeamPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_players')
        .select(`
          *,
          player:players(*)
        `)
        .eq('team_id', team.id);

      if (error) throw error;
      setTeamPlayers(data || []);
    } catch (error) {
      console.error('Error fetching team players:', error);
      toast({
        title: "Error",
        description: "Failed to load team players",
        variant: "destructive",
      });
    }
  };

  const fetchAvailablePlayers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('club_id', team.club_id);

      if (error) throw error;
      
      // Filter out players already in this team
      const currentPlayerIds = teamPlayers.map(tp => tp.player_id);
      const available = (data || []).filter(player => !currentPlayerIds.includes(player.id));
      setAvailablePlayers(available);
    } catch (error) {
      console.error('Error fetching available players:', error);
      toast({
        title: "Error",
        description: "Failed to load available players",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addPlayersToTeam = async () => {
    if (selectedPlayers.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one player",
        variant: "destructive",
      });
      return;
    }

    try {
      setAdding(true);
      const assignments = selectedPlayers.map(playerId => ({
        team_id: team.id,
        player_id: playerId,
      }));

      const { error } = await supabase
        .from('team_players')
        .insert(assignments);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Added ${selectedPlayers.length} player(s) to the team`,
      });

      setAddDialogOpen(false);
      setSelectedPlayers([]);
      fetchTeamPlayers();
      fetchAvailablePlayers();
    } catch (error) {
      console.error('Error adding players:', error);
      toast({
        title: "Error",
        description: "Failed to add players to team",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const removePlayerFromTeam = async (teamPlayerId: string) => {
    try {
      const { error } = await supabase
        .from('team_players')
        .delete()
        .eq('id', teamPlayerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Player removed from team",
      });

      fetchTeamPlayers();
      fetchAvailablePlayers();
    } catch (error) {
      console.error('Error removing player:', error);
      toast({
        title: "Error",
        description: "Failed to remove player from team",
        variant: "destructive",
      });
    }
  };

  const handlePlayerToggle = (playerId: string, checked: boolean) => {
    if (checked) {
      setSelectedPlayers([...selectedPlayers, playerId]);
    } else {
      setSelectedPlayers(selectedPlayers.filter(id => id !== playerId));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">{team.name} Players</h2>
          <p className="text-muted-foreground">{teamPlayers.length} players in squad</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Players
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Players to {team.name}</DialogTitle>
                <DialogDescription>
                  Select players from your club to add to this team
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-10" />
                    ))}
                  </div>
                ) : availablePlayers.length > 0 ? (
                  availablePlayers.map((player) => (
                    <div key={player.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`player-${player.id}`}
                        checked={selectedPlayers.includes(player.id)}
                        onCheckedChange={(checked) => handlePlayerToggle(player.id, checked as boolean)}
                      />
                      <label
                        htmlFor={`player-${player.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {player.first_name} {player.last_name}
                        {player.jersey_number && (
                          <span className="ml-2 text-muted-foreground">#{player.jersey_number}</span>
                        )}
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No available players. All club players are already in this team or no players exist.
                  </p>
                )}
                
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={addPlayersToTeam} 
                    disabled={adding || selectedPlayers.length === 0} 
                    className="flex-1"
                  >
                    {adding ? "Adding..." : `Add ${selectedPlayers.length} Player(s)`}
                  </Button>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {teamPlayers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No players in team</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add players to start building your squad
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Players
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teamPlayers.map((teamPlayer) => (
            <Card key={teamPlayer.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {teamPlayer.player.first_name} {teamPlayer.player.last_name}
                    </CardTitle>
                    {teamPlayer.player.jersey_number && (
                      <CardDescription>
                        Jersey #{teamPlayer.player.jersey_number}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removePlayerFromTeam(teamPlayer.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}