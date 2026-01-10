import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface MatchPeriod {
  id: string;
  fixture_id: string;
  period_number: number;
  period_type: 'period' | 'penalties';
  planned_duration_minutes: number;
  actual_start_time?: string;
  actual_end_time?: string;
  is_active: boolean;
  pause_time?: string;
  total_paused_seconds: number;
}

interface TimerState {
  currentPeriod?: MatchPeriod;
  periods: MatchPeriod[];
  isRunning: boolean;
  currentTime: number; // seconds in current period
  totalMatchTime: number; // total seconds across all periods
  matchStatus: 'not_started' | 'in_progress' | 'paused' | 'completed';
}

interface UseEnhancedMatchTimerProps {
  fixtureId: string;
  onSaveState?: () => void;
}

export function useEnhancedMatchTimer({ fixtureId, onSaveState }: UseEnhancedMatchTimerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [timerState, setTimerState] = useState<TimerState>({
    periods: [],
    isRunning: false,
    currentTime: 0,
    totalMatchTime: 0,
    matchStatus: 'not_started',
  });

  const intervalRef = useRef<NodeJS.Timeout>();
  const pauseStartRef = useRef<number>();
  const isFinalizingRef = useRef<boolean>(false);

  // Map internal match status to valid database enum values
  const mapMatchStatusToDbEnum = (status: TimerState['matchStatus']): string => {
    switch (status) {
      case 'not_started':
        return 'scheduled';
      case 'paused':
        // Period is paused but match is still in progress
        return 'in_progress';
      case 'in_progress':
        return 'in_progress';
      case 'completed':
        return 'completed';
      default:
        return 'scheduled';
    }
  };

  // Load existing periods and state
  const loadMatchState = useCallback(async () => {
    try {
      const { data: periods, error } = await supabase
        .from('match_periods')
        .select('*')
        .eq('fixture_id', fixtureId)
        .order('period_number');

      if (error) throw error;

      const { data: fixture, error: fixtureError } = await supabase
        .from('fixtures')
        .select('match_state, current_period_id')
        .eq('id', fixtureId)
        .single();

      if (fixtureError) throw fixtureError;

      const currentPeriod = periods?.find(p => p.id === fixture?.current_period_id);
      const matchState = (fixture?.match_state as any) || { status: 'not_started', total_time_seconds: 0 };
      
      // Calculate total match time from all completed periods plus current period
      let totalTime = 0;
      periods?.forEach(p => {
        if (p.actual_end_time) {
          // Completed period
          const start = new Date(p.actual_start_time!).getTime();
          const end = new Date(p.actual_end_time).getTime();
          totalTime += Math.floor((end - start) / 1000) - (p.total_paused_seconds || 0);
        } else if (p.id === currentPeriod?.id && p.actual_start_time) {
          // Current active period
          totalTime += calculateCurrentPeriodTime(p);
        }
      });

      setTimerState({
        periods: periods || [],
        currentPeriod,
        isRunning: currentPeriod?.is_active || false,
        currentTime: calculateCurrentPeriodTime(currentPeriod),
        totalMatchTime: totalTime,
        matchStatus: (matchState as any)?.status || 'not_started',
      });
    } catch (error) {
      console.error('Error loading match state:', error);
      toast({ title: 'Error', description: 'Failed to load match state', variant: 'destructive' });
    }
  }, [fixtureId]);

  const calculateCurrentPeriodTime = (period?: MatchPeriod): number => {
    if (!period?.actual_start_time) return 0;
    
    const startTime = new Date(period.actual_start_time).getTime();
    const pausedSeconds = period.total_paused_seconds || 0;
    
    if (period.pause_time && !period.is_active) {
      // Currently paused
      const pauseStart = new Date(period.pause_time).getTime();
      return Math.floor((pauseStart - startTime) / 1000) - pausedSeconds;
    }
    
    if (period.actual_end_time) {
      // Period ended
      const endTime = new Date(period.actual_end_time).getTime();
      return Math.floor((endTime - startTime) / 1000) - pausedSeconds;
    }
    
    // Currently running
    const now = Date.now();
    return Math.floor((now - startTime) / 1000) - pausedSeconds;
  };

  // Timer effect - synchronized timers
  useEffect(() => {
    if (timerState.isRunning && timerState.currentPeriod) {
      // Tick every second, but compute from wall-clock timestamps to avoid drift
      intervalRef.current = setInterval(() => {
        setTimerState(prev => {
          const currentComputed = calculateCurrentPeriodTime(prev.currentPeriod);
          const totalComputed = (prev.periods || []).reduce((sum, p) => {
            if (p.actual_end_time) {
              const start = new Date(p.actual_start_time!).getTime();
              const end = new Date(p.actual_end_time).getTime();
              const elapsed = Math.floor((end - start) / 1000) - (p.total_paused_seconds || 0);
              return sum + Math.max(0, elapsed);
            }
            if (prev.currentPeriod && p.id === prev.currentPeriod.id) {
              return sum + Math.max(0, currentComputed);
            }
            return sum;
          }, 0);

          return {
            ...prev,
            currentTime: currentComputed,
            totalMatchTime: totalComputed,
          };
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState.isRunning, timerState.currentPeriod?.id]);

  // Save state when important changes occur
  useEffect(() => {
    if (timerState.periods.length > 0) {
      saveMatchState();
    }
  }, [timerState.isRunning, timerState.matchStatus, timerState.totalMatchTime]);

  const saveMatchState = async () => {
    try {
      if (isFinalizingRef.current) {
        return;
      }
      
      // Map internal status to valid database enum
      const dbStatus = mapMatchStatusToDbEnum(timerState.matchStatus);
      
      const { error } = await supabase
        .from('fixtures')
        .update({
          // Keep a JSON snapshot for quick client resume
          match_state: {
            status: timerState.matchStatus, // Keep internal state in JSON
            total_time_seconds: timerState.totalMatchTime,
          },
          current_period_id: timerState.currentPeriod?.id || null,
          // Ensure DB status reflects current state for other screens/hooks
          status: dbStatus as any,
          match_status: dbStatus,
        })
        .eq('id', fixtureId);

      if (error) throw error;
      onSaveState?.();
    } catch (error) {
      console.error('Error saving match state:', error);
      toast({ title: 'Error', description: 'Failed to save match state', variant: 'destructive' });
    }
  };

  const startNewPeriod = async (plannedDurationMinutes: number = 30, periodType: 'period' | 'penalties' = 'period') => {
    try {
      const nextPeriodNumber = timerState.periods.length + 1;
      
      const { data: newPeriod, error } = await supabase
        .from('match_periods')
        .insert({
          fixture_id: fixtureId,
          period_number: nextPeriodNumber,
          period_type: periodType,
          planned_duration_minutes: periodType === 'penalties' ? 0 : plannedDurationMinutes,
          actual_start_time: new Date().toISOString(),
          is_active: periodType === 'period', // Penalties don't auto-run a timer
        })
        .select()
        .single();

      if (error) throw error;

      // Reflect in DB immediately so other screens show LIVE
      try {
        await supabase
          .from('fixtures')
          .update({
            status: 'in_progress' as any,
            match_status: 'in_progress',
            current_period_id: (newPeriod as any).id,
            match_state: {
              status: 'in_progress',
              total_time_seconds: timerState.totalMatchTime,
            },
          })
          .eq('id', fixtureId);
      } catch (e) {
        console.error('Error updating fixture to in_progress:', e);
      }

      setTimerState(prev => ({
        ...prev,
        periods: [...prev.periods, newPeriod],
        currentPeriod: newPeriod,
        isRunning: periodType === 'period', // Only regular periods run timer
        currentTime: 0,
        matchStatus: 'in_progress',
      }));
      // Immediate resync to ensure we align with server timestamps
      loadMatchState();
    } catch (error) {
      console.error('Error starting new period:', error);
      toast({ title: 'Error', description: 'Failed to start period', variant: 'destructive' });
    }
  };

  const startPenaltyShootout = async () => {
    try {
      // Check if at least one period has been completed
      if (timerState.periods.length === 0) {
        toast({ 
          title: 'Cannot start penalty shootout', 
          description: 'At least one period must be completed first', 
          variant: 'destructive' 
        });
        return;
      }

      // Check if already in penalty shootout
      const existingPenalties = timerState.periods.find(p => (p as any).period_type === 'penalties');
      if (existingPenalties) {
        toast({ 
          title: 'Penalty shootout already exists', 
          description: 'A penalty shootout has already been started', 
          variant: 'destructive' 
        });
        return;
      }

      await startNewPeriod(0, 'penalties');
      toast({ 
        title: 'Penalty Shootout Started', 
        description: 'Record penalty goals for each team' 
      });
    } catch (error) {
      console.error('Error starting penalty shootout:', error);
      toast({ title: 'Error', description: 'Failed to start penalty shootout', variant: 'destructive' });
    }
  };

  const pauseTimer = async () => {
    if (!timerState.currentPeriod) return;

    try {
      pauseStartRef.current = Date.now();
      
      const { error } = await supabase
        .from('match_periods')
        .update({
          pause_time: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', timerState.currentPeriod.id);

      if (error) throw error;

      setTimerState(prev => ({
        ...prev,
        isRunning: false,
        matchStatus: 'paused',
        currentPeriod: prev.currentPeriod ? {
          ...prev.currentPeriod,
          is_active: false,
          pause_time: new Date().toISOString(),
        } : undefined,
      }));
      // Resync derived times after pausing
      loadMatchState();
    } catch (error) {
      console.error('Error pausing timer:', error);
      toast({ title: 'Error', description: 'Failed to pause period', variant: 'destructive' });
    }
  };

  const resumeTimer = async () => {
    if (!timerState.currentPeriod) return;

    try {
      const pauseDuration = pauseStartRef.current 
        ? Math.floor((Date.now() - pauseStartRef.current) / 1000)
        : 0;

      const { error } = await supabase
        .from('match_periods')
        .update({
          pause_time: null,
          is_active: true,
          total_paused_seconds: timerState.currentPeriod.total_paused_seconds + pauseDuration,
        })
        .eq('id', timerState.currentPeriod.id);

      if (error) throw error;

      setTimerState(prev => ({
        ...prev,
        isRunning: true,
        matchStatus: 'in_progress',
        currentPeriod: prev.currentPeriod ? {
          ...prev.currentPeriod,
          is_active: true,
          pause_time: undefined,
          total_paused_seconds: prev.currentPeriod.total_paused_seconds + pauseDuration,
        } : undefined,
      }));

      pauseStartRef.current = undefined;
      // Resync immediately to correct any drift after resume
      loadMatchState();
    } catch (error) {
      console.error('Error resuming timer:', error);
      toast({ title: 'Error', description: 'Failed to resume period', variant: 'destructive' });
    }
  };

  const endCurrentPeriod = async () => {
    if (!timerState.currentPeriod) return;

    try {
      const { error } = await supabase
        .from('match_periods')
        .update({
          actual_end_time: new Date().toISOString(),
          is_active: false,
          pause_time: null,
        })
        .eq('id', timerState.currentPeriod.id);

      if (error) throw error;

      // Close any open player_time_logs for this period using actual duration
      try {
        const { data: periodRow } = await supabase
          .from('match_periods')
          .select('id, planned_duration_minutes, actual_start_time, actual_end_time, total_paused_seconds')
          .eq('id', timerState.currentPeriod.id)
          .single();
        
        if (periodRow) {
          // Calculate actual period duration in minutes
          let actualDurationMinutes = periodRow.planned_duration_minutes;
          
          if (periodRow.actual_start_time && periodRow.actual_end_time) {
            const startTime = new Date(periodRow.actual_start_time).getTime();
            const endTime = new Date(periodRow.actual_end_time).getTime();
            const pausedSeconds = periodRow.total_paused_seconds || 0;
            const elapsedSeconds = Math.floor((endTime - startTime) / 1000) - pausedSeconds;
            actualDurationMinutes = Math.floor(elapsedSeconds / 60);
          }
          
          // Close all active logs to actual duration
          await supabase
            .from('player_time_logs')
            .update({
              time_off_minute: actualDurationMinutes,
              is_active: false,
            })
            .eq('period_id', periodRow.id)
            .eq('is_active', true);  // Only update active logs
        }
      } catch (e) {
        console.warn('Failed to close open player_time_logs on period end:', e);
      }

      setTimerState(prev => ({
        ...prev,
        isRunning: false,
        currentPeriod: undefined,
        currentTime: 0,
        matchStatus: isFinalizingRef.current ? prev.matchStatus : 'paused',
      }));
      // Resync after ending a period to finalize totals
      loadMatchState();
    } catch (error) {
      console.error('Error ending period:', error);
      toast({ title: 'Error', description: 'Failed to end period', variant: 'destructive' });
    }
  };

  const endMatch = async () => {
    // Guard against side-effect saves while finalizing
    isFinalizingRef.current = true;
    if (timerState.currentPeriod) {
      await endCurrentPeriod();
    }

    setTimerState(prev => ({
      ...prev,
      matchStatus: 'completed',
      isRunning: false,
    }));

    try {
      // Explicitly set fixture status to completed for consistency
      await supabase
        .from('fixtures')
        .update({
          status: 'completed' as any,
          match_status: 'completed',
          match_state: {
            status: 'completed',
            total_time_seconds: timerState.totalMatchTime,
          },
          current_period_id: null,
          active_tracker_id: null,
          tracking_started_at: null,
          last_activity_at: null,
        })
        .eq('id', fixtureId);

      // Refresh materialized views for reports (Phase 2: Re-enabled with analytics infrastructure)
      try {
        await supabase.rpc('refresh_report_views');
      } catch (refreshError: any) {
        // Log but don't fail the match completion if view refresh fails
        console.warn('Failed to refresh report views (non-critical):', refreshError);
        // Views will be refreshed by triggers or next manual refresh
      }
      
      // Invalidate relevant query caches
      queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
      queryClient.invalidateQueries({ queryKey: ['goal-scorers'] });
      queryClient.invalidateQueries({ queryKey: ['player-playing-time'] });
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      toast({ title: 'Match completed', description: 'Match has been marked as completed.' });
    } catch (error: any) {
      console.error('Error ending match:', error);
      const errorMessage = error?.message || 'Failed to end match';
      toast({ 
        title: 'Error', 
        description: errorMessage.includes('relationship') 
          ? 'Match completed but report update failed. Reports will update automatically.' 
          : errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      isFinalizingRef.current = false;
    }

    // Clear any localStorage match session to avoid lingering "active" indicators
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`match_${fixtureId}`);
      }
    } catch {}

      // Navigate to match report after successful completion
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.location.href = `/match-report/${fixtureId}`;
        }, 1000);
      }
    
  };

  const getCurrentMinute = () => Math.floor(timerState.currentTime / 60);
  const getTotalMatchMinute = () => Math.floor(timerState.totalMatchTime / 60);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load state on mount
  useEffect(() => {
    loadMatchState();
  }, [loadMatchState]);

  // Re-sync when tab becomes visible again (e.g., after backgrounding)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadMatchState();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadMatchState]);

  // Optional: periodic lightweight re-sync with server while running to correct any drift
  useEffect(() => {
    if (!timerState.isRunning) return;
    const id = setInterval(() => {
      loadMatchState();
    }, 30000); // 30s
    return () => clearInterval(id);
  }, [timerState.isRunning, loadMatchState]);

  return {
    timerState,
    startNewPeriod,
    startPenaltyShootout,
    pauseTimer,
    resumeTimer,
    endCurrentPeriod,
    endMatch,
    getCurrentMinute,
    getTotalMatchMinute,
    formatTime,
    loadMatchState,
  };
}