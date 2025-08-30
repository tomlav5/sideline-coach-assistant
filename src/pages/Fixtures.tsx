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
import { Calendar, Clock, MapPin, Plus, Play, Home, Plane, Users, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Team {
  id: string;
  name: string;
  club: {
    id: string;
    name: string;
  };
}

interface Fixture {
  id: string;
  scheduled_date: string;
  opponent_name: string;
  location: string | null;
  fixture_type: 'home' | 'away';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  half_length: number;
  team_id: string;
  team: Team;
  created_at: string;
  competition_type: 'league' | 'tournament' | 'friendly';
  competition_name: string | null;
}

const FIXTURE_TYPES = [
  { value: 'home', label: 'Home', icon: Home },
  { value: 'away', label: 'Away', icon: Plane },
];

const COMPETITION_TYPES = [
  { value: 'league', label: 'League Match' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'friendly', label: 'Friendly' },
];

const STATUS_COLORS = {
  scheduled: 'default',
  in_progress: 'secondary', 
  completed: 'outline',
  cancelled: 'destructive',
} as const;

export default function Fixtures() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('');
  const [newFixture, setNewFixture] = useState<{
    team_id: string;
    opponent_name: string;
    location: string;
    fixture_type: 'home' | 'away';
    half_length: number;
    competition_type: 'league' | 'tournament' | 'friendly';
    competition_name: string;
  }>({
    team_id: '',
    opponent_name: '',
    location: '',
    fixture_type: 'home',
    half_length: 25,
    competition_type: 'friendly',
    competition_name: '',
  });

  // Remember last competition settings
  const [lastCompetition, setLastCompetition] = useState<{
    type: 'league' | 'tournament' | 'friendly';
    name: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchFixtures();
      fetchTeams();
    }
  }, [user]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          club:clubs(id, name)
        `)
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchFixtures = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fixtures')
        .select(`
          *,
          team:teams(
            id,
            name,
            club:clubs(id, name)
          )
        `)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setFixtures(data || []);
    } catch (error) {
      console.error('Error fetching fixtures:', error);
      toast({
        title: "Error",
        description: "Failed to load fixtures",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createFixture = async () => {
    if (!newFixture.team_id || !newFixture.opponent_name.trim() || !selectedDate || !selectedTime) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate competition name for tournaments
    if (newFixture.competition_type === 'tournament' && !newFixture.competition_name.trim()) {
      toast({
        title: "Error",
        description: "Tournament name is required for tournament matches",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      
      // Combine date and time
      const [hours, minutes] = selectedTime.split(':');
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes));

      const { error } = await supabase
        .from('fixtures')
        .insert([{
          team_id: newFixture.team_id,
          opponent_name: newFixture.opponent_name.trim(),
          location: newFixture.location.trim() || null,
          fixture_type: newFixture.fixture_type,
          half_length: newFixture.half_length,
          scheduled_date: scheduledDateTime.toISOString(),
          status: 'scheduled',
          competition_type: newFixture.competition_type,
          competition_name: newFixture.competition_name.trim() || null,
        }]);

      if (error) throw error;

      // Remember this competition for next fixture
      setLastCompetition({
        type: newFixture.competition_type,
        name: newFixture.competition_name.trim()
      });

      toast({
        title: "Success",
        description: "Fixture created successfully",
      });

      setCreateDialogOpen(false);
      resetForm();
      fetchFixtures();
    } catch (error) {
      console.error('Error creating fixture:', error);
      toast({
        title: "Error",
        description: "Failed to create fixture",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setNewFixture({
      team_id: '',
      opponent_name: '',
      location: '',
      fixture_type: 'home',
      half_length: 25,
      competition_type: (lastCompetition?.type || 'friendly') as 'league' | 'tournament' | 'friendly',
      competition_name: lastCompetition?.name || '',
    });
    setSelectedDate(undefined);
    setSelectedTime('');
  };

  const getStatusBadgeVariant = (status: string) => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'default';
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'PPP');
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'p');
  };

  const getFixtureTypeIcon = (type: string) => {
    const fixtureType = FIXTURE_TYPES.find(ft => ft.value === type);
    return fixtureType?.icon || Home;
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
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fixtures</h1>
          <p className="text-muted-foreground">Manage team fixtures and matches</p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="touch-target">
              <Plus className="h-4 w-4 mr-2" />
              Create Fixture
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Fixture</DialogTitle>
              <DialogDescription>
                Schedule a new match for your team
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div>
                <Label htmlFor="team">Team</Label>
                <Select value={newFixture.team_id} onValueChange={(value) => setNewFixture({ ...newFixture, team_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name} ({team.club.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="opponent">Opponent</Label>
                <Input
                  id="opponent"
                  value={newFixture.opponent_name}
                  onChange={(e) => setNewFixture({ ...newFixture, opponent_name: e.target.value })}
                  placeholder="Opponent team name"
                />
              </div>
              
              <div>
                <Label htmlFor="fixture_type">Match Type</Label>
                <Select value={newFixture.fixture_type} onValueChange={(value: any) => setNewFixture({ ...newFixture, fixture_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIXTURE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center">
                          <type.icon className="h-4 w-4 mr-2" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Match Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label htmlFor="time">Match Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="location">Location (Optional)</Label>
                <Input
                  id="location"
                  value={newFixture.location}
                  onChange={(e) => setNewFixture({ ...newFixture, location: e.target.value })}
                  placeholder="Match venue"
                />
              </div>
              
              <div>
                <Label htmlFor="competition_type">Competition Type</Label>
                <Select 
                  value={newFixture.competition_type} 
                  onValueChange={(value: 'league' | 'tournament' | 'friendly') => setNewFixture({ 
                    ...newFixture, 
                    competition_type: value,
                    competition_name: value === 'friendly' ? '' : newFixture.competition_name
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPETITION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {(newFixture.competition_type === 'tournament' || newFixture.competition_type === 'league') && (
                <div>
                  <Label htmlFor="competition_name">
                    {newFixture.competition_type === 'tournament' ? 'Tournament Name' : 'League Name'} 
                    {newFixture.competition_type === 'tournament' && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="competition_name"
                    value={newFixture.competition_name}
                    onChange={(e) => setNewFixture({ ...newFixture, competition_name: e.target.value })}
                    placeholder={`Enter ${newFixture.competition_type} name`}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="half_length">Half Length (minutes)</Label>
                <Input
                  id="half_length"
                  type="number"
                  value={newFixture.half_length}
                  onChange={(e) => setNewFixture({ ...newFixture, half_length: parseInt(e.target.value) || 25 })}
                  min="1"
                  max="60"
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={createFixture} disabled={creating} className="flex-1">
                  {creating ? "Creating..." : "Create Fixture"}
                </Button>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {fixtures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No fixtures scheduled</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first fixture to start scheduling matches
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Fixture
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fixtures.map((fixture) => {
            const TypeIcon = getFixtureTypeIcon(fixture.fixture_type);
            return (
              <Card key={fixture.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TypeIcon className="h-5 w-5" />
                        {fixture.team.name} vs {fixture.opponent_name}
                      </CardTitle>
                      <CardDescription>{fixture.team.club.name}</CardDescription>
                    </div>
                    <Badge variant={getStatusBadgeVariant(fixture.status)}>
                      {fixture.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2" />
                    {formatDate(fixture.scheduled_date)}
                  </div>
                  
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 mr-2" />
                    {formatTime(fixture.scheduled_date)} ({fixture.half_length}min halves)
                  </div>
                  
                   {fixture.location && (
                     <div className="flex items-center text-sm text-muted-foreground">
                       <MapPin className="h-4 w-4 mr-2" />
                       {fixture.location}
                     </div>
                   )}
                   
                   {fixture.competition_type !== 'friendly' && (
                     <div className="flex items-center text-sm text-muted-foreground">
                       <Trophy className="h-4 w-4 mr-2" />
                       {fixture.competition_type === 'league' ? 'League' : 'Tournament'}
                       {fixture.competition_name && `: ${fixture.competition_name}`}
                     </div>
                   )}
                  
                   {fixture.status === 'scheduled' && (
                     <div className="flex space-x-2 mt-4">
                       <Button 
                         size="sm" 
                         onClick={() => navigate(`/squad/${fixture.id}`)}
                         className="flex-1 bg-blue-600 hover:bg-blue-700"
                       >
                         <Users className="h-4 w-4 mr-1" />
                         Select Squad
                       </Button>
                       <Button 
                         size="sm" 
                         variant="outline"
                         disabled={true}
                         className="flex-1"
                       >
                         <Play className="h-4 w-4 mr-1" />
                         Start Match
                       </Button>
                     </div>
                   )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}