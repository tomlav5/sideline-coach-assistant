import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  playerMinutesPlayed,
  summarisePlayerMinutes,
  type PlayerMinutesSummary,
} from '@/lib/playerMinutes';

interface UsePlayerTimersProps {
  fixtureId: string;
  currentPeriodId: string | null;
  isTimerRunning: boolean;
  /**
   * Elapsed seconds in the current period, already pause-adjusted by
   * `useEnhancedMatchTimer`. Minutes on the tiles are derived from this at
   * render time — this hook holds no per-second interval of its own (the page
   * already re-renders every second for the UX-009 clock).
   */
  currentPeriodSeconds: number;
}

// Poll fast whenever no player has an open interval in the current period —
// we may have raced the period-transition effect that creates the starter
// rows (~2 + 2N sequential writes for an 11-a-side squad). This covers both
// kick-off (the map is empty) and half-time (the map is full of period-1
// closed intervals while the period-2 starter rows are still being written).
// Back off to a cheap safety net once a live interval shows up.
const FAST_POLL_MS = 2000;
const SLOW_POLL_MS = 15000;

export function usePlayerTimers({
  fixtureId,
  currentPeriodId,
  isTimerRunning,
  currentPeriodSeconds,
}: UsePlayerTimersProps) {
  const [summaries, setSummaries] = useState<Record<string, PlayerMinutesSummary>>({});

  // Read every `player_time_logs` row for the fixture and fold it into a
  // per-player summary. Not scoped to the current period (BUG-007) or to
  // `is_active` — closed intervals from earlier periods must still count.
  //
  // `currentPeriodId` is null between periods (BUG-012): no period is accruing,
  // so we skip the `match_periods` kick-off check and fold with a null current
  // period. Every interval is then treated as closed and the tiles show correct
  // fixture totals with nothing ticking up — exactly right at half-time.
  const loadPlayerTimes = useCallback(async () => {
    try {
      if (currentPeriodId) {
        const { data: period, error: periodError } = await supabase
          .from('match_periods')
          .select('actual_start_time')
          .eq('id', currentPeriodId)
          .single();

        if (periodError) throw periodError;

        // The period row exists but has not kicked off yet: nothing to accrue.
        // Do NOT clear an already-populated map here — an empty write on this
        // path is what blanked every tile for a whole half (BUG-006).
        if (!period?.actual_start_time) return;
      }

      const { data: logs, error } = await supabase
        .from('player_time_logs')
        .select('player_id, time_on_minute, time_off_minute, is_active, period_id')
        .eq('fixture_id', fixtureId);

      if (error) throw error;

      setSummaries(summarisePlayerMinutes(logs ?? [], currentPeriodId));
    } catch (error) {
      // A transient read error must never wipe the tiles mid-match.
      console.error('Error loading player times:', error);
    }
  }, [fixtureId, currentPeriodId]);

  // Load on mount, whenever the fixture or current period changes, and whenever
  // the timer starts OR stops. A period ending flips `isTimerRunning` to false
  // and `currentPeriodId` to null, and `useEnhancedMatchTimer` zeroes its clock
  // at that moment. The poll below only runs while a period is running, so
  // without this stop-triggered reload the tiles keep a summary built mid-period
  // — every on-pitch player with an OPEN interval and no closed one — and
  // evaluate it against a zero clock, blanking every still-on-pitch tile to 0m
  // (BUG-012). (The `currentPeriodId` change from a live id to null also
  // re-fires this effect via `loadPlayerTimes`; the explicit `isTimerRunning`
  // dependency keeps it firing even if that id were somehow unchanged.)
  //
  // The period-end handler closes those open logs asynchronously, so a reload
  // fired the instant the timer stops can read before the writes land — the same
  // race the fast poll covers at kick-off and half-time. After a stop, re-check
  // once more after a short delay; clear it on unmount or any further change.
  useEffect(() => {
    loadPlayerTimes();

    if (isTimerRunning) return;

    const timeout = setTimeout(loadPlayerTimes, 2000);
    return () => clearTimeout(timeout);
  }, [loadPlayerTimes, isTimerRunning]);

  // Poll while a period is running: fast until some player has an open
  // interval in the current period (closes the kick-off and half-time races
  // above), slow once one shows up. The interval is torn down and
  // re-established when the phase changes.
  const needsFastPoll =
    Object.keys(summaries).length === 0 ||
    !Object.values(summaries).some((s) => s.isActiveNow);
  useEffect(() => {
    if (!isTimerRunning || !currentPeriodId) return;

    const intervalMs = needsFastPoll ? FAST_POLL_MS : SLOW_POLL_MS;
    const interval = setInterval(loadPlayerTimes, intervalMs);
    return () => clearInterval(interval);
  }, [isTimerRunning, currentPeriodId, needsFastPoll, loadPlayerTimes]);

  const getPlayerTime = useCallback(
    (playerId: string): number =>
      playerMinutesPlayed(summaries[playerId], currentPeriodSeconds),
    [summaries, currentPeriodSeconds],
  );

  const isPlayerActive = useCallback(
    (playerId: string): boolean => summaries[playerId]?.isActiveNow ?? false,
    [summaries],
  );

  return {
    getPlayerTime,
    isPlayerActive,
    reloadTimes: loadPlayerTimes,
  };
}
