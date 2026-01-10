import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, X, AlertTriangle, Target, Clock, Calendar, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { EventsTable } from '@/components/match-editor/EventsTable';
import { PlayerTimesTable } from '@/components/match-editor/PlayerTimesTable';
import { PeriodsTable } from '@/components/match-editor/PeriodsTable';
import { ValidationPanel } from '@/components/match-editor/ValidationPanel';

interface MatchEvent {
  id: string;
  event_type: string;
  minute_in_period: number;
  total_match_minute: number;
  period_id: string;
  is_our_team: boolean;
  is_penalty?: boolean;
  player_id?: string;
  assist_player_id?: string | null;
  notes?: string;
  players?: {
    first_name: string;
    last_name: string;
    jersey_number?: number;
  };
  assist_players?: {
    first_name: string;
    last_name: string;
    jersey_number?: number;
  };
  match_periods?: {
    period_number: number;
  };
}

interface PlayerTime {
  id: string;
  player_id: string;
  period_id: string;
  time_on_minute: number | null;
  time_off_minute: number | null;
  is_starter: boolean;
  total_period_minutes: number;
  players: {
    first_name: string;
    last_name: string;
    jersey_number?: number;
  };
  match_periods: {
    period_number: number;
    planned_duration_minutes: number;
  };
}

interface MatchPeriod {
  id: string;
  period_number: number;
  period_type: string;
  planned_duration_minutes: number;
  actual_start_time?: string;
  actual_end_time?: string;
  is_active: boolean;
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface FixtureDetails {
  id: string;
  scheduled_date: string;
  opponent_name: string;
  location: string;
  status: string;
  team_id: string;
  teams: {
    name: string;
  };
}

export default function MatchDataEditor() {
  const { fixtureId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [fixture, setFixture] = useState<FixtureDetails | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [playerTimes, setPlayerTimes] = useState<PlayerTime[]>([]);
  const [periods, setPeriods] = useState<MatchPeriod[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('events');

  useEffect(() => {
    if (fixtureId) {
      fetchAllData();
    }
  }, [fixtureId]);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // Fetch fixture details
      const { data: fixtureData, error: fixtureError } = await supabase
        .from('fixtures')
        .select(`
          id,
          scheduled_date,
          opponent_name,
          location,
          status,
          team_id,
          teams!fk_fixtures_team_id (name)
        `)
        .eq('id', fixtureId)
        .single();

      if (fixtureError) throw fixtureError;
      setFixture(fixtureData as unknown as FixtureDetails);

      // Fetch match events
      const { data: eventsData, error: eventsError } = await supabase
        .from('match_events')
        .select(`
          id,
          event_type,
          minute_in_period,
          total_match_minute,
          period_id,
          is_our_team,
          is_penalty,
          player_id,
          assist_player_id,
          notes,
          players!fk_match_events_player_id (
            first_name,
            last_name,
            jersey_number
          ),
          assist_players:players!fk_match_events_assist_player_id (
            first_name,
            last_name,
            jersey_number
          ),
          match_periods (
            period_number
          )
        `)
        .eq('fixture_id', fixtureId)
        .order('total_match_minute', { ascending: true });

      if (eventsError) throw eventsError;
      setEvents((eventsData || []) as unknown as MatchEvent[]);

      // Fetch match periods
      const { data: periodsData, error: periodsError } = await supabase
        .from('match_periods')
        .select('id, period_number, period_type, planned_duration_minutes, actual_start_time, actual_end_time, is_active')
        .eq('fixture_id', fixtureId)
        .order('period_number', { ascending: true });

      if (periodsError) throw periodsError;
      setPeriods((periodsData || []) as unknown as MatchPeriod[]);

      // Fetch player times
      const { data: playerTimesData, error: playerTimesError } = await supabase
        .from('player_time_logs')
        .select(`
          id,
          player_id,
          period_id,
          time_on_minute,
          time_off_minute,
          total_period_minutes,
          is_starter,
          players!fk_player_time_logs_player_id (
            first_name,
            last_name,
            jersey_number
          ),
          match_periods (
            period_number,
            planned_duration_minutes
          )
        `)
        .eq('fixture_id', fixtureId)
        .order('period_id', { ascending: true })
        .order('is_starter', { ascending: false });

      if (playerTimesError) throw playerTimesError;
      setPlayerTimes((playerTimesData || []) as unknown as PlayerTime[]);

      // Fetch team players
      if (fixtureData && (fixtureData as any).team_id) {
        const { data: playersData, error: playersError } = await supabase
          .from('team_players')
          .select(`
            players!fk_team_players_player_id (
              id,
              first_name,
              last_name,
              jersey_number
            )
          `)
          .eq('team_id', (fixtureData as any).team_id)
          .order('players(jersey_number)', { ascending: true });

        if (!playersError && playersData) {
          setPlayers(playersData.map(tp => (tp as any).players).filter(Boolean));
        }
      }

    } catch (error: any) {
      console.error('Error fetching match data:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load match data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        navigate(`/match-report/${fixtureId}`);
      }
    } else {
      navigate(`/match-report/${fixtureId}`);
    }
  };

  const getScore = () => {
    const ourGoals = events.filter(e => e.event_type === 'goal' && e.is_our_team).length;
    const opponentGoals = events.filter(e => e.event_type === 'goal' && !e.is_our_team).length;
    return { ourGoals, opponentGoals };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading match data...</div>
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-xl font-semibold mb-4">Match not found</h2>
        <Button onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Reports
        </Button>
      </div>
    );
  }

