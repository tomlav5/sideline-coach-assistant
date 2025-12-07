import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlayerTimer {
  playerId: string;
  currentMinutes: number;
  isActive: boolean;
  startedAt: number; // timestamp when player came on field
}

interface UsePlayerTimersProps {
  fixtureId: string;
  currentPeriodId: string | null;
  isTimerRunning: boolean;
}

export function usePlayerTimers({ fixtureId, currentPeriodId, isTimerRunning }: UsePlayerTimersProps) {
  const [playerTimers, setPlayerTimers] = useState<Record<string, PlayerTimer>>({});

  // Load active player times from database
  const loadPlayerTimes = useCallback(async () => {
    if (!currentPeriodId) {
      setPlayerTimers({});
      return;
    }

    try {
      // Get all active time logs for current period
      const { data: activeLogs, error } = await supabase
        .from('player_time_logs')
        .select('player_id, time_on_minute, is_active')
        .eq('fixture_id', fixtureId)
        .eq('period_id', currentPeriodId)
        .eq('is_active', true);

      if (error) throw error;

      // Get period start time to calculate elapsed seconds
      const { data: period } = await supabase
        .from('match_periods')
        .select('actual_start_time, total_paused_seconds')
        .eq('id', currentPeriodId)
        .single();

      if (!period?.actual_start_time) {
        setPlayerTimers({});
        return;
      }

      const periodStartTime = new Date(period.actual_start_time).getTime();
      const pausedSeconds = period.total_paused_seconds || 0;
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - periodStartTime) / 1000) - pausedSeconds;
      const currentPeriodMinute = Math.floor(elapsedSeconds / 60);

      const timers: Record<string, PlayerTimer> = {};
      
      activeLogs?.forEach(log => {
        const timeOnMinute = log.time_on_minute || 0;
        const minutesPlayed = Math.max(0, currentPeriodMinute - timeOnMinute);
        
        timers[log.player_id] = {
          playerId: log.player_id,
          currentMinutes: minutesPlayed,
          isActive: log.is_active,
          startedAt: periodStartTime + (timeOnMinute * 60 * 1000) + (pausedSeconds * 1000),
        };
      });

      setPlayerTimers(timers);
    } catch (error) {
      console.error('Error loading player times:', error);
      setPlayerTimers({});
    }
  }, [fixtureId, currentPeriodId]);

  // Update timers every second when match is running
  useEffect(() => {
    if (!isTimerRunning || !currentPeriodId) {
      return;
    }

    // Initial load
    loadPlayerTimes();

    // Update every second
    const interval = setInterval(() => {
      setPlayerTimers(prev => {
        const updated = { ...prev };
        const now = Date.now();
        
        Object.keys(updated).forEach(playerId => {
          const timer = updated[playerId];
          const elapsedSeconds = Math.floor((now - timer.startedAt) / 1000);
          updated[playerId] = {
            ...timer,
            currentMinutes: Math.floor(elapsedSeconds / 60),
          };
        });
        
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, currentPeriodId, loadPlayerTimes]);

  // Reload when period changes
  useEffect(() => {
    loadPlayerTimes();
  }, [currentPeriodId, loadPlayerTimes]);

  const getPlayerTime = (playerId: string): number => {
    return playerTimers[playerId]?.currentMinutes || 0;
  };

  const isPlayerActive = (playerId: string): boolean => {
    return playerTimers[playerId]?.isActive || false;
  };

  return {
    playerTimers,
    getPlayerTime,
    isPlayerActive,
    reloadTimes: loadPlayerTimes,
  };
}
