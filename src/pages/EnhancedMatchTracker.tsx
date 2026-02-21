import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { EnhancedMatchControls } from '@/components/match/EnhancedMatchControls';
import { EnhancedEventDialog } from '@/components/match/EnhancedEventDialog';
import { RetrospectiveMatchDialog } from '@/components/fixtures/RetrospectiveMatchDialog';
import { SubstitutionDialog } from '@/components/match/SubstitutionDialog';
import { EditSquadDialog } from '@/components/match/EditSquadDialog';
import { MatchLockingBanner } from '@/components/match/MatchLockingBanner';
import { QuickGoalButton } from '@/components/match/QuickGoalButton';
import { FixedMatchHeader } from '@/components/match/FixedMatchHeader';
import { BottomActionBar } from '@/components/match/BottomActionBar';
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
import { Clock, Users, Target, History, ArrowUpDown, RotateCcw, Goal, UserPlus } from 'lucide-react';
import { useRealtimeMatchSync } from '@/hooks/useRealtimeMatchSync';
import { useWakeLock } from '@/hooks/useWakeLock';
import { usePlayerTimers } from '@/hooks/usePlayerTimers';
import { useEditMatchData } from '@/hooks/useEditMatchData';
import { generateUUID } from '@/lib/uuid';
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';
import { useSmartSuggestions } from '@/hooks/useSmartSuggestions';
import { useMatchTrackerShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ActivePlayerCard } from '@/components/match/ActivePlayerCard';
import { SmartSuggestionBadge } from '@/components/match/SmartSuggestionBadge';
import { MatchTrackerSkeleton } from '@/components/ui/skeleton-loader';

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
  sub_out_player_id?: string;
  sub_in_player_id?: string;
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
  const { isSupported: wakeLockSupported, requestWakeLock, releaseWakeLock } = useWakeLock();
  
  
  // Optimistic updates for instant feedback
  const optimisticUpdate = useOptimisticUpdate();
  
  const [fixture, setFixture] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<MatchPeriod[]>([]);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showRetrospectiveDialog, setShowRetrospectiveDialog] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [totalMatchMinute, setTotalMatchMinute] = useState(0);
  const [currentPeriodNumber, setCurrentPeriodNumber] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Smart suggestions based on match context (after state declarations)
  const smartSuggestions = useSmartSuggestions(players, events as any, currentPeriodNumber);

  // Substitution state
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [activePlayersList, setActivePlayersList] = useState<Player[]>([]);
  const [substitutePlayersList, setSubstitutePlayersList] = useState<Player[]>([]);
  
  // Edit squad state
  const [editSquadOpen, setEditSquadOpen] = useState(false);
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

  // Keep screen awake during match tracking
  useEffect(() => {
    // Only attempt if supported
    if (wakeLockSupported) {
      requestWakeLock();
    }
    return () => {
      if (wakeLockSupported) {
        releaseWakeLock();
      }
    };
  }, [wakeLockSupported, requestWakeLock, releaseWakeLock]);

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
      console.error('Failed to load match data');
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      // Phase 3: Enhanced query with proper FK joins for better performance
      // Now that database is stable, we can use the full joins
      const { data: eventsData, error: eventsQueryError } = await supabase
        .from('match_events')
        .select(`
          *,
          players!fk_match_events_player_id(id, first_name, last_name, jersey_number),
          assist_players:players!fk_match_events_assist_player_id(id, first_name, last_name, jersey_number)
        `)
        .eq('fixture_id', fixtureId)
        .order('total_match_minute');

      if (eventsQueryError) {
        console.error('Error loading events:', eventsQueryError);
        setEventsError(eventsQueryError.message || 'Failed to load events');
        setEvents([]);
        return;
      }
      
      setEvents(eventsData || []);
    } catch (error: any) {
      console.error('Error loading events:', error);
      setEventsError(error?.message || 'Failed to load events');
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  // Quick goal handler with optimistic updates and assist tracking
  const handleQuickGoal = async (playerId: string, isOurTeam: boolean = true, assistPlayerId?: string, isPenalty: boolean = false) => {
    try {
      // Get current period
      const { data: activePeriod } = await supabase
        .from('match_periods')
        .select('*')
        .eq('fixture_id', fixtureId)
        .eq('is_active', true)
        .maybeSingle();

      if (!activePeriod) {
        console.error('No active period - start a period first');
        return;
      }

      // Generate unique client event ID
      const clientEventId = generateUUID();
      
      // Auto-mark as penalty if in penalty shootout period
      const isPenaltyPeriod = (activePeriod as any).period_type === 'penalties';

      // Create goal event
      const { data: newEvent, error } = await supabase
        .from('match_events')
        .insert({
          fixture_id: fixtureId,
          period_id: activePeriod.id,
          event_type: 'goal',
          player_id: playerId || null, // Null for opponent goals
          assist_player_id: assistPlayerId || null,
          minute_in_period: currentMinute,
          total_match_minute: totalMatchMinute,
          is_our_team: isOurTeam,
          is_penalty: isPenaltyPeriod || isPenalty,
          is_retrospective: false,
          client_event_id: clientEventId,
        })
        .select('id, player_id')
        .single();

      if (error) throw error;

      // Reload events to update UI
      await loadEvents();
    } catch (error: any) {
      console.error('Error recording quick goal:', error);
      console.error('Failed to record goal:', error?.message);
      throw error;
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

      if (squadIds.size === 0) {
        console.warn('[MatchTracker] No squad players resolved; skipping status init');
        return;
      }

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
        
        const { error: insertErr } = await supabase
          .from('player_match_status')
          .upsert(rows, { onConflict: 'fixture_id,player_id' });
        if (insertErr) throw insertErr;
      } else {
        // Heal/Sync: ensure statuses match the selected squad and starters
        const existingById = new Map(statusRows.map((r: any) => [r.player_id, r]));
        const missingIds = [...squadIds].filter(id => !existingById.has(id));

        if (missingIds.length > 0) {
          const { error: insertMissingErr } = await supabase
            .from('player_match_status')
            .upsert(
              missingIds.map(id => ({
                fixture_id: fixtureId!,
                player_id: id,
                is_on_field: desiredActiveSet.has(id),
              })),
              { onConflict: 'fixture_id,player_id' }
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
        } else {
          // If no starters resolved, explicitly set everyone in squad to off-field to avoid phantom minutes
          const { error: setAllOffErr } = await supabase
            .from('player_match_status')
            .update({ is_on_field: false })
            .eq('fixture_id', fixtureId)
            .in('player_id', Array.from(squadIds));
          if (setAllOffErr) throw setAllOffErr;
        }
      }

      await refreshPlayerStatusLists();
    } catch (e: any) {
      console.error('Error ensuring player statuses:', e);
      const msg = e?.message || String(e);
      // Common RLS hint: missing club membership in DEV
      const hint = msg.includes('permission') || msg.includes('RLS') ? ' (check DEV club_members for your user)' : '';
      console.error(`Failed to prepare player statuses: ${msg}${hint}`);
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

    // Removed per-second DB writes to player_time_logs. We now only write on transitions:
    // - New period start initializes starters at time_on=0 in useEffect on period change
    // - Substitution on/off writes time_on_minute/time_off_minute
    // - Period end finalizes open intervals
  };
  const currentPeriod = periods.find(p => p.is_active) || (periods.length > 0 ? periods[periods.length - 1] : null);

  // Real-time player timers
  const isMatchRunning = fixture?.status === 'in_progress' && currentPeriod?.is_active;
  const { getPlayerTime, isPlayerActive, reloadTimes } = usePlayerTimers({
    fixtureId: fixtureId!,
    currentPeriodId: currentPeriod?.id || null,
    isTimerRunning: isMatchRunning || false,
  });

  // Ensure we initialize/close player_time_logs across period changes
  const [prevPeriodNumber, setPrevPeriodNumber] = useState<number>(0);

  useEffect(() => {
    // Detect period transition by number change
    if (currentPeriodNumber && currentPeriodNumber !== prevPeriodNumber) {
      const newPeriodNumber = currentPeriodNumber;
      const oldPeriodNumber = prevPeriodNumber;

      const runPeriodTransitions = async () => {
        try {
          // 1) Finalize previous period: close any active logs without an explicit time_off
          if (oldPeriodNumber > 0) {
            const { data: prevPeriod } = await supabase
              .from('match_periods')
              .select('*')
              .eq('fixture_id', fixtureId)
              .eq('period_number', oldPeriodNumber)
              .single();

            if (prevPeriod) {
              // Calculate actual period duration
              let actualDurationMinutes = prevPeriod.planned_duration_minutes;
              
              if (prevPeriod.actual_start_time && prevPeriod.actual_end_time) {
                const startTime = new Date(prevPeriod.actual_start_time).getTime();
                const endTime = new Date(prevPeriod.actual_end_time).getTime();
                const pausedSeconds = prevPeriod.total_paused_seconds || 0;
                const elapsedSeconds = Math.floor((endTime - startTime) / 1000) - pausedSeconds;
                actualDurationMinutes = Math.floor(elapsedSeconds / 60);
              }
              
              // Set time_off_minute to actual period duration for all active logs
              await supabase
                .from('player_time_logs')
                .update({
                  time_off_minute: actualDurationMinutes,
                  is_active: false,
                })
                .eq('fixture_id', fixtureId)
                .eq('period_id', prevPeriod.id)
                .eq('is_active', true);  // Only update active logs
            }
          }

          // 2) Initialize new period for currently on-field players with time_on = 0
          if (newPeriodNumber > 0) {
            const { data: nextPeriod } = await supabase
              .from('match_periods')
              .select('*')
              .eq('fixture_id', fixtureId)
              .eq('period_number', newPeriodNumber)
              .single();

            if (nextPeriod) {
              const { data: onFieldPlayers } = await supabase
                .from('player_match_status')
                .select('player_id')
                .eq('fixture_id', fixtureId)
                .eq('is_on_field', true);

              if (onFieldPlayers && onFieldPlayers.length > 0) {
                for (const row of onFieldPlayers) {
                  // Check if an active log already exists for this player in this period
                  const { data: existingLog } = await supabase
                    .from('player_time_logs')
                    .select('id, is_active')
                    .eq('fixture_id', fixtureId!)
                    .eq('player_id', row.player_id)
                    .eq('period_id', nextPeriod.id)
                    .eq('is_active', true)
                    .maybeSingle();
                  
                  // Only insert if no active log exists (allows multiple intervals per period)
                  if (!existingLog) {
                    await supabase
                      .from('player_time_logs')
                      .insert({
                        fixture_id: fixtureId!,
                        player_id: row.player_id,
                        period_id: nextPeriod.id,
                        time_on_minute: 0,
                        is_starter: true,
                        is_active: true,
                        total_period_minutes: 0,
                      });
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('Error handling period transitions:', e);
        } finally {
          setPrevPeriodNumber(newPeriodNumber);
        }
      };

      runPeriodTransitions();
    }
  }, [currentPeriodNumber, prevPeriodNumber, fixtureId]);

  // Keep player status lists fresh when periods change (e.g., after starting a new one)
  useEffect(() => {
    if (players.length > 0 && fixtureId) {
      ensurePlayerStatuses(fixture, players);
    }
  }, [players.length, fixture]);

  useEffect(() => {
    refreshPlayerStatusLists();
  }, [periods.length]);

  // Initialize starter logs when an active period exists and logs are missing (safety net)
  useEffect(() => {
    const initMissingStarterLogs = async () => {
      if (!fixtureId) return;
      try {
        // Find active period
        const { data: activeP } = await supabase
          .from('match_periods')
          .select('*')
          .eq('fixture_id', fixtureId)
          .eq('is_active', true)
          .single();
        if (!activeP) return;

        // On-field players now
        const { data: onField } = await supabase
          .from('player_match_status')
          .select('player_id')
          .eq('fixture_id', fixtureId)
          .eq('is_on_field', true);
        if (!onField || onField.length === 0) return;

        for (const row of onField) {
          const { data: existing } = await supabase
            .from('player_time_logs')
            .select('id')
            .eq('fixture_id', fixtureId)
            .eq('player_id', row.player_id)
            .eq('period_id', activeP.id)
            .maybeSingle();
          if (!existing) {
            await supabase
              .from('player_time_logs')
              .insert({
                fixture_id: fixtureId,
                player_id: row.player_id,
                period_id: activeP.id,
                time_on_minute: 0,
                is_starter: true,
                is_active: true,
              });
          }
        }
      } catch (e) {
        console.warn('Failed to init missing starter logs:', e);
      }
    };
    initMissingStarterLogs();
  }, [fixtureId, currentPeriod?.id]);

  const handleRestartMatch = async () => {
    if (!fixtureId) return;
    
    setIsRestarting(true);
    try {
      const { error } = await supabase.rpc('restart_match', {
        fixture_id_param: fixtureId
      });
      
      if (error) throw error;
      
      console.log('Match restarted successfully');
      
      // Reload all data
      await loadMatchData();
      setShowRestartConfirm(false);
    } catch (error: any) {
      console.error('Error restarting match:', error);
      console.error('Failed to restart match:', error.message);
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

  // Realtime: refresh events list when any event for this fixture changes
  useEffect(() => {
    if (!fixtureId) return;
    const channel = supabase
      .channel(`match-events-live-${fixtureId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_events', filter: `fixture_id=eq.${fixtureId}` },
        () => {
          loadEvents();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fixtureId]);

  const ourGoals = events.filter(e => e.event_type === 'goal' && e.is_our_team).length;
  const opponentGoals = events.filter(e => e.event_type === 'goal' && !e.is_our_team).length;

  // Keyboard shortcuts for quick actions
  useMatchTrackerShortcuts({
    onRecordGoal: () => {
      if (matchTracker?.isActiveTracker || fixture?.status !== 'in_progress') {
        setShowEventDialog(true);
      }
    },
    onSubstitution: async () => {
      if (matchTracker?.isActiveTracker || fixture?.status !== 'in_progress') {
        await refreshPlayerStatusLists();
        setSubDialogOpen(true);
      }
    },
    onOtherEvent: () => setShowEventDialog(true),
    onUndo: () => {}, // Undo functionality removed
  });

  if (loading) {
    return <MatchTrackerSkeleton />;
  }

  if (!fixture) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">Match not found</div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed Header with Score and Timer */}
      <FixedMatchHeader
        teamName={fixture.teams?.name || 'Team'}
        opponentName={fixture.opponent_name || 'Opponent'}
        ourScore={ourGoals}
        opponentScore={opponentGoals}
        currentTime={formatTime(currentMinute * 60)}
        totalTime={formatTime(totalMatchMinute * 60)}
        periodNumber={currentPeriodNumber}
        matchStatus={fixture.status || 'scheduled'}
      />

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="container mx-auto p-3 sm:p-4 space-y-4 max-w-4xl">

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

      {/* Quick Action Buttons - Large, Thumb-Friendly */}
      <div className="space-y-4">

        {/* Tertiary Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Button
            onClick={() => setEditSquadOpen(true)}
            variant="outline"
            size="sm"
            className="h-10"
            disabled={!matchTracker?.isActiveTracker && (fixture?.status === 'in_progress' || fixture?.status === 'live')}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Edit Squad
          </Button>
          
          <Button
            onClick={() => setShowRetrospectiveDialog(true)}
            variant="ghost"
            size="sm"
            className="h-10"
            disabled={!matchTracker?.isActiveTracker && (fixture?.status === 'in_progress' || fixture?.status === 'live')}
          >
            <History className="h-4 w-4 mr-2" />
            Manual Entry
          </Button>

          <Button
            onClick={() => navigate(`/match-report/${fixtureId}`, { 
              state: { from: 'match-tracker' } 
            })}
            variant="ghost"
            size="sm"
            className="h-10"
          >
            View Report
          </Button>
        </div>
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

      {/* Active Players with Real-Time Timers */}
      {activePlayersList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              Players On Field ({activePlayersList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activePlayersList.map((player) => (
                <ActivePlayerCard
                  key={player.id}
                  player={player}
                  playingMinutes={getPlayerTime(player.id)}
                  isActive={isPlayerActive(player.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Events grouped by period - ALWAYS SHOW for better UX */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Match Events ({events.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {eventsLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground animate-in fade-in">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3"></div>
              <p className="text-sm font-medium">Loading match events...</p>
            </div>
          )}
          
          {eventsError && !eventsLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-destructive">
              <p className="font-medium">Failed to load events</p>
              <p className="text-sm text-muted-foreground mt-1">{eventsError}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadEvents}
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          )}
          
          {!eventsLoading && !eventsError && events.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground animate-in fade-in zoom-in-95">
              <Goal className="h-16 w-16 mb-4 opacity-50" />
              <p className="font-semibold text-foreground mb-1">No events recorded yet</p>
              <p className="text-sm">Record your first goal, assist, or substitution using the buttons below!</p>
            </div>
          )}
          
          {!eventsLoading && !eventsError && events.length > 0 && periods.map((p) => {
            const periodEvents = events.filter((e) => e.period_id === p.id);
            if (periodEvents.length === 0) return null;
            return (
              <div key={p.id} className="space-y-1.5 animate-in fade-in">
                <div className="text-sm font-semibold text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-md">
                  Period {p.period_number}
                </div>
                {periodEvents.map((event, idx) => (
                  <div 
                    key={event.id} 
                    className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg bg-card/50 animate-in fade-in slide-in-from-bottom-2 duration-300"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="secondary" className="text-xs font-mono shrink-0">
                        {event.total_match_minute}'
                      </Badge>
                      {event.event_type === 'goal' ? (
                        <span className="text-sm font-medium truncate flex items-center gap-1">
                          <Goal className="h-4 w-4" />
                          Goal
                        </span>
                      ) : event.event_type === 'substitution' ? (
                        <span className="text-sm font-medium truncate flex items-center gap-1">
                          <span className="text-lg">🔄</span>
                          Substitution: {players.find(ply => ply.id === event.player_id)?.first_name || 'Unknown'} {players.find(ply => ply.id === event.player_id)?.last_name || ''}
                          {' '}→{' '}
                          {players.find(ply => ply.id === event.assist_player_id)?.first_name || 'Unknown'} {players.find(ply => ply.id === event.assist_player_id)?.last_name || ''}
                        </span>
                      ) : (
                        <span className="text-sm font-medium truncate">
                          {event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
                        </span>
                      )}
                      <div className="flex gap-1">
                        {event.is_penalty && <Badge variant="outline" className="text-xs">Penalty</Badge>}
                        {!event.is_our_team && <Badge variant="destructive" className="text-xs">Opposition</Badge>}
                      </div>
                    </div>
                    {event.event_type !== 'substitution' && event.players && (
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

      {/* Substitutions Timeline */}
      {events.some(e => e.event_type === 'substitution') && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Substitutions Timeline</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {events.filter(e => e.event_type === 'substitution').map((e) => (
                <div key={e.id} className="flex items-center gap-2 px-3 py-2 border rounded-full">
                  <Badge variant="secondary" className="font-mono text-xs">{e.total_match_minute}'</Badge>
                  <span className="text-sm">
                    {players.find(p => p.id === e.player_id)?.first_name || 'Unknown'} → {players.find(p => p.id === e.assist_player_id)?.first_name || 'Unknown'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Guard: ensure starter logs exist when a period is active */}
      {/* This is a no-op UI-wise; we leverage an effect below */}


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
        activePlayers={activePlayersList}
        substitutePlayers={substitutePlayersList}
        onConfirm={async (pairs) => {
          try {
            if (!pairs || pairs.length === 0) {
              console.error('No substitutions to make');
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
            
            console.log('Processing', pairs.length, 'substitution(s) for period:', currentPeriod);

            // Process each substitution pair
            for (const pair of pairs) {
              const { playerOut, playerIn } = pair;
              
              // Update player statuses
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
                // Ensure a row exists for the player going OUT
                const { data: outRow } = await supabase
                  .from('player_time_logs')
                  .select('player_id')
                  .eq('fixture_id', fixtureId)
                  .eq('player_id', playerOut)
                  .eq('period_id', currentPeriod.id)
                  .maybeSingle();

                if (!outRow) {
                  await supabase
                    .from('player_time_logs')
                    .insert({
                      fixture_id: fixtureId,
                      player_id: playerOut,
                      period_id: currentPeriod.id,
                      time_on_minute: 0,
                      is_starter: true,
                      is_active: true,
                    });
                }

                // Finalize time log for player going OUT
                await supabase
                  .from('player_time_logs')
                  .update({
                    time_off_minute: currentMinute,
                    is_active: false,
                  })
                  .eq('fixture_id', fixtureId)
                  .eq('player_id', playerOut)
                  .eq('period_id', currentPeriod.id)
                  .eq('is_active', true);

                // Create time log for player coming IN
                const { data: activeInLog } = await supabase
                  .from('player_time_logs')
                  .select('id, is_active')
                  .eq('fixture_id', fixtureId)
                  .eq('player_id', playerIn)
                  .eq('period_id', currentPeriod.id)
                  .eq('is_active', true)
                  .maybeSingle();

                if (!activeInLog) {
                  await supabase
                    .from('player_time_logs')
                    .insert({
                      fixture_id: fixtureId,
                      player_id: playerIn,
                      period_id: currentPeriod.id,
                      time_on_minute: currentMinute,
                      is_starter: false,
                      is_active: true,
                    });
                }

                // Persist substitution events (off and on)
                try {
                  // Record player going OFF
                  const offEventId = generateUUID();
                  const { error: offEventErr } = await supabase
                    .from('match_events')
                    .upsert({
                      fixture_id: fixtureId,
                      period_id: currentPeriod.id,
                      event_type: 'substitution_off',
                      player_id: playerOut,
                      minute_in_period: currentMinute,
                      total_match_minute: totalMatchMinute,
                      is_our_team: true,
                      notes: null,
                      is_retrospective: false,
                      client_event_id: offEventId,
                    }, { onConflict: 'client_event_id' });
                  if (offEventErr) throw offEventErr;

                  // Record player coming ON
                  const onEventId = generateUUID();
                  const { error: onEventErr } = await supabase
                    .from('match_events')
                    .upsert({
                      fixture_id: fixtureId,
                      period_id: currentPeriod.id,
                      event_type: 'substitution_on',
                      player_id: playerIn,
                      minute_in_period: currentMinute,
                      total_match_minute: totalMatchMinute,
                      is_our_team: true,
                      notes: null,
                      is_retrospective: false,
                      client_event_id: onEventId,
                    }, { onConflict: 'client_event_id' });
                  if (onEventErr) throw onEventErr;
                } catch (subEventCatch: any) {
                  console.error('Failed to record substitution events:', subEventCatch);
                }
              }

              // Add to UI substitutions log
              setSubstitutions(prev => [...prev, { outId: playerOut, inId: playerIn, minute: currentMinute, total: totalMatchMinute }]);
            }

            console.log('Completed', pairs.length, 'substitution(s)');
            setSubDialogOpen(false);
            await refreshPlayerStatusLists();
            await loadEvents();
            reloadTimes();
          } catch (e) {
            console.error('Error making substitutions:', e);
            console.error('Failed to make substitutions');
          }
        }}
      />

      {/* Edit Squad Dialog */}
      <EditSquadDialog
        open={editSquadOpen}
        onOpenChange={setEditSquadOpen}
        fixtureId={fixtureId!}
        teamId={fixture.team_id}
        currentSquadPlayerIds={players.map(p => p.id)}
        onSquadUpdated={async () => {
          // Reload match data to get updated player list
          await loadMatchData();
          await refreshPlayerStatusLists();
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
      </div>

      {/* Bottom Action Bar - Fixed */}
      <BottomActionBar
        onQuickGoal={() => setShowGoalDialog(true)}
        onSubstitution={async () => {
          await refreshPlayerStatusLists();
          setSubDialogOpen(true);
        }}
        onOtherEvent={() => setShowEventDialog(true)}
        disabled={!matchTracker?.isActiveTracker && (fixture?.status === 'in_progress' || fixture?.status === 'live')}
      />

      {/* Goal Dialog */}
      <QuickGoalButton
        players={activePlayersList.length > 0 ? activePlayersList : players}
        onGoalScored={handleQuickGoal}
        open={showGoalDialog}
        onOpenChange={setShowGoalDialog}
      />
    </div>
  );
}