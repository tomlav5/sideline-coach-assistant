import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { EnhancedMatchControls } from '@/components/match/EnhancedMatchControls';
import { EnhancedEventDialog } from '@/components/match/EnhancedEventDialog';
import { RetrospectiveMatchDialog } from '@/components/fixtures/RetrospectiveMatchDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clock, Users, Target, History } from 'lucide-react';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface MatchEvent {
  id: string;
  event_type: string;
  period_id: string;
  player_id?: string;
  assist_player_id?: string;
  minute_in_period: number;
  total_match_minute: number;
  is_our_team: boolean;
  is_penalty?: boolean;
  notes?: string;
  players?: Player;
  assist_players?: Player;
}

interface MatchPeriod {
  id: string;
  period_number: number;
  planned_duration_minutes: number;
  is_active: boolean;
}

export default function EnhancedMatchTracker() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const navigate = useNavigate();
  
  const [fixture, setFixture] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [periods, setPeriods] = useState<MatchPeriod[]>([]);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showRetrospectiveDialog, setShowRetrospectiveDialog] = useState(false);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [totalMatchMinute, setTotalMatchMinute] = useState(0);
  const [currentPeriodNumber, setCurrentPeriodNumber] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (fixtureId) {
      loadMatchData();
    }
  }, [fixtureId]);

  const loadMatchData = async () => {
    try {
      setLoading(true);

      // Load fixture data
      const { data: fixtureData, error: fixtureError } = await supabase
        .from('fixtures')
        .select(`
          *,
          teams(*, 
            team_players(
              players(*)
            )
          )
        `)
        .eq('id', fixtureId)
        .single();

      if (fixtureError) throw fixtureError;

      setFixture(fixtureData);

      // Extract players from selected squad or all team players
      let squadPlayers: Player[] = [];
      if (fixtureData.selected_squad_data) {
        const squadData = fixtureData.selected_squad_data as any;
        if (squadData.starting_players || squadData.substitute_players) {
          squadPlayers = [
            ...(squadData.starting_players || []),
            ...(squadData.substitute_players || [])
          ];
        }
      } else if (fixtureData.teams?.team_players) {
        squadPlayers = fixtureData.teams.team_players.map((tp: any) => tp.players);
      }

      setPlayers(squadPlayers);

      // Load periods
      const { data: periodsData, error: periodsError } = await supabase
        .from('match_periods')
        .select('*')
        .eq('fixture_id', fixtureId)
        .order('period_number');

      if (periodsError) throw periodsError;
      setPeriods(periodsData || []);

      // Load events
      await loadEvents();

    } catch (error) {
      console.error('Error loading match data:', error);
      toast.error('Failed to load match data');
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('match_events')
        .select(`
          *,
          players!player_id(first_name, last_name, jersey_number),
          assist_players:players!assist_player_id(first_name, last_name, jersey_number)
        `)
        .eq('fixture_id', fixtureId)
        .order('total_match_minute');

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const handleTimerUpdate = (minute: number, totalMinute: number, periodNumber: number) => {
    setCurrentMinute(minute);
    setTotalMatchMinute(totalMinute);
    setCurrentPeriodNumber(periodNumber);
  };

  const currentPeriod = periods.find(p => p.period_number === currentPeriodNumber);

  const ourGoals = events.filter(e => e.event_type === 'goal' && e.is_our_team).length;
  const opponentGoals = events.filter(e => e.event_type === 'goal' && !e.is_our_team).length;

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">Loading match data...</div>
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">Match not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Match Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div>
              {fixture.teams?.name} vs {fixture.opponent_name}
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-2xl font-bold">
                {ourGoals} - {opponentGoals}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Total Time: {Math.floor(totalMatchMinute)} minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{players.length} players available</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span>{events.length} events recorded</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Timer Controls */}
      <EnhancedMatchControls
        fixtureId={fixtureId!}
        onTimerUpdate={handleTimerUpdate}
      />

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          onClick={() => setShowEventDialog(true)}
          disabled={!currentPeriod}
          className="flex items-center gap-2"
        >
          <Target className="h-4 w-4" />
          Record Event
        </Button>
        
        <Button
          onClick={() => setShowRetrospectiveDialog(true)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <History className="h-4 w-4" />
          Log Past Data
        </Button>

        <Button
          onClick={() => navigate(`/match-report/${fixtureId}`)}
          variant="outline"
        >
          View Report
        </Button>
      </div>

      {/* Events List */}
      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Match Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <Badge>{event.total_match_minute}'</Badge>
                    <span className="font-medium">
                      {event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
                    </span>
                    {event.is_penalty && <Badge variant="secondary">Penalty</Badge>}
                    {!event.is_our_team && <Badge variant="outline">Opposition</Badge>}
                  </div>
                  <div>
                    {event.players && (
                      <span>
                        {event.players.first_name} {event.players.last_name}
                        {event.assist_players && (
                          <span className="text-muted-foreground">
                            {' '}(assist: {event.assist_players.first_name} {event.assist_players.last_name})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Dialog */}
      <EnhancedEventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        fixtureId={fixtureId!}
        currentPeriod={currentPeriod}
        currentMinute={currentMinute}
        totalMatchMinute={totalMatchMinute}
        players={players}
        onEventRecorded={loadEvents}
      />

      {/* Retrospective Dialog */}
      <RetrospectiveMatchDialog
        open={showRetrospectiveDialog}
        onOpenChange={setShowRetrospectiveDialog}
        fixtureId={fixtureId!}
        players={players}
        onComplete={loadMatchData}
      />
    </div>
  );
}