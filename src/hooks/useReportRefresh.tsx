import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to automatically refresh report data when materialized views are updated
 * Uses debouncing to prevent excessive invalidations and optimize performance
 */
export function useReportRefresh() {
  const queryClient = useQueryClient();
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced invalidation function to prevent excessive cache invalidations
  const debouncedInvalidateReports = useCallback(async () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(async () => {
      // HOTFIX: Disabled - analytics schema and materialized views don't exist
      // TODO: Re-enable after Phase 2 database migration
      // try {
      //   await supabase.rpc('refresh_report_views');
      // } catch (error) {
      //   console.error('Error refreshing report views:', error);
      // }
      console.log('Skipping view refresh - analytics schema not yet created');
      
      // Invalidate query caches
      queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
      queryClient.invalidateQueries({ queryKey: ['goal-scorers'] });
      queryClient.invalidateQueries({ queryKey: ['player-playing-time'] });
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
    }, 2000); // 2 second debounce
  }, [queryClient]);

  const debouncedInvalidateScorers = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['goal-scorers'] });
    }, 1000); // 1 second debounce for more targeted updates
  }, [queryClient]);

  const debouncedInvalidatePlayingTime = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['player-playing-time'] });
    }, 1000); // 1 second debounce
  }, [queryClient]);

  useEffect(() => {
    // Subscribe to database notifications for report refreshes with debouncing
    const channel = supabase
      .channel('report-refresh')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fixtures'
      }, debouncedInvalidateReports)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'match_events'
      }, debouncedInvalidateScorers)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'player_time_logs'
      }, debouncedInvalidatePlayingTime)
      .subscribe();

    // Listen for pg_notify refresh signals from database triggers
    const notifyChannel = supabase
      .channel('refresh_notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public', 
        table: 'fixtures'
      }, (payload) => {
        console.log('Database notify received:', payload);
        debouncedInvalidateReports();
      })
      .subscribe();

    // Cleanup function
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      supabase.removeChannel(channel);
      supabase.removeChannel(notifyChannel);
    };
  }, [debouncedInvalidateReports, debouncedInvalidateScorers, debouncedInvalidatePlayingTime]);
}

/**
 * Hook to manually refresh report data
 * Returns a function that triggers materialized view refresh and invalidates caches
 */
export function useManualReportRefresh() {
  const queryClient = useQueryClient();
  
  return useCallback(async () => {
    // HOTFIX: Disabled - analytics schema and materialized views don't exist
    // TODO: Re-enable after Phase 2 database migration
    // try {
    //   await supabase.rpc('refresh_report_views');
    // } catch (refreshError) {
    //   console.warn('Failed to refresh report views (non-critical):', refreshError);
    // }
    console.log('Skipping manual view refresh - analytics schema not yet created');
    
    // Always invalidate caches
    queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
    queryClient.invalidateQueries({ queryKey: ['goal-scorers'] });
    queryClient.invalidateQueries({ queryKey: ['player-playing-time'] });
    queryClient.invalidateQueries({ queryKey: ['competitions'] });
    
    return true;
  }, [queryClient]);
}