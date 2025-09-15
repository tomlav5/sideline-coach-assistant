import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to automatically refresh report data when materialized views are updated
 * Listens for database notifications and invalidates relevant queries
 */
export function useReportRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to database notifications for report refreshes
    const channel = supabase
      .channel('report-refresh')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fixtures'
      }, () => {
        // Invalidate all report queries when fixtures change
        queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
        queryClient.invalidateQueries({ queryKey: ['goal-scorers'] });
        queryClient.invalidateQueries({ queryKey: ['player-playing-time'] });
        queryClient.invalidateQueries({ queryKey: ['competitions'] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'match_events'
      }, () => {
        // Invalidate goal scorers when events change
        queryClient.invalidateQueries({ queryKey: ['goal-scorers'] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'player_time_logs'
      }, () => {
        // Invalidate playing time when logs change
        queryClient.invalidateQueries({ queryKey: ['player-playing-time'] });
      })
      .subscribe();

    // Listen for manual refresh notifications (from pg_notify in triggers)
    const refreshChannel = supabase
      .channel('refresh_reports')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'pg_notify',
        table: 'refresh_reports'
      }, async () => {
        // Refresh materialized views when notified
        try {
          await supabase.rpc('refresh_report_views');
          // Invalidate all report queries after refresh
          queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
          queryClient.invalidateQueries({ queryKey: ['goal-scorers'] });
          queryClient.invalidateQueries({ queryKey: ['player-playing-time'] });
          queryClient.invalidateQueries({ queryKey: ['competitions'] });
        } catch (error) {
          console.error('Error refreshing report views:', error);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(refreshChannel);
    };
  }, [queryClient]);
}

/**
 * Hook to manually trigger a report refresh
 */
export function useManualReportRefresh() {
  const queryClient = useQueryClient();

  return async () => {
    try {
      // Refresh materialized views
      await supabase.rpc('refresh_report_views');
      
      // Invalidate all report queries
      await queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
      await queryClient.invalidateQueries({ queryKey: ['goal-scorers'] });
      await queryClient.invalidateQueries({ queryKey: ['player-playing-time'] });
      await queryClient.invalidateQueries({ queryKey: ['competitions'] });
      
      return true;
    } catch (error) {
      console.error('Error refreshing reports:', error);
      throw error;
    }
  };
}