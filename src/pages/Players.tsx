import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Plus, User, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [newPlayer, setNewPlayer] = useState({
    first_name: '',
    last_name: '',
    jersey_number: '',
    club_id: '',
  });
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(false);

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

  const createPlayer = async () => {
    if (!newPlayer.first_name.trim() || !newPlayer.last_name.trim() || !newPlayer.club_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      const playerData: any = {
        first_name: newPlayer.first_name.trim(),
        last_name: newPlayer.last_name.trim(),
        club_id: newPlayer.club_id,
      };

      if (newPlayer.jersey_number) {
        playerData.jersey_number = parseInt(newPlayer.jersey_number);
      }

      const { error } = await supabase
        .from('players')
        .insert([playerData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Player created successfully",
      });

      setCreateDialogOpen(false);
      setNewPlayer({ first_name: '', last_name: '', jersey_number: '', club_id: '' });
      fetchPlayers();
    } catch (error) {
      console.error('Error creating player:', error);
      toast({
        title: "Error",
        description: "Failed to create player",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const openAssignDialog = (player: Player) => {
    setSelectedPlayer(player);
    setSelectedTeams(player.teams?.map(t => t.id) || []);
    setAssignDialogOpen(true);
  };

  const assignToTeams = async () => {
    if (!selectedPlayer) return;

    try {
      setAssigning(true);
      
      // Remove existing team assignments
      await supabase
        .from('team_players')
        .delete()
        .eq('player_id', selectedPlayer.id);

      // Add new team assignments
      if (selectedTeams.length > 0) {
        const assignments = selectedTeams.map(teamId => ({
          player_id: selectedPlayer.id,
          team_id: teamId,
        }));

        const { error } = await supabase
          .from('team_players')
          .insert(assignments);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Team assignments updated successfully",
      });

      setAssignDialogOpen(false);
      setSelectedPlayer(null);
      setSelectedTeams([]);
      fetchPlayers();
    } catch (error) {
      console.error('Error assigning teams:', error);
      toast({
        title: "Error",
        description: "Failed to update team assignments",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleTeamToggle = (teamId: string, checked: boolean) => {
    if (checked) {
      setSelectedTeams([...selectedTeams, teamId]);
    } else {
      setSelectedTeams(selectedTeams.filter(id => id !== teamId));
    }
  };

  const getPlayerTeamsForClub = (player: Player) => {
    return teams.filter(team => 
      team.club_id === player.club_id
    );
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
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="touch-target">
              <Plus className="h-4 w-4 mr-2" />
              Add Player
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Player</DialogTitle>
              <DialogDescription>
                Add a new player to your club
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="club">Club</Label>
                <Select value={newPlayer.club_id} onValueChange={(value) => setNewPlayer({ ...newPlayer, club_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a club" />
                  </SelectTrigger>
                  <SelectContent>
                    {clubs.map((club) => (
                      <SelectItem key={club.id} value={club.id}>
                        {club.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={newPlayer.first_name}
                    onChange={(e) => setNewPlayer({ ...newPlayer, first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={newPlayer.last_name}
                    onChange={(e) => setNewPlayer({ ...newPlayer, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="jersey_number">Jersey Number (Optional)</Label>
                <Input
                  id="jersey_number"
                  type="number"
                  value={newPlayer.jersey_number}
                  onChange={(e) => setNewPlayer({ ...newPlayer, jersey_number: e.target.value })}
                  placeholder="10"
                  min="1"
                  max="99"
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={createPlayer} disabled={creating} className="flex-1">
                  {creating ? "Adding..." : "Add Player"}
                </Button>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
            <Card key={player.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {player.first_name} {player.last_name}
                      {player.jersey_number && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          #{player.jersey_number}
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>{player.club.name}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Teams:</p>
                    {player.teams && player.teams.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {player.teams.map((team) => (
                          <Badge key={team.id} variant="secondary" className="text-xs">
                            {team.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not assigned to any team</p>
                    )}
                  </div>
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => openAssignDialog(player)}
                    className="w-full"
                  >
                    <Users className="h-4 w-4 mr-1" />
                    Manage Teams
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Team Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teams</DialogTitle>
            <DialogDescription>
              Select which teams {selectedPlayer?.first_name} {selectedPlayer?.last_name} should be part of
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPlayer && getPlayerTeamsForClub(selectedPlayer).length > 0 ? (
              getPlayerTeamsForClub(selectedPlayer).map((team) => (
                <div key={team.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`team-${team.id}`}
                    checked={selectedTeams.includes(team.id)}
                    onCheckedChange={(checked) => handleTeamToggle(team.id, checked as boolean)}
                  />
                  <label
                    htmlFor={`team-${team.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {team.name} ({team.team_type.replace('-', ' ')})
                  </label>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No teams available for this club. Create teams first.
              </p>
            )}
            
            <div className="flex gap-2 pt-4">
              <Button onClick={assignToTeams} disabled={assigning} className="flex-1">
                {assigning ? "Updating..." : "Update Teams"}
              </Button>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}