import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Plus, Play, Home, Plane, Users, Trophy, Settings, X, Trash2, Filter, CalendarDays } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isAfter, isBefore, startOfDay, endOfDay, subDays, addDays } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateFixtureDialog } from '@/components/fixtures/CreateFixtureDialog';
import { EditFixtureDialog } from '@/components/fixtures/EditFixtureDialog';
import { useQueryClient } from '@tanstack/react-query';

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
  selected_squad_data: any;
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
  const queryClient = useQueryClient();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFixture, setEditingFixture] = useState<Fixture | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('');
  
  // Date filtering state
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>('upcoming');
  
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
  const [updating, setUpdating] = useState(false);

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
          team:teams!fk_fixtures_team_id(
            id,
            name,
            club:clubs(id, name)
          )
        `)
        .order('scheduled_date', { ascending: false }); // Show most recent first

      if (error) throw error;
      setFixtures((data || []) as unknown as Fixture[]);
    } catch (error) {
      console.error('Error fetching fixtures:', error);
    } finally {
      setLoading(false);
    }
  };

  const createFixture = async () => {
    if (!newFixture.team_id || !newFixture.opponent_name.trim() || !selectedDate || !selectedTime) {
      return;
    }

    // Validate competition name for tournaments
    if (newFixture.competition_type === 'tournament' && !newFixture.competition_name.trim()) {
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

      setCreateDialogOpen(false);
      resetForm();
      fetchFixtures();
      
      // Invalidate dashboard cache to trigger auto-refresh
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error) {
      console.error('Error creating fixture:', error);
    } finally {
      setCreating(false);
    }
  };

  const editFixture = (fixture: Fixture) => {
    setEditingFixture(fixture);
    setNewFixture({
      team_id: fixture.team_id,
      opponent_name: fixture.opponent_name,
      location: fixture.location || '',
      fixture_type: fixture.fixture_type,
      half_length: fixture.half_length,
      competition_type: fixture.competition_type,
      competition_name: fixture.competition_name || '',
    });
    setSelectedDate(new Date(fixture.scheduled_date));
    setSelectedTime(format(new Date(fixture.scheduled_date), 'HH:mm'));
    setEditDialogOpen(true);
  };

  const updateFixture = async () => {
    if (!editingFixture || !newFixture.team_id || !newFixture.opponent_name.trim() || !selectedDate || !selectedTime) {
      return;
    }

    try {
      setUpdating(true);
      
      // Combine date and time
      const [hours, minutes] = selectedTime.split(':');
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes));

      const { error } = await supabase
        .from('fixtures')
        .update({
          team_id: newFixture.team_id,
          opponent_name: newFixture.opponent_name.trim(),
          location: newFixture.location.trim() || null,
          fixture_type: newFixture.fixture_type,
          half_length: newFixture.half_length,
          scheduled_date: scheduledDateTime.toISOString(),
          competition_type: newFixture.competition_type,
          competition_name: newFixture.competition_name.trim() || null,
        })
        .eq('id', editingFixture.id);

      if (error) throw error;

      setEditDialogOpen(false);
      setEditingFixture(null);
      resetForm();
      fetchFixtures();
      
      // Invalidate dashboard cache to trigger auto-refresh
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error) {
      console.error('Error updating fixture:', error);
    } finally {
      setUpdating(false);
    }
  };

  const cancelFixture = async (fixtureId: string) => {
    try {
      const { error } = await supabase
        .from('fixtures')
        .update({ status: 'cancelled' as any })
        .eq('id', fixtureId);

      if (error) throw error;
      fetchFixtures();
      
      // Invalidate dashboard cache to trigger auto-refresh
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error) {
      console.error('Error cancelling fixture:', error);
    }
  };

  const deleteFixture = async (fixtureId: string) => {
    try {
      const { error } = await supabase
        .from('fixtures')
        .delete()
        .eq('id', fixtureId);

      if (error) throw error;
      fetchFixtures();
      
      // Invalidate dashboard cache to trigger auto-refresh
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error) {
      console.error('Error deleting fixture:', error);
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

  // Filter fixtures based on status and date
  const getFilteredFixtures = (isCompleted: boolean) => {
    const now = new Date();
    let filtered = fixtures.filter(fixture => {
      if (isCompleted) {
        return fixture.status === 'completed';
      } else {
        return fixture.status !== 'completed' && fixture.status !== 'cancelled';
      }
    });

    // Apply date range filter if set
    if (startDate && endDate) {
      filtered = filtered.filter(fixture => {
        const fixtureDate = new Date(fixture.scheduled_date);
        return isAfter(fixtureDate, startOfDay(startDate)) && 
               isBefore(fixtureDate, endOfDay(endDate));
      });
    }

    return filtered;
  };

  const upcomingFixtures = getFilteredFixtures(false);
  const completedFixtures = getFilteredFixtures(true);

  // Quick date filter options
  const applyQuickFilter = (days: number) => {
    const now = new Date();
    if (days > 0) {
      // Future dates
      setStartDate(now);
      setEndDate(addDays(now, days));
      setActiveTab('upcoming');
    } else {
      // Past dates
      setStartDate(addDays(now, days));
      setEndDate(now);
      setActiveTab('completed');
    }
  };

  const clearDateFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const renderFixtures = (fixtureList: Fixture[], type: 'upcoming' | 'completed') => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      );
    }

    if (fixtureList.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No {type} fixtures {(startDate || endDate) ? 'in date range' : 'found'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {type === 'upcoming' 
                ? 'Create your first fixture to start scheduling matches'
                : 'No completed fixtures to display'}
            </p>
            {type === 'upcoming' && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Fixture
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {fixtureList.map((fixture) => {
          const TypeIcon = getFixtureTypeIcon(fixture.fixture_type);
          const isUpcoming = type === 'upcoming';
          
           return (
             <Card 
               key={fixture.id} 
               className={`hover:shadow-md transition-shadow cursor-pointer touch-manipulation ${
                 fixture.status === 'in_progress' 
                   ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950' 
                   : ''
               }`}
               onClick={() => {
                 if (fixture.status === 'in_progress') {
                   navigate(`/match-day/${fixture.id}`);
                 } else {
                   navigate(`/fixture/${fixture.id}`);
                 }
               }}
             >
              <CardContent className="p-3 sm:p-4">
                 <div className="space-y-3">
                   {/* Live Match Indicator for in-progress matches */}
                   {fixture.status === 'in_progress' && (
                     <div className="flex items-center space-x-2 mb-2">
                       <div className="h-3 w-3 bg-orange-500 rounded-full animate-pulse"></div>
                       <Badge variant="destructive" className="animate-pulse text-xs bg-orange-600 text-white">
                         LIVE
                       </Badge>
                     </div>
                   )}

                   {/* Main fixture info */}
                   <div className="flex items-start gap-2 sm:gap-3">
                     <TypeIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                     <div className="flex-1 min-w-0">
                       <h3 className={`font-semibold text-sm sm:text-base leading-tight ${
                         fixture.status === 'in_progress' 
                           ? 'text-orange-900 dark:text-orange-100' 
                           : ''
                       }`}>
                         <span className="block sm:inline">{fixture.team.name}</span>
                         <span className="block sm:inline text-muted-foreground sm:text-foreground"> vs </span>
                         <span className="block sm:inline">{fixture.opponent_name}</span>
                       </h3>
                     </div>
                   </div>
                  
                   {/* Date and time info */}
                   <div className="flex items-center justify-between">
                     <div className={`flex flex-wrap items-center gap-2 text-xs sm:text-sm ${
                       fixture.status === 'in_progress' 
                         ? 'text-orange-700 dark:text-orange-300' 
                         : 'text-muted-foreground'
                     }`}>
                       <span className="flex items-center gap-1">
                         <Calendar className="h-3 w-3" />
                         {format(new Date(fixture.scheduled_date), 'dd/MM/yyyy')}
                       </span>
                       <span className="flex items-center gap-1">
                         <Clock className="h-3 w-3" />
                         {format(new Date(fixture.scheduled_date), 'HH:mm')}
                       </span>
                       <span className="capitalize hidden xs:inline flex-shrink-0">
                         {fixture.competition_type === 'league' ? 'League' : 
                          fixture.competition_type === 'tournament' ? 'Tournament' : 'Friendly'}
                       </span>
                       {fixture.location && (
                         <span className="hidden sm:inline truncate max-w-24">
                           <MapPin className="h-3 w-3 inline mr-1" />
                           {fixture.location}
                         </span>
                       )}
                       {fixture.selected_squad_data && fixture.selected_squad_data.startingLineup?.length > 0 && (
                         <span className="hidden sm:inline text-green-600 text-xs font-medium">
                           ✓ Squad Ready
                         </span>
                       )}
                     </div>
                    
                    {/* Status and actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={getStatusBadgeVariant(fixture.status)} className="text-xs">
                        {fixture.status.replace('_', ' ')}
                      </Badge>
                      
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                           <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                             <Settings className="h-4 w-4" />
                           </Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/fixture/${fixture.id}`);
                        }}>
                          <Calendar className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {fixture.status === 'in_progress' && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/match-day/${fixture.id}`);
                          }}>
                            <Play className="h-4 w-4 mr-2" />
                            Resume Match
                          </DropdownMenuItem>
                        )}
                        {isUpcoming && fixture.status === 'scheduled' && (
                          <>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/squad/${fixture.id}`);
                            }}>
                              <Users className="h-4 w-4 mr-2" />
                              Select Squad
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              // Check if squad is selected before starting match
                              if (fixture.selected_squad_data && fixture.selected_squad_data.startingLineup?.length > 0) {
                                navigate(`/match-day/${fixture.id}`, {
                                  state: {
                                    squad: fixture.selected_squad_data.startingLineup.concat(fixture.selected_squad_data.substitutes || []),
                                    starters: fixture.selected_squad_data.startingLineup.map((player: any) => player.id),
                                    substitutes: fixture.selected_squad_data.substitutes || []
                                  }
                                });
                              } else {
                                navigate(`/squad/${fixture.id}`);
                              }
                            }}>
                              <Play className="h-4 w-4 mr-2" />
                              Start Match
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          editFixture(fixture);
                        }}>
                          <Settings className="h-4 w-4 mr-2" />
                          Edit Details
                        </DropdownMenuItem>
                        {fixture.status === 'scheduled' && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            cancelFixture(fixture.id);
                          }}>
                            <X className="h-4 w-4 mr-2" />
                            Cancel Match
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFixture(fixture.id);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                         </DropdownMenuItem>
                         </DropdownMenuContent>
                       </DropdownMenu>
                     </div>
                   </div>
                 </div>
               </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6 max-w-full overflow-hidden">
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
    <div className="container mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fixtures</h1>
          <p className="text-muted-foreground">Manage team fixtures and matches</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
          {/* Date Filter Dialog */}
          <Dialog open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="touch-target w-full sm:w-auto">
                <Filter className="h-4 w-4 mr-2" />
                Date Filter
                {(startDate || endDate) && (
                  <Badge variant="secondary" className="ml-2">
                    Active
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Filter by Date Range</DialogTitle>
                <DialogDescription>
                  Filter fixtures between specific dates
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Quick Filters */}
                <div>
                  <Label className="text-sm font-medium">Quick Filters</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button variant="outline" size="sm" onClick={() => applyQuickFilter(7)}>
                      Next 7 days
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => applyQuickFilter(30)}>
                      Next 30 days
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => applyQuickFilter(-7)}>
                      Last 7 days
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => applyQuickFilter(-30)}>
                      Last 30 days
                    </Button>
                  </div>
                </div>
                
                {/* Custom Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "MMM dd") : "Start"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          className="p-3"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div>
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "MMM dd") : "End"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          className="p-3"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button onClick={clearDateFilter} variant="outline" className="flex-1">
                    Clear Filter
                  </Button>
                  <Button onClick={() => setDateFilterOpen(false)} className="flex-1">
                    Apply
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Fixture</DialogTitle>
                <DialogDescription>
                  Schedule a new match for your team
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 px-1">
                <div>
                  <Label htmlFor="team" className="text-base">Team</Label>
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
                  <Label htmlFor="opponent" className="text-base">Opponent</Label>
                  <Input
                    id="opponent"
                    value={newFixture.opponent_name}
                    onChange={(e) => setNewFixture({ ...newFixture, opponent_name: e.target.value })}
                    placeholder="Opponent team name"
                    className="text-base min-h-[44px]"
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

          {/* Edit Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Fixture</DialogTitle>
                <DialogDescription>
                  Update fixture details
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 px-1">
                <div>
                  <Label htmlFor="edit-team" className="text-base">Team</Label>
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
                  <Label htmlFor="edit-opponent" className="text-base">Opponent</Label>
                  <Input
                    id="edit-opponent"
                    value={newFixture.opponent_name}
                    onChange={(e) => setNewFixture({ ...newFixture, opponent_name: e.target.value })}
                    placeholder="Opponent team name"
                    className="text-base min-h-[44px]"
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-fixture_type">Match Type</Label>
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
                  <Label htmlFor="edit-time">Match Time</Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-location">Location (Optional)</Label>
                  <Input
                    id="edit-location"
                    value={newFixture.location}
                    onChange={(e) => setNewFixture({ ...newFixture, location: e.target.value })}
                    placeholder="Match venue"
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-competition_type">Competition Type</Label>
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
                    <Label htmlFor="edit-competition_name">
                      {newFixture.competition_type === 'tournament' ? 'Tournament Name' : 'League Name'} 
                      {newFixture.competition_type === 'tournament' && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id="edit-competition_name"
                      value={newFixture.competition_name}
                      onChange={(e) => setNewFixture({ ...newFixture, competition_name: e.target.value })}
                      placeholder={`Enter ${newFixture.competition_type} name`}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="edit-half_length">Half Length (minutes)</Label>
                  <Input
                    id="edit-half_length"
                    type="number"
                    value={newFixture.half_length}
                    onChange={(e) => setNewFixture({ ...newFixture, half_length: parseInt(e.target.value) || 25 })}
                    min="1"
                    max="60"
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button onClick={updateFixture} disabled={updating} className="flex-1">
                    {updating ? "Updating..." : "Update Fixture"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs for Past/Upcoming Fixtures */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'upcoming' | 'completed')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upcoming" className="relative">
            Upcoming
            {upcomingFixtures.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 text-xs">
                {upcomingFixtures.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="relative">
            Completed
            {completedFixtures.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 text-xs">
                {completedFixtures.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {renderFixtures(upcomingFixtures, 'upcoming')}
        </TabsContent>
        
        <TabsContent value="completed" className="space-y-4">
          {renderFixtures(completedFixtures, 'completed')}
        </TabsContent>
      </Tabs>
    </div>
  );
}