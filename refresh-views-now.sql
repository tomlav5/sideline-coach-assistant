-- ============================================
-- Refresh Stale Materialized Views
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Refresh all materialized views
-- This will sync them with the current (empty) source tables

REFRESH MATERIALIZED VIEW analytics.mv_completed_matches;
REFRESH MATERIALIZED VIEW analytics.mv_goal_scorers;
REFRESH MATERIALIZED VIEW analytics.mv_player_playing_time;
REFRESH MATERIALIZED VIEW analytics.mv_competitions;

-- Step 2: Verify the refresh worked
-- All counts should return 0

SELECT 
  'Goal Scorers' as view_name,
  COUNT(*) as row_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Cleared'
    ELSE '❌ Still has data'
  END as status
FROM analytics.mv_goal_scorers

UNION ALL

SELECT 
  'Completed Matches',
  COUNT(*),
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Cleared'
    ELSE '❌ Still has data'
  END
FROM analytics.mv_completed_matches

UNION ALL

SELECT 
  'Player Playing Time',
  COUNT(*),
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Cleared'
    ELSE '❌ Still has data'
  END
FROM analytics.mv_player_playing_time

UNION ALL

SELECT 
  'Competitions',
  COUNT(*),
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Cleared'
    ELSE '❌ Still has data'
  END
FROM analytics.mv_competitions;

-- If all show "✅ Cleared", you're done!
-- If any still show data, check if the view definitions 
-- are reading from the correct source tables.
