-- =====================================================
-- Phase 2: Create Materialized Views
-- =====================================================
-- Purpose: Create materialized views for reporting and analytics
-- Dependencies: 20251208_create_analytics_schema.sql
-- Author: AI Assistant
-- Date: 2025-12-08

-- =====================================================
-- 1. Completed Matches View
-- =====================================================
-- Aggregates match results with goal counts
CREATE MATERIALIZED VIEW analytics.mv_completed_matches AS
SELECT 
  f.id AS fixture_id,
  f.scheduled_date,
  f.opponent_name,
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

-- Create unique index for efficient refresh
CREATE UNIQUE INDEX mv_completed_matches_fixture_id_idx ON analytics.mv_completed_matches (fixture_id);

-- Create additional indexes for common queries
CREATE INDEX mv_completed_matches_club_id_idx ON analytics.mv_completed_matches (club_id);
CREATE INDEX mv_completed_matches_scheduled_date_idx ON analytics.mv_completed_matches (scheduled_date DESC);

COMMENT ON MATERIALIZED VIEW analytics.mv_completed_matches IS 'Pre-aggregated view of completed matches with goal counts. Refreshed via refresh_report_views().';

-- =====================================================
-- 2. Goal Scorers View
-- =====================================================
-- Aggregates player statistics for goals and assists
CREATE MATERIALIZED VIEW analytics.mv_goal_scorers AS
SELECT 
  p.id AS player_id,
  p.first_name,
  p.last_name,
  p.jersey_number,
  t.id AS team_id,
  t.name AS team_name,
  c.id AS club_id,
  c.name AS club_name,
  -- Count goals
  COUNT(DISTINCT CASE WHEN me.event_type = 'goal' AND me.player_id = p.id THEN me.id END) AS goals,
  -- Count penalty goals
  COUNT(DISTINCT CASE WHEN me.event_type = 'goal' AND me.player_id = p.id AND me.is_penalty = true THEN me.id END) AS penalty_goals,
  -- Count assists
  COUNT(DISTINCT CASE WHEN me.event_type = 'goal' AND me.assist_player_id = p.id THEN me.id END) AS assists
FROM players p
JOIN teams t ON p.team_id = t.id
JOIN clubs c ON t.club_id = c.id
LEFT JOIN match_events me ON (me.player_id = p.id OR me.assist_player_id = p.id)
LEFT JOIN fixtures f ON me.fixture_id = f.id AND f.status = 'completed'
GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, t.id, t.name, c.id, c.name
HAVING COUNT(DISTINCT CASE WHEN me.event_type = 'goal' AND (me.player_id = p.id OR me.assist_player_id = p.id) THEN me.id END) > 0;

-- Create unique index
CREATE UNIQUE INDEX mv_goal_scorers_player_id_idx ON analytics.mv_goal_scorers (player_id);

-- Create additional indexes
CREATE INDEX mv_goal_scorers_club_id_idx ON analytics.mv_goal_scorers (club_id);
CREATE INDEX mv_goal_scorers_team_id_idx ON analytics.mv_goal_scorers (team_id);
CREATE INDEX mv_goal_scorers_goals_idx ON analytics.mv_goal_scorers (goals DESC);

COMMENT ON MATERIALIZED VIEW analytics.mv_goal_scorers IS 'Pre-aggregated player statistics for goals and assists. Only includes players with at least one goal or assist.';

