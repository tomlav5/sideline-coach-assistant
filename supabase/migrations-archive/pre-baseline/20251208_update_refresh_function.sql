-- =====================================================
-- Phase 2: Update refresh_report_views Function
-- =====================================================
-- Purpose: Update the RPC function to be more robust with proper error handling
-- Dependencies: 20251208_create_materialized_views.sql
-- Author: AI Assistant
-- Date: 2025-12-08

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.refresh_report_views();

-- Create improved function with error handling
CREATE OR REPLACE FUNCTION public.refresh_report_views() 
RETURNS void
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public', 'analytics'
AS $$
BEGIN
    -- Refresh materialized views concurrently for better performance
    -- CONCURRENTLY allows queries during refresh but requires unique indexes
    
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_completed_matches;
        RAISE NOTICE 'Refreshed mv_completed_matches';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to refresh mv_completed_matches: %', SQLERRM;
    END;
    
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_goal_scorers;
        RAISE NOTICE 'Refreshed mv_goal_scorers';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to refresh mv_goal_scorers: %', SQLERRM;
    END;
    
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_player_playing_time;
        RAISE NOTICE 'Refreshed mv_player_playing_time';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to refresh mv_player_playing_time: %', SQLERRM;
    END;
    
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_competitions;
        RAISE NOTICE 'Refreshed mv_competitions';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to refresh mv_competitions: %', SQLERRM;
    END;
    
    -- Log the refresh
    RAISE NOTICE 'Report views refresh completed at %', now();
    
    -- Note: Individual view failures are caught and logged but don't fail the whole function
    -- This ensures that if one view has issues, others can still refresh
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.refresh_report_views() TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.refresh_report_views() IS 'Refreshes all analytics materialized views concurrently with individual error handling. Safe to call frequently.';

-- Test the function
SELECT public.refresh_report_views();

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'refresh_report_views function updated successfully at %', now();
END $$;
