import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Trophy, Target, Clock, Users, Calendar, MapPin, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveWrapper } from '@/components/ui/responsive-wrapper';
import { EditMatchDialog } from '@/components/match/EditMatchDialog';

interface MatchEvent {
  id: string;
  event_type: string;
  total_match_minute: number;
  period_id: string;
  is_our_team: boolean;
  is_penalty?: boolean;
  player_id?: string;
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
}

interface MatchPeriod {
  id: string;
  period_number: number;
  planned_duration_minutes: number;
  actual_start_time?: string;
  actual_end_time?: string;
  is_active: boolean;
}

interface PlayerTime {
  player_id: string;
  time_on?: number;
  time_off?: number;
  total_minutes: number;
  is_starter: boolean;
  half: string;
  players: {
    first_name: string;
    last_name: string;
    jersey_number?: number;
  };
}

interface FixtureDetails {
  id: string;
  scheduled_date: string;
  opponent_name: string;
  location: string;
  competition_type: string;
  competition_name?: string;
  fixture_type: string;
  half_length: number;
  status: string;
  active_tracker_id?: string;
  teams: {
    name: string;
  };
}

export default function MatchReport() {
  const { fixtureId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [fixture, setFixture] = useState<FixtureDetails | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [playerTimes, setPlayerTimes] = useState<PlayerTime[]>([]);
  const [rawPlayerTimes, setRawPlayerTimes] = useState<any[]>([]); // Raw data for editing
  const [periods, setPeriods] = useState<MatchPeriod[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    if (fixtureId) {
      fetchMatchReport();
    }
  }, [fixtureId]);

  const fetchMatchReport = async () => {
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
          competition_type,
          competition_name,
          fixture_type,
          half_length,
          status,
          active_tracker_id,
          team_id,
          teams!fk_fixtures_team_id (name)
        `)
        .eq('id', fixtureId)
        .maybeSingle();

      if (fixtureError) {
        console.error('Error fetching fixture:', fixtureError);
        throw fixtureError;
      }
      
      if (!fixtureData) {
        console.error('No fixture found with id:', fixtureId);
        setFixture(null);
        setLoading(false);
        return;
      }
      
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
          match_periods!fk_match_events_period_id (
            period_number
          )
        `)
        .eq('fixture_id', fixtureId)
        .order('total_match_minute', { ascending: true });

      if (eventsError) throw eventsError;
      setEvents((eventsData || []) as unknown as MatchEvent[]);

      // Fetch match periods for grouping
      const { data: periodsData, error: periodsError } = await supabase
        .from('match_periods')
        .select('id, period_number, planned_duration_minutes, actual_start_time, actual_end_time, is_active')
        .eq('fixture_id', fixtureId)
        .order('period_number', { ascending: true });

      if (periodsError) throw periodsError;
      setPeriods((periodsData || []) as unknown as MatchPeriod[]);

      // Fetch player times and calculate totals correctly
      const { data: playerTimesData, error: playerTimesError } = await supabase
        .from('player_time_logs')
        .select(`
          id,
          player_id,
          time_on_minute,
          time_off_minute,
          total_period_minutes,
          is_starter,
          period_id,
          players!fk_player_time_logs_player_id (
            first_name,
            last_name,
            jersey_number
          ),
          match_periods!fk_player_time_logs_period_id (
            period_number,
            planned_duration_minutes
          )
        `)
        .eq('fixture_id', fixtureId)
        .order('is_starter', { ascending: false });

      if (playerTimesError) throw playerTimesError;
      
      // Store raw data for editing
      setRawPlayerTimes(playerTimesData || []);
      
      // Group player times by player_id and calculate actual totals
      const playerTimeMap = new Map<string, PlayerTime>();
      
      (playerTimesData || []).forEach((pt) => {
        const playerId = pt.player_id;
        if (!playerTimeMap.has(playerId)) {
          playerTimeMap.set(playerId, {
            player_id: playerId,
            time_on: pt.time_on_minute,
            time_off: pt.time_off_minute,
            total_minutes: 0,
            is_starter: pt.is_starter,
            half: 'first', // Legacy support
            players: pt.players
          });
        }
        
        // Accumulate total minutes across all entries for this player
        const existingPlayer = playerTimeMap.get(playerId)!;
        existingPlayer.total_minutes += pt.total_period_minutes || 0;
      });
      
      setPlayerTimes(Array.from(playerTimeMap.values()).sort((a, b) => {
        if (a.is_starter !== b.is_starter) return a.is_starter ? -1 : 1;
        return b.total_minutes - a.total_minutes;
      }));

      // Fetch players for the team (needed for editing)
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
      console.error('Error fetching match report:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      toast({
        title: "Error",
        description: error?.message || "Failed to load match report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getScore = () => {
    const ourGoals = events.filter(e => e.event_type === 'goal' && e.is_our_team).length;
    const opponentGoals = events.filter(e => e.event_type === 'goal' && !e.is_our_team).length;
    return { ourGoals, opponentGoals };
  };

  const getMatchResult = (ourScore: number, opponentScore: number) => {
    if (ourScore > opponentScore) return { result: 'W', color: 'bg-green-500', text: 'Win' };
    if (ourScore < opponentScore) return { result: 'L', color: 'bg-red-500', text: 'Loss' };
    return { result: 'D', color: 'bg-yellow-500', text: 'Draw' };
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getPlayerName = (player: any) => {
    const name = `${player.first_name} ${player.last_name}`;
    const number = player.jersey_number ? `#${player.jersey_number} ` : '';
    return `${number}${name}`;
  };

  const getEventsByPeriod = () => {
    const byId: Record<string, MatchEvent[]> = {};
    events.forEach(e => {
      const pid = e.period_id || 'unassigned';
      if (!byId[pid]) byId[pid] = [];
      byId[pid].push(e);
    });
    // Sort events per period by minute ascending
    Object.keys(byId).forEach(pid => {
      byId[pid].sort((a, b) => a.total_match_minute - b.total_match_minute);
    });
    return byId;
  };

  const getBackNavigation = () => {
    // If coming from live tracking, go back to tracking
    if (location.state?.from === 'match-tracker' && fixture?.active_tracker_id) {
      return () => navigate(`/match-tracker/${fixtureId}`);
    }
    // Otherwise go to reports
    return () => navigate('/reports');
  };

  const getBackLabel = () => {
    if (location.state?.from === 'match-tracker' && fixture?.active_tracker_id) {
      return 'Back to Live Tracking';
    }
    return 'Back to Reports';
  };

  const isLiveMatch = fixture?.status !== 'completed' && fixture?.active_tracker_id;

  const reopenMatch = async () => {
    if (!fixtureId) return;
    try {
      // Update fixture back to in_progress; do not alter completed periods
      const { error } = await supabase
        .from('fixtures')
        .update({
          status: 'in_progress' as any,
          match_status: 'in_progress',
          current_period_id: null,
          // Note: do not force active_tracker_id here; user can claim control
          tracking_started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', fixtureId);

      if (error) throw error;

      // Navigate to tracker to resume
      toast({ title: 'Match reopened', description: 'You can now resume tracking.' });
      navigate(`/match-day/${fixtureId}`);
    } catch (error: any) {
      console.error('Error reopening match:', error);
      toast({ title: 'Error', description: error?.message || 'Failed to reopen match', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <ResponsiveWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading match report...</div>
        </div>
      </ResponsiveWrapper>
    );
  }

  if (!fixture) {
    return (
      <ResponsiveWrapper>
        <div className="text-center py-8">
          <h2 className="text-xl font-semibold mb-2">Match not found</h2>
          <Button onClick={getBackNavigation()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {getBackLabel()}
          </Button>
        </div>
      </ResponsiveWrapper>
    );
  }

  const { ourGoals, opponentGoals } = getScore();
  const { result, color, text } = getMatchResult(ourGoals, opponentGoals);

  return (
    <ResponsiveWrapper className="space-y-6 max-w-full">
      <div className="flex items-center space-x-4">
        <Button variant="outline" onClick={getBackNavigation()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {getBackLabel()}
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold">Match Report</h1>
            {isLiveMatch && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-full text-sm font-medium border border-red-200 dark:border-red-800">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                LIVE MATCH
              </div>
            )}
          </div>
          <p className="text-muted-foreground">
            {format(new Date(fixture.scheduled_date), 'EEEE, MMMM do, yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowEditDialog(true)}
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit Match Data
          </Button>
          {fixture.status === 'completed' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="secondary">
                  Reopen Match
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reopen this match?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will set the match back to in-progress so you can resume tracking. Existing periods and events will remain intact. You can start a new period to continue.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={reopenMatch}>Confirm Reopen</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Match Header */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="text-center">
              <h2 className="text-xl font-bold">{fixture.teams.name}</h2>
              <span className="text-2xl font-mono">{ourGoals}</span>
            </div>
            <div className="text-center">
              <Badge className={`${color} text-white text-lg px-4 py-2`}>
                {text}
              </Badge>
              <div className="mt-2 text-sm text-muted-foreground">
                Final Score: {ourGoals} - {opponentGoals}
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold">{fixture.opponent_name}</h2>
              <span className="text-2xl font-mono">{opponentGoals}</span>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(new Date(fixture.scheduled_date), 'dd/MM/yyyy HH:mm')}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{fixture.location || 'TBC'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span>{fixture.competition_name || fixture.competition_type}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Match Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Match Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No events recorded</p>
            ) : (
              <div className="space-y-4">
                {/* Period Sections */}
                {(() => {
                  const byPeriod = getEventsByPeriod();
                  const orderedPeriods = [...periods];
                  // If there are unassigned events, show them first
                  const unassigned = byPeriod['unassigned'] || [];
                  return (
                    <div className="space-y-4">
                      {unassigned.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Unassigned Period</h4>
                          <div className="space-y-2">
                            {unassigned.map((event) => (
                              <div key={event.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                    {event.total_match_minute}'
                                  </span>
                                  <Target className="h-3 w-3" />
                                  <span className={event.is_our_team ? 'text-green-600' : 'text-red-600'}>
                                    {event.event_type === 'goal' ? 'Goal' : 'Assist'}
                                    {event.is_penalty ? ' (Penalty)' : ''}
                                  </span>
                                </div>
                                <div className="text-right">
                                  {event.players && event.is_our_team ? (
                                    <span className="font-medium">
                                      {getPlayerName(event.players)}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      {event.is_our_team ? 'Unknown Player' : 'Opposition'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {orderedPeriods.map((p) => {
                        const list = byPeriod[p.id] || [];
                        if (list.length === 0) return null;
                        return (
                          <div key={p.id}>
                            <h4 className="font-medium text-sm mb-2">Period P{p.period_number}</h4>
                            <div className="space-y-2">
                              {list.map((event) => (
                                <div key={event.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                      {event.total_match_minute}'
                                    </span>
                                    <Target className="h-3 w-3" />
                                    <span className={event.is_our_team ? 'text-green-600' : 'text-red-600'}>
                                      {event.event_type === 'goal' ? 'Goal' : 'Assist'}
                                      {event.is_penalty ? ' (Penalty)' : ''}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    {event.players && event.is_our_team ? (
                                      <span className="font-medium">
                                        {getPlayerName(event.players)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        {event.is_our_team ? 'Unknown Player' : 'Opposition'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Playing Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Playing Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              {playerTimes.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No player time data available</p>
              ) : (
                <div className="space-y-3">
                  {playerTimes.map((playerTime) => (
                    <div key={playerTime.player_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {playerTime.players.jersey_number && (
                          <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono">
                            {playerTime.players.jersey_number}
                          </Badge>
                        )}
                        <div>
                          <div className="font-medium">
                            {playerTime.players.first_name} {playerTime.players.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {playerTime.is_starter ? 'Starter' : 'Substitute'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{playerTime.total_minutes} min</div>
                        {playerTime.time_on !== null && (
                          <div className="text-xs text-muted-foreground">
                            {playerTime.time_on !== null && `On: ${playerTime.time_on}'`}
                            {playerTime.time_off !== null && ` • Off: ${playerTime.time_off}'`}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Match Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{ourGoals}</div>
              <div className="text-sm text-muted-foreground">Our Goals</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{opponentGoals}</div>
              <div className="text-sm text-muted-foreground">Opposition Goals</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {events.filter(e => e.is_our_team && e.event_type === 'assist').length}
              </div>
              <div className="text-sm text-muted-foreground">Our Assists</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{playerTimes.filter(p => p.is_starter).length}</div>
              <div className="text-sm text-muted-foreground">Starting Players</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Match Data Dialog */}
      <EditMatchDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        fixtureId={fixtureId!}
        events={events as any}
        playerTimes={rawPlayerTimes}
        periods={periods}
        players={players}
        onUpdate={fetchMatchReport}
      />
    </ResponsiveWrapper>
  );
}