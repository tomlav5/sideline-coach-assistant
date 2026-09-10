import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { EnhancedMatchControls } from '@/components/match/EnhancedMatchControls';
import { EnhancedEventDialog } from '@/components/match/EnhancedEventDialog';
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
import { Trash2, Goal, UserPlus } from 'lucide-react';
import { useRealtimeMatchSync } from '@/hooks/useRealtimeMatchSync';
import { useWakeLock } from '@/hooks/useWakeLock';
import { usePlayerTimers } from '@/hooks/usePlayerTimers';
import { useEditMatchData } from '@/hooks/useEditMatchData';
import { generateUUID } from '@/lib/uuid';
import { calculateScore } from '@/lib/matchScore';
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';
import { useSmartSuggestions } from '@/hooks/useSmartSuggestions';
import { useMatchTrackerShortcuts } from '@/hooks/useKeyboardShortcuts';
import { PlayerTileGrid } from '@/components/match/PlayerTileGrid';
import { SmartSuggestionBadge } from '@/components/match/SmartSuggestionBadge';
import { MatchTrackerSkeleton } from '@/components/ui/skeleton-loader';
import { LiveEventsSummary } from '@/components/match/LiveEventsSummary';
import { UndoButton } from '@/components/match/UndoButton';
import { useUndoStack } from '@/hooks/useUndoStack';
import { usePendingSubs } from '@/hooks/usePendingSubs';
import { PendingSubsPanel } from '@/components/match/PendingSubsPanel';
import { submitSubstitutions } from '@/lib/submitSubstitutions';
import { decideMissingStarterLog } from '@/lib/missingStarterLog';
import { useToast } from '@/hooks/use-toast';

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
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [totalMatchMinute, setTotalMatchMinute] = useState(0);
  // Second-level counterparts of currentMinute/totalMatchMinute, display only (UX-009).
  // currentMinute/totalMatchMinute remain the whole-minute values written to match_events.
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  // Latest currentSeconds, readable from effects that must not re-run every
  // second. Used by the missing-starter-log safety net (BUG-011) to place a
  // returning player's healed interval at the real elapsed minute.
  const currentSecondsRef = useRef(0);
  currentSecondsRef.current = currentSeconds;
  const [currentPeriodNumber, setCurrentPeriodNumber] = useState(0);
  // Live period id + running flag reported by useEnhancedMatchTimer (via
  // EnhancedMatchControls' onTimerUpdate). This page's own `periods`/`fixture`
  // state is only loaded on mount, so when a period is started while the screen
  // is open, usePlayerTimers otherwise has no period to read and every tile
  // sticks at 0m until the page is remounted (DEFECT 1).
  //
  // `timerPeriodId` is `undefined` until the timer's first update, then the
  // reported value — which is `null` between periods. That distinction matters:
  // a reported `null` must reach usePlayerTimers as `null` (no active period),
  // while `undefined` still falls back to the mount-time period id for the
  // brief window before the timer speaks (BUG-012).
  const [timerPeriodId, setTimerPeriodId] = useState<string | null | undefined>(undefined);
  const [timerRunning, setTimerRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Smart suggestions based on match context (after state declarations)
  const smartSuggestions = useSmartSuggestions(players, events as any, currentPeriodNumber);

  // Substitution state. The committed lineup (from player_match_status) lives in
  // these two lists; the STAGED changes on top of it live in usePendingSubs and
  // never touch the database until Submit (UX-007 branch 3).
  const [activePlayersList, setActivePlayersList] = useState<Player[]>([]);
  const [substitutePlayersList, setSubstitutePlayersList] = useState<Player[]>([]);
  const {
    stack: pendingStack,
    selectedOutId,
    lockedIds: pendingLockedIds,
    oldestStagedAt: oldestPendingAt,
    selectPitchPlayer,
    completePairWithBench,
    undoLast: undoLastPendingSub,
    discardAll: discardPendingSubs,
    removeCommitted: removeCommittedPendingSubs,
    applyToLineup,
  } = usePendingSubs();
  const { toast } = useToast();

  // Edit squad state
  const [editSquadOpen, setEditSquadOpen] = useState(false);

  // Local log of substitutions for UI only (not persisted as match_events)
  const [substitutions, setSubstitutions] = useState<{ outId: string; inId: string; minute: number; total: number }[]>([]);

  // One shared clock for the pending panel's waiting timer and the 60s critical
  // state, so the panel and the Submit button's halo never disagree by a frame.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (pendingStack.length === 0) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pendingStack.length]);
  const pendingWaitedSeconds =
    oldestPendingAt === null ? 0 : Math.max(0, Math.floor((nowTick - oldestPendingAt) / 1000));
  const pendingCritical = pendingWaitedSeconds >= 60;

  // The bottom furniture is now variable-height — it grows with each pending row —
  // so the scroll container's padding is derived from the measured footer rather
  // than a fixed value, or the player grid ends up underneath it (UX-007).
  const actionBarRef = useRef<HTMLDivElement>(null);
  const footerExtrasRef = useRef<HTMLDivElement>(null);
  const [actionBarH, setActionBarH] = useState(72);
  const [footerPad, setFooterPad] = useState(160);
  
  // Short reversal window for a mis-tap during play (BUG-004). Declared above the
  // handlers that call pushUndo so the binding is never read before assignment.
  const {
    canUndo,
    isUndoing,
    currentAction,
    remainingSeconds,
    pushUndo,
    performUndo,
  } = useUndoStack();

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

      // Offer a short window to reverse a mis-tap. This deletes only the row we
      // just created, addressed by its own id — never "the most recent event" —
      // so a second coach recording on another device cannot be affected. The
      // score is derived from events via calculateScore(), so it corrects itself
      // once the row is gone, and the reports trigger refreshes on DELETE.
      const scorer = players.find((p) => p.id === playerId);
      pushUndo({
        type: 'event',
        description: isOurTeam
          ? `Goal — ${scorer ? `${scorer.first_name} ${scorer.last_name}` : 'our team'}`
          : 'Goal — opposition',
        undo: async () => {
          const { error: undoError } = await supabase
            .from('match_events')
            .delete()
            .eq('id', newEvent.id);
          if (undoError) throw undoError;
          await loadEvents();
        },
      });

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

      // Once the match is under way, live tracking owns is_on_field — a
      // substitution has moved players since kick-off. Re-running the
      // reconcile-to-starters step below on every screen mount would revert
      // every substitution made in a previous session (DEFECT 2). Detect "under
      // way" from the fixture status or the existence of any match period.
      const startedStatuses = ['in_progress', 'live', 'paused', 'completed'];
      let matchUnderway = startedStatuses.includes(String(fixtureData?.status || ''));
      if (!matchUnderway) {
        const { data: anyPeriods } = await supabase
          .from('match_periods')
          .select('id')
          .eq('fixture_id', fixtureId)
          .limit(1);
        matchUnderway = !!(anyPeriods && anyPeriods.length > 0);
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
        // Reconcile active/inactive flags to reflect starters — ONLY before
        // kick-off. After that, substitutions have moved players and this would
        // undo them (DEFECT 2); missing rows are still healed above.
        if (matchUnderway) {
          console.log('[MatchTracker] Match under way — skipping reconcile-to-starters');
        } else if (desiredActiveSet.size > 0) {
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

  // Stable identity: EnhancedMatchControls now fires onTimerUpdate from a useEffect
  // keyed on timerState (BUG-020), so a new function reference here on every render
  // would loop that effect. Only state setters are called below, which are stable
  // across renders, so an empty dependency array is correct.
  const handleTimerUpdate = useCallback((
    minute: number,
    totalMinute: number,
    periodNumber: number,
    seconds: number,
    totalMatchSeconds: number,
    periodId?: string | null,
    isRunning?: boolean
  ) => {
    setCurrentMinute(minute);
    setTotalMatchMinute(totalMinute);
    setCurrentPeriodNumber(periodNumber);
    setCurrentSeconds(seconds);
    setTotalSeconds(totalMatchSeconds);
    // Fresh every second while a period runs — drives usePlayerTimers (DEFECT 1).
    if (periodId !== undefined) setTimerPeriodId(periodId);
    if (isRunning !== undefined) setTimerRunning(isRunning);

    // Removed per-second DB writes to player_time_logs. We now only write on transitions:
    // - New period start initializes starters at time_on=0 in useEffect on period change
    // - Substitution on/off writes time_on_minute/time_off_minute
    // - Period end finalizes open intervals
  }, []);
  const currentPeriod = periods.find(p => p.is_active) || (periods.length > 0 ? periods[periods.length - 1] : null);

  // Real-time player timers. The timer (fresh every second via onTimerUpdate) is
  // the source of truth for both the running flag and the current period id.
  // This page's `periods`/`fixture` state is loaded once on mount and never
  // refreshed, so anything derived from it is stale the moment a period ends —
  // `isMatchRunning` could never go false, and `?? currentPeriod?.id` masked a
  // reported `null` with the mount-time period. Both held usePlayerTimers in a
  // mid-period state after the period ended, so the BUG-012 reload never fired.
  //
  // `currentPeriod?.id` is still used as the fallback only while `timerPeriodId`
  // is `undefined` (before the timer's first update); once the timer reports,
  // its value wins — including a `null` that means "no active period".
  const { getPlayerTime, reloadTimes } = usePlayerTimers({
    fixtureId: fixtureId!,
    currentPeriodId: timerPeriodId !== undefined ? timerPeriodId : (currentPeriod?.id ?? null),
    isTimerRunning: timerRunning,
    // Elapsed seconds in the current period, pause-adjusted by the timer.
    // Tile minutes are derived from this at render — no interval in the hook.
    currentPeriodSeconds: currentSeconds,
  });

  // Recording stays gated on active_tracker_id — a pending stack is local to this
  // device and invisible to a second coach, so staging and Submit are only
  // available to the active tracker (mirrors the existing action-bar gate).
  const recordingLocked =
    !matchTracker?.isActiveTracker &&
    (fixture?.status === 'in_progress' || fixture?.status === 'live');

  // Effective lineup = committed state with the pending pairs applied. A player
  // staged to come on shows on the pitch immediately; a staged-out player moves
  // to the bench. Playing time is unaffected — nothing is written until Submit.
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const { effectivePitch, effectiveBench } = useMemo(() => {
    const { pitchIds, benchIds } = applyToLineup(
      activePlayersList.map((p) => p.id),
      substitutePlayersList.map((p) => p.id),
    );
    const resolve = (ids: string[]) =>
      ids.map((id) => playersById.get(id)).filter((p): p is Player => !!p);
    return { effectivePitch: resolve(pitchIds), effectiveBench: resolve(benchIds) };
  }, [applyToLineup, activePlayersList, substitutePlayersList, playersById]);

  const firstNameFor = useCallback(
    (id: string) => playersById.get(id)?.first_name ?? 'Player',
    [playersById],
  );

  // Commit the staged substitutions. Reused by the action-bar Submit and the
  // UX-010 end-of-period/match guard. Rejects if the batch did not fully commit,
  // leaving any failed pair staged rather than losing it.
  const handleSubmitPendingSubs = async () => {
    if (recordingLocked || pendingStack.length === 0) return;

    const batch = pendingStack.map((p) => ({
      id: p.id,
      playerOut: p.outId,
      playerIn: p.inId,
      offEventId: p.offEventId,
      onEventId: p.onEventId,
    }));

    const result = await submitSubstitutions({
      fixtureId: fixtureId!,
      pairs: batch,
      // Stamped at Submit time: match_events take the timestamp minute,
      // player_time_logs take Math.floor(currentSeconds / 60) as a duration.
      currentMinute,
      totalMatchMinute,
      currentSeconds,
      // Names the player in the BUG-011 "minutes may be understated" toast.
      resolvePlayerName: firstNameFor,
    });

    if (result.committedPairIds.length > 0) {
      const done = new Set(result.committedPairIds);
      const justCommitted = pendingStack.filter((p) => done.has(p.id));
      setSubstitutions((prev) => [
        ...prev,
        ...justCommitted.map((p) => ({
          outId: p.outId,
          inId: p.inId,
          minute: currentMinute,
          total: totalMatchMinute,
        })),
      ]);
      removeCommittedPendingSubs(result.committedPairIds);
    }

    await refreshPlayerStatusLists();
    await loadEvents();
    reloadTimes();

    if (result.error) {
      const remaining = pendingStack.length - result.committedPairIds.length;
      const detail =
        result.error instanceof Error ? result.error.message : String(result.error);
      console.error('[handleSubmitPendingSubs] submit incomplete', result);
      toast({
        title: 'Some substitutions did not submit',
        description: `${result.committedPairIds.length} committed, ${remaining} still pending — ${detail}. Try Submit again.`,
        variant: 'destructive',
      });
      // Surface it to the guard so an end-of-period/match does not proceed.
      throw result.error;
    }
  };

  // Measure the real footer height (action bar + pending panel + events summary)
  // and pad the scroll area by it, so the player grid never scrolls underneath.
  useLayoutEffect(() => {
    const measure = () => {
      const ab = actionBarRef.current?.offsetHeight ?? 0;
      const ex = footerExtrasRef.current?.offsetHeight ?? 0;
      setActionBarH(ab || 72);
      // Clamp so a tall footer stack can't eat the whole viewport.
      const cap = Math.round(window.innerHeight * 0.55);
      setFooterPad(Math.min(ab + ex + 16, cap));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (actionBarRef.current) ro.observe(actionBarRef.current);
    if (footerExtrasRef.current) ro.observe(footerExtrasRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [pendingStack.length, events.length, eventsLoading]);

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

        // Elapsed minutes in the current period, from the freshest value the
        // timer has reported. This effect can run before the timer has ticked
        // (straight after mount, currentSeconds still 0), so treat "no positive
        // elapsed time" as "not available" and pass null — decideMissingStarterLog
        // then skips a returning player rather than fabricating a spell from
        // minute 0 (BUG-011). A genuine starter (no rows at all) is still
        // inserted at minute 0 regardless.
        const elapsedSeconds = currentSecondsRef.current;
        const durationMinute =
          elapsedSeconds > 0 ? Math.floor(elapsedSeconds / 60) : null;

        for (const row of onField) {
          // Read EVERY row for (fixture, player, period), active and closed, so
          // a genuine missing starter is told apart from a returning player
          // whose current spell was never recorded (BUG-011). A duplicate
          // insert is no longer blocked by unique_player_period_fixture
          // (BUG-009), so the old unconditional { minute 0, is_starter: true }
          // fallback would double-count the bench time between spells.
          const { data: rows, error: readErr } = await supabase
            .from('player_time_logs')
            .select('id, is_active')
            .eq('fixture_id', fixtureId)
            .eq('player_id', row.player_id)
            .eq('period_id', activeP.id);
          if (readErr) {
            console.warn(
              `[initMissingStarterLogs] could not read time logs for player ${row.player_id} ` +
                `in period ${activeP.id}; skipping`,
              readErr,
            );
            continue;
          }

          const decision = decideMissingStarterLog(rows ?? [], durationMinute);
          if (decision.insert === false) {
            if (decision.reason === 'missing-spell-no-duration') {
              // Rows exist but none active and no elapsed time to place the
              // spell — do NOT fall back to minute 0 (that over-counts).
              // Leave it for Match Data Editor.
              console.error(
                `[initMissingStarterLogs] player ${row.player_id} has closed player_time_logs ` +
                  `rows in period ${activeP.id} but no active one, and no elapsed time is ` +
                  `available to place the spell — skipping insert. This player's minutes may ` +
                  `be understated; check Match Data Editor.`,
              );
            }
            continue;
          }
          if (decision.missingSpell) {
            console.error(
              `[initMissingStarterLogs] player ${row.player_id} is on the pitch in period ` +
                `${activeP.id} with closed time logs but no active one; their current spell ` +
                `was never recorded. Opening an interval from minute ${decision.timeOnMinute} ` +
                `(is_starter=false) — the un-recorded earlier minutes are lost, so this ` +
                `player's total is understated rather than over-counted (BUG-011).`,
            );
          }
          await supabase
            .from('player_time_logs')
            .insert({
              fixture_id: fixtureId,
              player_id: row.player_id,
              period_id: activeP.id,
              time_on_minute: decision.timeOnMinute,
              is_starter: decision.isStarter,
              is_active: true,
            });
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

  const { ourGoals, opponentGoals } = calculateScore(events);

  // Keyboard shortcuts for quick actions
  useMatchTrackerShortcuts({
    onRecordGoal: () => {
      if (matchTracker?.isActiveTracker || fixture?.status !== 'in_progress') {
        setShowEventDialog(true);
      }
    },
    onSubstitution: () => {
      // Staging is done by tapping tiles now (UX-007 branch 3); the 's' shortcut
      // commits whatever is staged.
      if (pendingStack.length > 0) {
        void handleSubmitPendingSubs();
      }
    },
    onOtherEvent: () => setShowEventDialog(true),
    onUndo: performUndo,
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
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      {/* Fixed Header with Score and Timer */}
      <FixedMatchHeader
        teamName={fixture.teams?.name || 'Team'}
        opponentName={fixture.opponent_name || 'Opponent'}
        ourScore={ourGoals}
        opponentScore={opponentGoals}
        currentTime={formatTime(currentSeconds)}
        totalTime={formatTime(totalSeconds)}
        periodNumber={currentPeriodNumber}
        matchStatus={fixture.status || 'scheduled'}
      />

      {/* Scrollable Content Area. Bottom padding is derived from the measured
          footer (action bar + pending panel + events summary), which is now
          variable-height — see the useLayoutEffect above (UX-007). */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ paddingBottom: footerPad }}>
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
        pendingSubCount={pendingStack.length}
        onSubmitPendingSubs={handleSubmitPendingSubs}
        onDiscardPendingSubs={discardPendingSubs}
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
          {/* Labelled for what it does, not what it is called internally. A coach who
              has just mis-tapped "End Match" must not read this as a way back. */}
          <Trash2 className="h-4 w-4" />
          Delete Match Data
        </Button>
      </div>

      {/* Player tiles — first name and minutes played only (UX-007 branch 2).
          Branch 3: the grid shows the EFFECTIVE lineup (committed + pending). Tap a
          pitch player to select (amber ring), then a bench player to stage the pair
          onto the pending stack — nothing is written until Submit. */}
      {(activePlayersList.length > 0 || substitutePlayersList.length > 0) && (
        <PlayerTileGrid
          activePlayers={effectivePitch}
          benchPlayers={effectiveBench}
          getPlayerTime={getPlayerTime}
          selectedId={selectedOutId}
          pendingIds={pendingLockedIds}
          onPitchTileTap={recordingLocked ? undefined : (player) => selectPitchPlayer(player.id)}
          onBenchTileTap={recordingLocked ? undefined : (player) => completePairWithBench(player.id)}
        />
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
                {periodEvents.map((event, idx) => {
                  const scorer = event.players ? `${event.players.first_name} ${event.players.last_name}` : null;
                  const assistProvider = event.assist_players ? `${event.assist_players.first_name} ${event.assist_players.last_name}` : null;
                  const subOut = players.find(ply => ply.id === event.player_id);
                  const subIn = players.find(ply => ply.id === event.assist_player_id);
                  
                  return (
                    <div 
                      key={event.id} 
                      className="flex flex-col gap-2 p-4 border rounded-lg bg-card/50 animate-in fade-in slide-in-from-bottom-2 duration-300"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      {/* Event Header - Time and Type */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-sm font-mono shrink-0 px-2.5 py-1">
                          {event.total_match_minute}'
                        </Badge>
                        
                        {event.event_type === 'goal' && (
                          <>
                            <div className="flex items-center gap-1.5">
                              <Goal className="h-5 w-5 text-green-600" />
                              <span className="font-semibold text-base">GOAL</span>
                            </div>
                            {event.is_penalty && <Badge variant="outline" className="text-xs">Penalty</Badge>}
                            {!event.is_our_team && <Badge variant="destructive" className="text-xs">Opposition</Badge>}
                          </>
                        )}
                        
                        {event.event_type === 'substitution' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl">🔄</span>
                            <span className="font-semibold text-base">SUBSTITUTION</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Event Details - Player Information */}
                      {event.event_type === 'goal' && scorer && (
                        <div className="flex flex-col gap-1 ml-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Scorer:</span>
                            <span className="font-semibold text-base text-foreground">{scorer}</span>
                          </div>
                          {assistProvider && (
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs text-muted-foreground uppercase tracking-wide">Assist:</span>
                              <span className="font-medium text-sm text-muted-foreground">{assistProvider}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {event.event_type === 'goal' && !scorer && !event.is_our_team && (
                        <div className="flex flex-col gap-1 ml-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Opponent Goal</span>
                          </div>
                        </div>
                      )}
                      
                      {event.event_type === 'substitution' && subOut && subIn && (
                        <div className="flex flex-col gap-1 ml-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Off:</span>
                            <span className="font-medium text-sm text-destructive/80">
                              {subOut.first_name} {subOut.last_name}
                              {subOut.jersey_number && ` (#${subOut.jersey_number})`}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">On:</span>
                            <span className="font-medium text-sm text-green-600">
                              {subIn.first_name} {subIn.last_name}
                              {subIn.jersey_number && ` (#${subIn.jersey_number})`}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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

      {/* Delete-match-data confirmation (internally still "restart" — see UX-008) */}
      <AlertDialog open={showRestartConfirm} onOpenChange={setShowRestartConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete all match data?
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
              {isRestarting ? 'Deleting...' : 'Yes, delete everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


        </div>
      </div>

      {/* Undo — positioned to clear both the events summary and the action bar.
          UndoButton's own bottom-20 would land it on top of the summary. */}
      <UndoButton
        canUndo={canUndo}
        isUndoing={isUndoing}
        remainingSeconds={remainingSeconds}
        description={currentAction?.description}
        onUndo={performUndo}
        className="bottom-[calc(148px+max(8px,env(safe-area-inset-bottom)))]"
      />

      {/* Footer furniture stacked directly above the action bar: the pending-subs
          panel (branch 3) then the events summary. This block's height feeds the
          scroll-area padding measured in the useLayoutEffect above, so the player
          grid is never hidden behind it however many substitutions are pending. */}
      <div
        ref={footerExtrasRef}
        className="fixed left-0 right-0 z-30 max-h-[45dvh] overflow-y-auto overscroll-contain"
        style={{ bottom: actionBarH }}
      >
        <PendingSubsPanel
          pairs={pendingStack}
          nameFor={firstNameFor}
          waitedSeconds={pendingWaitedSeconds}
          critical={pendingCritical}
          onUndoLast={undoLastPendingSub}
          disabled={recordingLocked}
        />
        <LiveEventsSummary
          events={events}
          players={players}
          loading={eventsLoading}
        />
      </div>

      {/* Bottom Action Bar - Fixed */}
      <BottomActionBar
        ref={actionBarRef}
        onQuickGoal={() => setShowGoalDialog(true)}
        onOtherEvent={() => setShowEventDialog(true)}
        onSubmit={() => { void handleSubmitPendingSubs(); }}
        pendingCount={pendingStack.length}
        pendingCritical={pendingCritical}
        isPeriodRunning={timerRunning}
        disabled={recordingLocked}
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