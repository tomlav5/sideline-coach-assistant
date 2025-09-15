import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { EnhancedMatchControls } from '@/components/match/EnhancedMatchControls';
import { EnhancedEventDialog } from '@/components/match/EnhancedEventDialog';
import { RetrospectiveMatchDialog } from '@/components/fixtures/RetrospectiveMatchDialog';
import { SubstitutionDialog } from '@/components/match/SubstitutionDialog';
import { MatchLockingBanner } from '@/components/match/MatchLockingBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Clock, Users, Target, History, ArrowUpDown, RotateCcw } from 'lucide-react';
import { useRealtimeMatchSync } from '@/hooks/useRealtimeMatchSync';

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
  players?: Player & { id: string };
  assist_players?: Player & { id: string };
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
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [totalMatchMinute, setTotalMatchMinute] = useState(0);
  const [currentPeriodNumber, setCurrentPeriodNumber] = useState(0);
  const [loading, setLoading] = useState(true);

  // Substitution state
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [playerOut, setPlayerOut] = useState('');
  const [playerIn, setPlayerIn] = useState('');
  const [activePlayersList, setActivePlayersList] = useState<Player[]>([]);
  const [substitutePlayersList, setSubstitutePlayersList] = useState<Player[]>([]);
  
  // Real-time sync and match locking
  const { 
    matchTracker, 
    claimMatchTracking, 
    releaseMatchTracking, 
    isClaimingMatch 
  } = useRealtimeMatchSync(fixtureId);
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
          teams!fk_fixtures_team_id(*)
        `)
        .eq('id', fixtureId)
        .single();

      if (fixtureError) throw fixtureError;

      setFixture(fixtureData);

      // Extract players from selected squad or all team players (support multiple schema versions)
      let squadPlayers: Player[] = [];
      let starterIds: string[] = [];
      if (fixtureData.selected_squad_data) {
        const sd = fixtureData.selected_squad_data as any;

        const startingObjs = sd.starting_players || sd.startingLineup || sd.selectedPlayers || [];
        const substituteObjs = sd.substitute_players || sd.substitutes || [];
        const combinedObjs = [...(startingObjs || []), ...(substituteObjs || [])];

        const selectedIds: string[] = sd.selectedPlayerIds || [];
        const startingIdsFromObjs: string[] = (Array.isArray(sd.starting_players) ? sd.starting_players.map((p: any) => p.id) : [])
          .concat(Array.isArray(sd.startingLineup) ? sd.startingLineup.map((p: any) => p.id) : []);
        starterIds = sd.startingPlayerIds || startingIdsFromObjs;

        if (combinedObjs.length > 0) {
          // Players provided as objects
          squadPlayers = combinedObjs;
        } else if (selectedIds.length > 0) {
          // Players provided as ids only – fetch from players table
          const { data: playersByIds } = await supabase
            .from('players')
            .select('*')
            .in('id', selectedIds);
          squadPlayers = (playersByIds as Player[]) || [];
        }
      }

      if (squadPlayers.length === 0) {
        // Fallback: load all team players if no squad selected
        const { data: teamPlayersData } = await supabase
          .from('team_players')
          .select(`
            players (*)
          `)
          .eq('team_id', fixtureData.team_id);
        squadPlayers = teamPlayersData?.map((tp: any) => tp.players).filter(Boolean) || [];
      }

      // Remove duplicates by id
      const deduped = Array.from(new Map(squadPlayers.map(p => [p.id, p])).values());
      setPlayers(deduped);
      // Store starters in localStorage for debugging/consistency across tabs (optional)
      if (starterIds.length > 0) {
        try { localStorage.setItem(`fixture:${fixtureId}:starterIds`, JSON.stringify(starterIds)); } catch {}
      }

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
          players!fk_match_events_player_id(id, first_name, last_name, jersey_number),
          assist_players:players!fk_match_events_assist_player_id(id, first_name, last_name, jersey_number)
        `)
        .eq('fixture_id', fixtureId)
        .order('total_match_minute');

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  // Ensure player status exists and refresh active/sub lists
  const ensurePlayerStatuses = async (fixtureData: any, squadPlayers: Player[]) => {
    try {
      const { data: statusRows, error } = await supabase
        .from('player_match_status')
        .select('id')
        .eq('fixture_id', fixtureId);

      if (error) throw error;

      if (!statusRows || statusRows.length === 0) {
        // Initialize statuses based on selected squad (starters on field)
        const sd = (fixtureData.selected_squad_data as any) || {};
        
        // Try different possible field names for starters
        let starters: string[] = [];
        if (sd.startingPlayerIds && Array.isArray(sd.startingPlayerIds)) {
          starters = sd.startingPlayerIds;
        } else if (sd.startingLineup && Array.isArray(sd.startingLineup)) {
          starters = sd.startingLineup.map((p: any) => p.id || p);
        } else if (sd.starting_players && Array.isArray(sd.starting_players)) {
          starters = sd.starting_players.map((p: any) => p.id || p);
        }

        console.log('[MatchTracker] Initializing player statuses', {
          totalSquadPlayers: squadPlayers.length,
          startersFound: starters.length,
          squadData: sd
        });
        
        const rows = squadPlayers.map((p) => ({
          fixture_id: fixtureId!,
          player_id: p.id,
          is_on_field: starters.includes(p.id),
        }));
        
        const { error: insertErr } = await supabase.from('player_match_status').insert(rows);
        if (insertErr) throw insertErr;
      }

      await refreshPlayerStatusLists();
    } catch (e) {
      console.error('Error ensuring player statuses:', e);
      toast.error('Failed to prepare player statuses');
    }
  };

  const refreshPlayerStatusLists = async () => {
    try {
      const { data, error } = await supabase
        .from('player_match_status')
        .select('player_id, is_on_field')
        .eq('fixture_id', fixtureId);

      if (error) throw error;

      const rows = data || [];
      const allIds = rows.map((r: any) => r.player_id);
      const activeIds = rows.filter((r: any) => r.is_on_field).map((r: any) => r.player_id);

      // Use the squad players already loaded for this fixture
      const allFromState = players.filter(p => allIds.includes(p.id));
      const activesFromState = players.filter(p => activeIds.includes(p.id));
      const subsFromState = allFromState.filter(p => !activeIds.includes(p.id));

      console.log('[MatchTracker] refreshPlayerStatusLists', {
        totalPlayers: players.length,
        statusRows: rows.length,
        activeCount: activesFromState.length,
        subsCount: subsFromState.length,
      });

      setActivePlayersList(activesFromState);
      setSubstitutePlayersList(subsFromState);
    } catch (e) {
      console.error('Error loading player statuses:', e);
      // Fallback: no actives, all available are subs
      setActivePlayersList([]);
      setSubstitutePlayersList(players);
    }
  };

  const handleTimerUpdate = async (minute: number, totalMinute: number, periodNumber: number) => {
    setCurrentMinute(minute);
    setTotalMatchMinute(totalMinute);
    setCurrentPeriodNumber(periodNumber);
    
    // Update player times when timer updates - ensure sync
    if (activePlayersList.length > 0 && periodNumber > 0) {
      try {
        const { data: currentPeriod } = await supabase
          .from('match_periods')
          .select('id')
          .eq('fixture_id', fixtureId)
          .eq('period_number', periodNumber)
          .single();

        if (currentPeriod) {
          // Update active player time logs to stay synchronized
          for (const player of activePlayersList) {
            await supabase
              .from('player_time_logs')
              .upsert({
                fixture_id: fixtureId,
                player_id: player.id,
                period_id: currentPeriod.id,
                total_period_minutes: minute,
                is_active: true,
              }, {
                onConflict: 'fixture_id,player_id,period_id'
              });
          }
        }
      } catch (error) {
        console.error('Error synchronizing player times:', error);
      }
    }
  };
  const currentPeriod = periods.find(p => p.is_active) || (periods.length > 0 ? periods[periods.length - 1] : null);

  // Keep player status lists fresh when periods change (e.g., after starting a new one)
  useEffect(() => {
    if (players.length > 0 && fixtureId) {
      ensurePlayerStatuses(fixture, players);
    }
  }, [players.length, fixture]);

  useEffect(() => {
    refreshPlayerStatusLists();
  }, [periods.length]);

  const handleRestartMatch = async () => {
    if (!fixtureId) return;
    
    setIsRestarting(true);
    try {
      const { error } = await supabase.rpc('restart_match', {
        fixture_id_param: fixtureId
      });
      
      if (error) throw error;
      
      toast('Match Restarted', {
        description: "All match data has been reset successfully.",
      });
      
      // Reload all data
      await loadMatchData();
      setShowRestartConfirm(false);
    } catch (error: any) {
      console.error('Error restarting match:', error);
      toast('Error', {
        description: error.message || "Failed to restart match. Please try again.",
      });
    } finally {
      setIsRestarting(false);
    }
  };

  // Refresh data when real-time updates are received
  useEffect(() => {
    if (matchTracker) {
      // Refresh data when match tracking status changes
      loadMatchData();
    }
  }, [matchTracker?.isActiveTracker]);

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
    <div className="container mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6 max-w-4xl">
      {/* Match Header - Centered and Mobile-Optimized */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="text-center space-y-4">
            {/* Team Names and Score */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
              <h1 className="text-lg sm:text-xl font-semibold truncate max-w-full">
                {fixture.teams?.name}
              </h1>
              <div className="text-sm text-muted-foreground">vs</div>
              <h1 className="text-lg sm:text-xl font-semibold truncate max-w-full">
                {fixture.opponent_name}
              </h1>
            </div>
            
            {/* Score Display - Prominent and Centered */}
            <div className="flex items-center justify-center">
              <Badge variant="outline" className="text-3xl sm:text-4xl font-bold px-4 py-2">
                {ourGoals} - {opponentGoals}
              </Badge>
            </div>
            
            {/* Match Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-2">
              <div className="flex items-center justify-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Total Time: {Math.floor(totalMatchMinute)} minutes</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{players.length} players available</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span>{events.length} events recorded</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Match Locking Banner */}
      <MatchLockingBanner
        matchTracker={matchTracker}
        onClaimTracking={claimMatchTracking}
        onReleaseTracking={releaseMatchTracking}
        isClaimingMatch={isClaimingMatch}
        matchStatus={fixture?.status || 'scheduled'}
      />

      {/* Enhanced Timer Controls */}
      <EnhancedMatchControls
        fixtureId={fixtureId!}
        onTimerUpdate={handleTimerUpdate}
      />

      {/* Action Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Button
          onClick={() => setShowEventDialog(true)}
          className="flex items-center gap-2 w-full"
          disabled={!matchTracker?.isActiveTracker && (fixture?.status === 'in_progress' || fixture?.status === 'live')}
        >
          <Target className="h-4 w-4" />
          Record Event
        </Button>
        
        <Button
          onClick={() => setShowRetrospectiveDialog(true)}
          variant="outline"
          className="flex items-center gap-2 w-full"
          disabled={!matchTracker?.isActiveTracker && (fixture?.status === 'in_progress' || fixture?.status === 'live')}
        >
          <History className="h-4 w-4" />
          Record Event Manually
        </Button>

        <Button
          onClick={() => setSubDialogOpen(true)}
          variant="secondary"
          className="flex items-center gap-2 w-full"
          disabled={!matchTracker?.isActiveTracker && (fixture?.status === 'in_progress' || fixture?.status === 'live')}
        >
          <ArrowUpDown className="h-4 w-4" />
          Substitution
        </Button>

        <Button
          onClick={() => navigate(`/match-report/${fixtureId}`, { 
            state: { from: 'match-tracker' } 
          })}
          variant="outline"
          className="w-full"
        >
          View Report
        </Button>
      </div>

      {/* Match Management Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <Button
          onClick={() => setShowRestartConfirm(true)}
          variant="destructive"
          className="flex items-center gap-2"
          disabled={!matchTracker?.isActiveTracker}
        >
          <RotateCcw className="h-4 w-4" />
          Restart Match
        </Button>
      </div>

      {/* Events List */}
      {events.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Match Events</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5">
              {events.map((event) => (
                <div key={event.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg bg-card/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="text-xs font-mono shrink-0">
                      {event.total_match_minute}'
                    </Badge>
                    <span className="text-sm font-medium truncate">
                      {event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
                    </span>
                    <div className="flex gap-1">
                      {event.is_penalty && <Badge variant="outline" className="text-xs">Penalty</Badge>}
                      {!event.is_our_team && <Badge variant="destructive" className="text-xs">Opposition</Badge>}
                    </div>
                  </div>
                  
                  {event.players && (
                    <div className="text-sm text-muted-foreground sm:ml-auto sm:text-right">
                      <span className="font-medium text-foreground">
                        {event.players.first_name} {event.players.last_name}
                      </span>
                      {event.assist_players && (
                        <div className="text-xs">
                          Assist: {event.assist_players.first_name} {event.assist_players.last_name}
                        </div>
                      )}
                    </div>
                  )}
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
        players={activePlayersList.length > 0 ? activePlayersList : players}
        onEventRecorded={async () => {
          await loadEvents();
          await refreshPlayerStatusLists();
        }}
      />

      {/* Substitution Dialog */}
      <SubstitutionDialog
        open={subDialogOpen}
        onOpenChange={setSubDialogOpen}
        playerOut={playerOut}
        playerIn={playerIn}
        onPlayersChange={(outId, inId) => {
          setPlayerOut(outId);
          setPlayerIn(inId);
        }}
        activePlayers={activePlayersList}
        substitutePlayers={substitutePlayersList}
        onConfirm={async () => {
          try {
            if (!playerOut || !playerIn) {
              toast.error('Select both players to make a substitution');
              return;
            }
            // Update statuses
            const { error: outErr } = await supabase
              .from('player_match_status')
              .update({ is_on_field: false })
              .eq('fixture_id', fixtureId)
              .eq('player_id', playerOut);
            if (outErr) throw outErr;

            const { error: inErr } = await supabase
              .from('player_match_status')
              .update({ is_on_field: true })
              .eq('fixture_id', fixtureId)
              .eq('player_id', playerIn);
            if (inErr) throw inErr;

            toast.success('Substitution made');
            setSubDialogOpen(false);
            setPlayerOut('');
            setPlayerIn('');
            await refreshPlayerStatusLists();
          } catch (e) {
            console.error('Error making substitution:', e);
            toast.error('Failed to make substitution');
          }
        }}
      />

      {/* Retrospective Dialog */}
      <RetrospectiveMatchDialog
        open={showRetrospectiveDialog}
        onOpenChange={setShowRetrospectiveDialog}
        fixtureId={fixtureId!}
        players={players}
        onComplete={loadMatchData}
      />

      {/* Restart Match Confirmation Dialog */}
      <AlertDialog open={showRestartConfirm} onOpenChange={setShowRestartConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-destructive" />
              Restart Match
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete all recorded match data including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All events (goals, cards, etc.)</li>
                <li>All substitutions and player times</li>
                <li>All match periods and timers</li>
                <li>Player field positions</li>
              </ul>
              <strong className="block mt-3 text-destructive">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestarting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestartMatch}
              disabled={isRestarting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRestarting ? 'Restarting...' : 'Yes, Restart Match'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}