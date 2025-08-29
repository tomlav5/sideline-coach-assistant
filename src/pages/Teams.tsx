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
import { Users, Plus, Settings, UserPlus } from 'lucide-react';
import { TeamPlayers } from '@/components/team/TeamPlayers';
import { TeamSettings } from '@/components/team/TeamSettings';
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
  created_at: string;
  club: Club;
  _count?: {
    team_players: number;
  };
}

const TEAM_TYPES = [
  { value: '5-a-side', label: '5-a-side' },
  { value: '7-a-side', label: '7-a-side' },
  { value: '9-a-side', label: '9-a-side' },
  { value: '11-a-side', label: '11-a-side' },
];

export default function Teams() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showPlayerManagement, setShowPlayerManagement] = useState(false);
  const [showTeamSettings, setShowTeamSettings] = useState(false);
  const [newTeam, setNewTeam] = useState({
    name: '',
    team_type: '11-a-side' as const,
    club_id: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTeams();
      fetchClubs();
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
      toast({
        title: "Error",
        description: "Failed to load clubs",
        variant: "destructive",
      });
    }
  };

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          club:clubs(id, name),
          team_players(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to include player count
      const teamsWithCount = data?.map(team => ({
        ...team,
        _count: {
          team_players: team.team_players?.length || 0
        }
      })) || [];
      
      setTeams(teamsWithCount);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: "Error",
        description: "Failed to load teams",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createTeam = async () => {
    if (!newTeam.name.trim() || !newTeam.club_id) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      const { error } = await supabase
        .from('teams')
        .insert([{
          name: newTeam.name.trim(),
          team_type: newTeam.team_type,
          club_id: newTeam.club_id,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team created successfully",
      });

      setCreateDialogOpen(false);
      setNewTeam({ name: '', team_type: '11-a-side', club_id: '' });
      fetchTeams();
    } catch (error) {
      console.error('Error creating team:', error);
      toast({
        title: "Error",
        description: "Failed to create team",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const getTeamTypeLabel = (type: string) => {
    return TEAM_TYPES.find(t => t.value === type)?.label || type;
  };

  const handlePlayerManagement = (team: Team) => {
    setSelectedTeam(team);
    setShowPlayerManagement(true);
  };

  const handleTeamSettings = (team: Team) => {
    setSelectedTeam(team);
    setShowTeamSettings(true);
  };

  const handleClosePlayerManagement = () => {
    setShowPlayerManagement(false);
    setSelectedTeam(null);
  };

  const handleCloseTeamSettings = () => {
    setShowTeamSettings(false);
    setSelectedTeam(null);
  };

  const handleTeamUpdated = () => {
    fetchTeams();
  };

  const handleTeamDeleted = () => {
    fetchTeams();
  };

  // Show player management view
  if (showPlayerManagement && selectedTeam) {
    return (
      <div className="container mx-auto p-4">
        <TeamPlayers team={selectedTeam} onClose={handleClosePlayerManagement} />
      </div>
    );
  }

  // Show team settings view
  if (showTeamSettings && selectedTeam) {
    return (
      <div className="container mx-auto p-4">
        <TeamSettings 
          team={selectedTeam} 
          onClose={handleCloseTeamSettings}
          onTeamUpdated={handleTeamUpdated}
          onTeamDeleted={handleTeamDeleted}
        />
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-foreground">Teams</h1>
          <p className="text-muted-foreground">Manage your club teams</p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="touch-target">
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Add a new team to your club
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="club">Club</Label>
                <Select value={newTeam.club_id} onValueChange={(value) => setNewTeam({ ...newTeam, club_id: value })}>
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
              
              <div>
                <Label htmlFor="name">Team Name</Label>
                <Input
                  id="name"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  placeholder="Enter team name"
                />
              </div>
              
              <div>
                <Label htmlFor="type">Team Type</Label>
                <Select value={newTeam.team_type} onValueChange={(value: any) => setNewTeam({ ...newTeam, team_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={createTeam} disabled={creating} className="flex-1">
                  {creating ? "Creating..." : "Create Team"}
                </Button>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first team to start managing players and fixtures
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <CardDescription>{team.club.name}</CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {getTeamTypeLabel(team.team_type)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="h-4 w-4 mr-1" />
                    {team._count?.team_players || 0} players
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handlePlayerManagement(team)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Players
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleTeamSettings(team)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}