  const { ourGoals, opponentGoals } = getScore();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          {/* Mobile: Stack vertically, Desktop: Horizontal */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left section with Back button and title */}
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <Button variant="ghost" size="sm" onClick={handleCancel} className="flex-shrink-0">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-xl md:text-2xl font-bold truncate">
                  Match Data Editor
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {fixture.teams.name} vs {fixture.opponent_name}
                </p>
              </div>
            </div>

            {/* Right section with status and cancel */}
            <div className="flex items-center justify-between sm:justify-end gap-2">
              {hasUnsavedChanges && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 text-xs">
                  Unsaved
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-2 sm:py-3">
          {/* Mobile: 2-row layout, Desktop: Single row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm">
            {/* Stats row */}
            <div className="flex items-center gap-3 sm:gap-6 overflow-x-auto">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className="text-muted-foreground text-xs sm:text-sm">Score:</span>
                <span className="font-mono font-bold text-base sm:text-lg">
                  {ourGoals} - {opponentGoals}
                </span>
              </div>
              <Separator orientation="vertical" className="h-4 sm:h-6 hidden sm:block" />
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="whitespace-nowrap">{events.length}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="whitespace-nowrap">{playerTimes.length}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="whitespace-nowrap">{periods.length}</span>
              </div>
            </div>
            
            {/* Date - right aligned on desktop, left on mobile */}
            <div className="text-muted-foreground text-xs sm:text-sm">
              {format(new Date(fixture.scheduled_date), 'MMM do, yyyy')}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Events</span>
              <Badge variant="secondary" className="ml-1">{events.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="times" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Player Times</span>
              <Badge variant="secondary" className="ml-1">{playerTimes.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="periods" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Periods</span>
              <Badge variant="secondary" className="ml-1">{periods.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="validation" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Validation</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Match Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EventsTable
                  events={events}
                  periods={periods}
                  players={players}
                  fixtureId={fixtureId!}
                  onUpdate={fetchAllData}
                  onHasChanges={setHasUnsavedChanges}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="times" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Player Time Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PlayerTimesTable
                  playerTimes={playerTimes}
                  periods={periods}
                  players={players}
                  fixtureId={fixtureId!}
                  onUpdate={fetchAllData}
                  onHasChanges={setHasUnsavedChanges}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="periods" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Match Periods
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PeriodsTable
                  periods={periods}
                  fixtureId={fixtureId!}
                  onUpdate={fetchAllData}
                  onHasChanges={setHasUnsavedChanges}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="validation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Data Validation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ValidationPanel
                  fixtureId={fixtureId!}
                  events={events}
                  playerTimes={playerTimes}
                  periods={periods}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
