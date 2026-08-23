-- Refresh all stale materialized views to match current database state
-- This fixes the issue where views contain old data after manual database clearing

-- Refresh all analytics materialized views
REFRESH MATERIALIZED VIEW analytics.mv_completed_matches;
REFRESH MATERIALIZED VIEW analytics.mv_goal_scorers;
REFRESH MATERIALIZED VIEW analytics.mv_player_playing_time;
REFRESH MATERIALIZED VIEW analytics.mv_competitions;

-- Log the refresh
DO $$
BEGIN
    RAISE NOTICE 'Materialized views refreshed at %', now();
END $$;
