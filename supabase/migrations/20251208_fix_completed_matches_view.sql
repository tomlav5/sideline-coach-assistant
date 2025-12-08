-- =====================================================
-- Fix: Update mv_completed_matches to Match RPC Function
-- =====================================================
-- Purpose: Add missing columns (id, location, fixture_type) that get_completed_matches() expects
-- Dependencies: 20251208_create_materialized_views.sql
-- Author: AI Assistant
-- Date: 2025-12-08

-- Drop and recreate the view with correct columns
DROP MATERIALIZED VIEW IF EXISTS analytics.mv_completed_matches CASCADE;

CREATE MATERIALIZED VIEW analytics.mv_completed_matches AS
SELECT 
  f.id AS id,                        -- Match RPC expectation (was fixture_id)
  f.scheduled_date,
  f.opponent_name,
  f.location,                        -- ADD: Missing column
  f.fixture_type,                    -- ADD: Missing column
  f.competition_type,
  f.competition_name,
  t.name AS team_name,
  t.team_type,
  c.name AS club_name,
  c.id AS club_id,
  -- Count our goals
  COALESCE(
    (SELECT COUNT(*) FROM match_events me 
     WHERE me.fixture_id = f.id 
     AND me.event_type = 'goal' 
     AND me.is_our_team = true), 
    0
  ) AS our_goals,
  -- Count opponent goals
  COALESCE(
    (SELECT COUNT(*) FROM match_events me 
     WHERE me.fixture_id = f.id 
     AND me.event_type = 'goal' 
     AND me.is_our_team = false), 
    0
  ) AS opponent_goals,
  f.created_at
FROM fixtures f
JOIN teams t ON f.team_id = t.id
JOIN clubs c ON t.club_id = c.id
WHERE f.status = 'completed';

-- Create unique index for efficient CONCURRENT refresh
CREATE UNIQUE INDEX mv_completed_matches_id_idx ON analytics.mv_completed_matches (id);

-- Create additional indexes for common queries
CREATE INDEX mv_completed_matches_club_id_idx ON analytics.mv_completed_matches (club_id);
CREATE INDEX mv_completed_matches_scheduled_date_idx ON analytics.mv_completed_matches (scheduled_date DESC);

-- Add comment
COMMENT ON MATERIALIZED VIEW analytics.mv_completed_matches IS 'Pre-aggregated view of completed matches with goal counts. Matches columns expected by get_completed_matches() RPC function.';

-- Grant permissions
GRANT SELECT ON analytics.mv_completed_matches TO authenticated;

-- Initial populate
REFRESH MATERIALIZED VIEW analytics.mv_completed_matches;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Fixed mv_completed_matches with correct columns at %', now();
END $$;
