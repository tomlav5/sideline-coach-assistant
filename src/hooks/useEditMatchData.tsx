import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function useEditMatchData() {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  // Refresh all reports after any edit
  const refreshReports = async () => {
    try {
      await supabase.rpc('refresh_report_views');
      
      // Invalidate relevant query caches
      queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
      queryClient.invalidateQueries({ queryKey: ['goal-scorers'] });
      queryClient.invalidateQueries({ queryKey: ['player-playing-time'] });
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      queryClient.invalidateQueries({ queryKey: ['match-report'] });
    } catch (error) {
      console.error('Error refreshing report views:', error);
    }
  };

  // ==================== EVENTS ====================
  
  const updateEvent = async (eventId: string, updates: {
    player_id?: string;
    assist_player_id?: string | null;
    minute_in_period?: number;
    is_penalty?: boolean;
    event_type?: 'goal' | 'assist';
    notes?: string;
  }) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('match_events')
        .update(updates)
        .eq('id', eventId);

      if (error) throw error;

      await refreshReports();
      toast.success('Event updated successfully');
      return true;
    } catch (error: any) {
      console.error('Error updating event:', error);
      toast.error(error?.message || 'Failed to update event');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteEvent = async (eventId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('match_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      await refreshReports();
      toast.success('Event deleted successfully');
      return true;
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast.error(error?.message || 'Failed to delete event');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== PLAYER TIMES ====================
  
  const updatePlayerTime = async (timeLogId: string, updates: {
    time_on_minute?: number | null;
    time_off_minute?: number | null;
    is_starter?: boolean;
  }) => {
    setIsLoading(true);
    try {
      // The total_period_minutes will be auto-calculated by the trigger
      const { error } = await supabase
        .from('player_time_logs')
        .update(updates)
        .eq('id', timeLogId);

      if (error) throw error;

      await refreshReports();
      toast.success('Player time updated successfully');
      return true;
    } catch (error: any) {
      console.error('Error updating player time:', error);
      toast.error(error?.message || 'Failed to update player time');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deletePlayerTime = async (timeLogId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('player_time_logs')
        .delete()
        .eq('id', timeLogId);

      if (error) throw error;

      await refreshReports();
      toast.success('Player time log deleted');
      return true;
    } catch (error: any) {
      console.error('Error deleting player time:', error);
      toast.error(error?.message || 'Failed to delete player time');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== PERIODS ====================
  
  const updatePeriod = async (periodId: string, updates: {
    planned_duration_minutes?: number;
  }) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('match_periods')
        .update(updates)
        .eq('id', periodId);

      if (error) throw error;

      // Also need to recalculate player times for this period
      // The trigger will handle this on next update to player_time_logs
      
      await refreshReports();
      toast.success('Period updated successfully');
      return true;
    } catch (error: any) {
      console.error('Error updating period:', error);
      toast.error(error?.message || 'Failed to update period');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deletePeriod = async (periodId: string) => {
    setIsLoading(true);
    try {
      // Check if period has events or player times
      const { data: events } = await supabase
        .from('match_events')
        .select('id')
        .eq('period_id', periodId)
        .limit(1);

      const { data: times } = await supabase
        .from('player_time_logs')
        .select('id')
        .eq('period_id', periodId)
        .limit(1);

      if (events && events.length > 0) {
        toast.error('Cannot delete period with events. Delete events first.');
        return false;
      }

      if (times && times.length > 0) {
        toast.error('Cannot delete period with player times. Delete time logs first.');
        return false;
      }

      const { error } = await supabase
        .from('match_periods')
        .delete()
        .eq('id', periodId);

      if (error) throw error;

      await refreshReports();
      toast.success('Period deleted successfully');
      return true;
    } catch (error: any) {
      console.error('Error deleting period:', error);
      toast.error(error?.message || 'Failed to delete period');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== VALIDATION ====================
  
  const validateMatchData = async (fixtureId: string) => {
    const warnings: string[] = [];

    try {
      // Get all periods
      const { data: periods } = await supabase
        .from('match_periods')
        .select('*')
        .eq('fixture_id', fixtureId)
        .order('period_number');

      // Get all player times
      const { data: playerTimes } = await supabase
        .from('player_time_logs')
        .select('*, match_periods(planned_duration_minutes)')
        .eq('fixture_id', fixtureId);

      // Check for time inconsistencies
      playerTimes?.forEach((pt: any) => {
        const periodDuration = pt.match_periods?.planned_duration_minutes || 0;
        
        if (pt.time_on_minute && pt.time_on_minute > periodDuration) {
          warnings.push(`Player time_on (${pt.time_on_minute}min) exceeds period duration (${periodDuration}min)`);
        }
        
        if (pt.time_off_minute && pt.time_off_minute > periodDuration) {
          warnings.push(`Player time_off (${pt.time_off_minute}min) exceeds period duration (${periodDuration}min)`);
        }

        if (pt.time_on_minute && pt.time_off_minute && pt.time_on_minute >= pt.time_off_minute) {
          warnings.push(`Player time_on (${pt.time_on_minute}min) is after or equal to time_off (${pt.time_off_minute}min)`);
        }
      });

      return warnings;
    } catch (error) {
      console.error('Error validating match data:', error);
      return [];
    }
  };

  return {
    isLoading,
    // Events
    updateEvent,
    deleteEvent,
    // Player Times
    updatePlayerTime,
    deletePlayerTime,
    // Periods
    updatePeriod,
    deletePeriod,
    // Validation
    validateMatchData,
  };
}