-- =====================================================
-- 3. Player Playing Time View
-- =====================================================
-- Aggregates player playing time across matches
CREATE MATERIALIZED VIEW analytics.mv_player_playing_time AS
SELECT 
  p.id AS player_id,
  p.first_name,
  p.last_name,
  p.jersey_number,
  t.id AS team_id,
  t.name AS team_name,
  c.id AS club_id,
  c.name AS club_name,
  -- Count matches played
  COUNT(DISTINCT ptl.fixture_id) AS matches_played,
  -- Sum total minutes
  COALESCE(SUM(
    CASE 
      WHEN ptl.time_off_minute IS NOT NULL THEN ptl.time_off_minute - COALESCE(ptl.time_on_minute, 0)
      ELSE mp.planned_duration_minutes - COALESCE(ptl.time_on_minute, 0)
    END
  ), 0) AS total_minutes_played,
  -- Calculate average
  ROUND(
    COALESCE(SUM(
      CASE 
        WHEN ptl.time_off_minute IS NOT NULL THEN ptl.time_off_minute - COALESCE(ptl.time_on_minute, 0)
        ELSE mp.planned_duration_minutes - COALESCE(ptl.time_on_minute, 0)
      END
    ), 0) * 1.0 / NULLIF(COUNT(DISTINCT ptl.fixture_id), 0),
    1
  ) AS avg_minutes_per_match
FROM players p
JOIN teams t ON p.team_id = t.id
JOIN clubs c ON t.club_id = c.id
LEFT JOIN player_time_logs ptl ON ptl.player_id = p.id
LEFT JOIN match_periods mp ON ptl.period_id = mp.id
LEFT JOIN fixtures f ON ptl.fixture_id = f.id AND f.status = 'completed'
WHERE ptl.id IS NOT NULL
GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, t.id, t.name, c.id, c.name;

-- Create unique index
CREATE UNIQUE INDEX mv_player_playing_time_player_id_idx ON analytics.mv_player_playing_time (player_id);

-- Create additional indexes
CREATE INDEX mv_player_playing_time_club_id_idx ON analytics.mv_player_playing_time (club_id);
CREATE INDEX mv_player_playing_time_team_id_idx ON analytics.mv_player_playing_time (team_id);
CREATE INDEX mv_player_playing_time_total_minutes_idx ON analytics.mv_player_playing_time (total_minutes_played DESC);

COMMENT ON MATERIALIZED VIEW analytics.mv_player_playing_time IS 'Pre-aggregated player playing time statistics across all completed matches.';

-- =====================================================
-- 4. Competitions View
-- =====================================================
-- Lists unique competitions with match counts
CREATE MATERIALIZED VIEW analytics.mv_competitions AS
SELECT 
  f.competition_type,
  f.competition_name,
  COALESCE(f.competition_name, f.competition_type::text) AS display_name,
  COUNT(*) AS match_count,
  MIN(f.scheduled_date) AS first_match_date,
  MAX(f.scheduled_date) AS last_match_date
FROM fixtures f
WHERE f.status = 'completed'
AND (f.competition_type IS NOT NULL OR f.competition_name IS NOT NULL)
GROUP BY f.competition_type, f.competition_name;

-- Create unique index
CREATE UNIQUE INDEX mv_competitions_type_name_idx ON analytics.mv_competitions (competition_type, competition_name);

-- Create additional index
CREATE INDEX mv_competitions_match_count_idx ON analytics.mv_competitions (match_count DESC);

COMMENT ON MATERIALIZED VIEW analytics.mv_competitions IS 'List of unique competitions from completed matches with match counts.';

-- =====================================================
-- Grant Permissions
-- =====================================================
-- Grant SELECT on all materialized views to authenticated users
GRANT SELECT ON analytics.mv_completed_matches TO authenticated;
GRANT SELECT ON analytics.mv_goal_scorers TO authenticated;
GRANT SELECT ON analytics.mv_player_playing_time TO authenticated;
GRANT SELECT ON analytics.mv_competitions TO authenticated;

-- =====================================================
-- Initial Refresh
-- =====================================================
-- Populate the views with current data
REFRESH MATERIALIZED VIEW analytics.mv_completed_matches;
REFRESH MATERIALIZED VIEW analytics.mv_goal_scorers;
REFRESH MATERIALIZED VIEW analytics.mv_player_playing_time;
REFRESH MATERIALIZED VIEW analytics.mv_competitions;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Materialized views created and initially populated at %', now();
END $$;
