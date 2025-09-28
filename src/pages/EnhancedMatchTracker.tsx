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
  // Local log of substitutions for UI only (not persisted as match_events)
  const [substitutions, setSubstitutions] = useState<{ outId: string; inId: string; minute: number; total: number }[]>([]);
  
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

  // Ensure player status exists and keep it in sync with selected squad
  const ensurePlayerStatuses = async (fixtureData: any, squadPlayers: Player[]) => {
    try {
      const { data: statusRows, error } = await supabase
        .from('player_match_status')
        .select('id, player_id, is_on_field')
        .eq('fixture_id', fixtureId);

      if (error) throw error;

      const sd = (fixtureData?.selected_squad_data as any) || {};

      // Resolve starters from multiple possible shapes
      let starters: string[] = [];
      if (Array.isArray(sd.startingPlayerIds) && sd.startingPlayerIds.length) {
        starters = sd.startingPlayerIds;
      } else if (Array.isArray(sd.startingLineup) && sd.startingLineup.length) {
        starters = sd.startingLineup.map((p: any) => p.id || p);
      } else if (Array.isArray(sd.starting_players) && sd.starting_players.length) {
        starters = sd.starting_players.map((p: any) => p.id || p);
      } else if (Array.isArray(sd.starters) && sd.starters.length) {
        starters = sd.starters.map((p: any) => p.id || p);
      }

      const desiredActiveSet = new Set(starters);
      const squadIds = new Set(squadPlayers.map(p => p.id));

      if (!statusRows || statusRows.length === 0) {
        // Initialize statuses based on selected squad (starters on field)
        console.log('[MatchTracker] Initializing player statuses', {
          totalSquadPlayers: squadPlayers.length,
          startersFound: starters.length,
          squadData: sd
        });

        const rows = squadPlayers.map((p) => ({
          fixture_id: fixtureId!,
          player_id: p.id,
          is_on_field: desiredActiveSet.has(p.id),
        }));
        
        const { error: insertErr } = await supabase.from('player_match_status').insert(rows);
        if (insertErr) throw insertErr;
      } else {
        // Heal/Sync: ensure statuses match the selected squad and starters
        const existingById = new Map(statusRows.map((r: any) => [r.player_id, r]));
        const missingIds = [...squadIds].filter(id => !existingById.has(id));

        if (missingIds.length > 0) {
          const { error: insertMissingErr } = await supabase.from('player_match_status').insert(
            missingIds.map(id => ({
              fixture_id: fixtureId!,
              player_id: id,
              is_on_field: desiredActiveSet.has(id),
            }))
          );
          if (insertMissingErr) throw insertMissingErr;
        }

        // Reconcile active/inactive flags to reflect starters
        if (desiredActiveSet.size > 0) {
          const { error: setActivesErr } = await supabase
            .from('player_match_status')
            .update({ is_on_field: true })
            .eq('fixture_id', fixtureId)
            .in('player_id', Array.from(desiredActiveSet));
          if (setActivesErr) throw setActivesErr;

          const others = [...squadIds].filter(id => !desiredActiveSet.has(id));
          if (others.length > 0) {
            const { error: setSubsErr } = await supabase
              .from('player_match_status')
              .update({ is_on_field: false })
              .eq('fixture_id', fixtureId)
              .in('player_id', others);
            if (setSubsErr) throw setSubsErr;
          }
        }
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
        activePlayerIds: activeIds,
        allPlayerIds: allIds
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
    
    // Update player times when timer updates - but only for players actually on field
    if (periodNumber > 0) {
      try {
        const { data: currentPeriod } = await supabase
          .from('match_periods')
          .select('id')
          .eq('fixture_id', fixtureId)
          .eq('period_number', periodNumber)
          .single();

        if (currentPeriod) {
          // Get players who are actually on field RIGHT NOW from the database
          const { data: onFieldPlayers } = await supabase
            .from('player_match_status')
            .select('player_id')
            .eq('fixture_id', fixtureId)
            .eq('is_on_field', true);

          if (onFieldPlayers && onFieldPlayers.length > 0) {
            // Update time logs only for players currently on field
            for (const playerStatus of onFieldPlayers) {
              await supabase
                .from('player_time_logs')
                .upsert({
                  fixture_id: fixtureId,
                  player_id: playerStatus.player_id,
                  period_id: currentPeriod.id,
                  total_period_minutes: minute,
                  is_active: true,
                }, {
                  onConflict: 'fixture_id,player_id,period_id'
                });
            }
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

      {/* Enhanced Timer Controls - moved above action buttons for prominence */}
      <EnhancedMatchControls
        fixtureId={fixtureId!}
        onTimerUpdate={handleTimerUpdate}
        forceRefresh={matchTracker?.isActiveTracker}
      />

      {/* Action Buttons - placed beneath timer controls */}
      <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3">
        <Button
          onClick={() => setShowEventDialog(true)}
          className="flex items-center justify-center gap-2 w-full min-h-[44px]"
          disabled={!matchTracker?.isActiveTracker && (fixture?.status === 'in_progress' || fixture?.status === 'live')}
        >
          <Target className="h-4 w-4" />
          Record Event
        </Button>
        
        <Button
          onClick={() => setShowRetrospectiveDialog(true)}
          variant="outline"
          className="flex items-center justify-center gap-2 w-full min-h-[44px]"
          disabled={!matchTracker?.isActiveTracker && (fixture?.status === 'in_progress' || fixture?.status === 'live')}
        >
          <History className="h-4 w-4" />
          Record Event Manually
        </Button>

        <Button
          onClick={async () => {
            // Ensure player statuses are current before opening dialog
            await refreshPlayerStatusLists();
            setSubDialogOpen(true);
          }}
          variant="secondary"
          className="flex items-center justify-center gap-2 w-full min-h-[44px]"
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
          className="flex items-center justify-center gap-2 w-full min-h-[44px]"
        >
          View Report
        </Button>
      </div>

      {/* Match Management Buttons - Centered */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-3 justify-center">
        <Button
          onClick={() => setShowRestartConfirm(true)}
          variant="destructive"
          className="flex items-center justify-center gap-2 min-h-[44px]"
          disabled={!matchTracker?.isActiveTracker}
        >
          <RotateCcw className="h-4 w-4" />
          Restart Match
        </Button>
      </div>

      {/* Recent Substitutions (UI only) */}
      {substitutions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Recent Substitutions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5">
              {substitutions.slice(-5).map((sub, idx) => (
                <div key={`${idx}-${sub.outId}-${sub.inId}-${sub.minute}`} className="flex items-center justify-between p-3 border rounded-lg bg-card/50">
                  <div className="text-sm">
                    <span className="font-mono font-bold text-xs bg-muted px-2 py-1 rounded mr-2">{sub.total}'</span>
                    <span className="font-medium">
                      {(players.find(p => p.id === sub.outId)?.first_name || 'Unknown')} {(players.find(p => p.id === sub.outId)?.last_name || '')}
                      {' '}→{' '}
                      {(players.find(p => p.id === sub.inId)?.first_name || 'Unknown')} {(players.find(p => p.id === sub.inId)?.last_name || '')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Events grouped by period (aligns with flexible periods) */}
      {events.filter(e => e.event_type !== 'substitution').length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Match Events</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {periods.map((p) => {
              const periodEvents = events.filter(
                (e) => e.event_type !== 'substitution' && e.period_id === p.id
              );
              if (periodEvents.length === 0) return null;
              return (
                <div key={p.id} className="space-y-1.5">
                  <div className="text-sm font-medium text-muted-foreground">Period {p.period_number}</div>
                  {periodEvents.map((event) => (
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
              );
            })}
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

            // Get current period for event recording with fallbacks
            let currentPeriod = null;
            
            // Try to get active period first
            const { data: activePeriod } = await supabase
              .from('match_periods')
              .select('*')
              .eq('fixture_id', fixtureId)
              .eq('is_active', true)
              .single();
            
            if (activePeriod) {
              currentPeriod = activePeriod;
            } else {
              // Fallback 1: Use current_period_id from fixture
              const { data: fixtureData } = await supabase
                .from('fixtures')
                .select('current_period_id')
                .eq('id', fixtureId)
                .single();
              
              if (fixtureData?.current_period_id) {
                const { data: periodById } = await supabase
                  .from('match_periods')
                  .select('*')
                  .eq('id', fixtureData.current_period_id)
                  .single();
                currentPeriod = periodById;
              } else {
                // Fallback 2: Use the most recent period
                const { data: latestPeriod } = await supabase
                  .from('match_periods')
                  .select('*')
                  .eq('fixture_id', fixtureId)
                  .order('period_number', { ascending: false })
                  .limit(1)
                  .single();
                currentPeriod = latestPeriod;
              }
            }
            
            console.log('Current period for substitution:', currentPeriod);

            // Update player statuses and handle time logs
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

            // Handle player time logs for substitution
            if (currentPeriod) {
              // Finalize time log for player going OUT
              await supabase
                .from('player_time_logs')
                .upsert({
                  fixture_id: fixtureId,
                  player_id: playerOut,
                  period_id: currentPeriod.id,
                  time_off_minute: currentMinute,
                  total_period_minutes: currentMinute,
                  is_active: false,
                }, {
                  onConflict: 'fixture_id,player_id,period_id'
                });

              // Create/initialize time log for player coming IN
              await supabase
                .from('player_time_logs')
                .upsert({
                  fixture_id: fixtureId,
                  player_id: playerIn,
                  period_id: currentPeriod.id,
                  time_on_minute: currentMinute,
                  total_period_minutes: 0, // Will be updated by timer
                  is_starter: false,
                  is_active: true,
                }, {
                  onConflict: 'fixture_id,player_id,period_id'
                });
            }

            // Note substitution in UI only (events restricted to goals/assists)
            const outPlayer = players.find(p => p.id === playerOut);
            const inPlayer = players.find(p => p.id === playerIn);
            setSubstitutions(prev => [...prev, { outId: playerOut, inId: playerIn, minute: currentMinute, total: totalMatchMinute }]);
            console.log('Substitution noted (UI only):', { out: outPlayer, in: inPlayer, minute: currentMinute, total: totalMatchMinute });

            toast.success('Substitution made and recorded');
            setSubDialogOpen(false);
            setPlayerOut('');
            setPlayerIn('');
            await refreshPlayerStatusLists();
            await loadEvents(); // Refresh events list to show the substitution
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