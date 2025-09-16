-- Security Review and Fix for Materialized Views
-- Issue: Materialized views are exposed via API without proper access control

-- Step 1: Remove materialized views from public API access
-- Since materialized views can't have RLS policies, we need to restrict API access

-- Remove public API access to materialized views by creating a separate schema
CREATE SCHEMA IF NOT EXISTS analytics;

-- Move materialized views to analytics schema (recreate them there)
DROP MATERIALIZED VIEW IF EXISTS public.mv_competitions;
DROP MATERIALIZED VIEW IF EXISTS public.mv_completed_matches;
DROP MATERIALIZED VIEW IF EXISTS public.mv_goal_scorers;
DROP MATERIALIZED VIEW IF EXISTS public.mv_player_playing_time;

-- Recreate materialized views in analytics schema (not exposed to API)
CREATE MATERIALIZED VIEW analytics.mv_competitions AS
SELECT DISTINCT
  competition_type,
  competition_name,
  CASE 
    WHEN competition_name IS NOT NULL AND competition_name != '' 
    THEN competition_name
    ELSE CASE competition_type
      WHEN 'league' THEN 'League Match'
      WHEN 'tournament' THEN 'Tournament'
      WHEN 'friendly' THEN 'Friendly'
      ELSE 'Unknown'
    END
  END as display_name
FROM public.fixtures
WHERE competition_name IS NOT NULL OR competition_type IS NOT NULL;

CREATE MATERIALIZED VIEW analytics.mv_completed_matches AS
SELECT 
  f.id,
  f.scheduled_date,
  f.opponent_name,
  f.location,
  f.fixture_type,
  f.competition_type,
  f.competition_name,
  t.name as team_name,
  c.name as club_name,
  COALESCE(our_goals.goal_count, 0) as our_goals,
  COALESCE(opponent_goals.goal_count, 0) as opponent_goals,
  f.created_at
FROM public.fixtures f
JOIN public.teams t ON f.team_id = t.id
JOIN public.clubs c ON t.club_id = c.id
LEFT JOIN (
  SELECT 
    fixture_id,
    COUNT(*) as goal_count
  FROM public.match_events 
  WHERE event_type = 'goal' AND is_our_team = true
  GROUP BY fixture_id
) our_goals ON f.id = our_goals.fixture_id
LEFT JOIN (
  SELECT 
    fixture_id,
    COUNT(*) as goal_count
  FROM public.match_events 
  WHERE event_type = 'goal' AND is_our_team = false
  GROUP BY fixture_id
) opponent_goals ON f.id = opponent_goals.fixture_id
WHERE f.status = 'completed';

CREATE MATERIALIZED VIEW analytics.mv_goal_scorers AS
SELECT 
  p.id as player_id,
  p.first_name,
  p.last_name,
  p.jersey_number,
  c.name as club_name,
  COUNT(me.id) as goals,
  COUNT(CASE WHEN me.is_penalty = true THEN 1 END) as penalty_goals,
  COUNT(assist_events.id) as assists
FROM public.players p
JOIN public.clubs c ON p.club_id = c.id
LEFT JOIN public.match_events me ON p.id = me.player_id AND me.event_type = 'goal' AND me.is_our_team = true
LEFT JOIN public.match_events assist_events ON p.id = assist_events.assist_player_id AND assist_events.event_type = 'goal' AND assist_events.is_our_team = true
GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, c.name
HAVING COUNT(me.id) > 0 OR COUNT(assist_events.id) > 0
ORDER BY goals DESC, assists DESC;

CREATE MATERIALIZED VIEW analytics.mv_player_playing_time AS
SELECT 
  p.id as player_id,
  p.first_name,
  p.last_name,
  p.jersey_number,
  c.name as club_name,
  t.name as team_name,
  COUNT(DISTINCT f.id) as matches_played,
  COALESCE(SUM(ptl.total_period_minutes), 0) as total_minutes_played,
  ROUND(AVG(ptl.total_period_minutes), 1) as avg_minutes_per_match
FROM public.players p
JOIN public.clubs c ON p.club_id = c.id
LEFT JOIN public.team_players tp ON p.id = tp.player_id
LEFT JOIN public.teams t ON tp.team_id = t.id
LEFT JOIN public.player_time_logs ptl ON p.id = ptl.player_id
LEFT JOIN public.fixtures f ON ptl.fixture_id = f.id AND f.status = 'completed'
GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, c.name, t.name
HAVING COUNT(DISTINCT f.id) > 0
ORDER BY total_minutes_played DESC;

-- Create indexes for performance
CREATE INDEX ON analytics.mv_competitions (competition_type);
CREATE INDEX ON analytics.mv_completed_matches (scheduled_date);
CREATE INDEX ON analytics.mv_goal_scorers (goals DESC);
CREATE INDEX ON analytics.mv_player_playing_time (total_minutes_played DESC);

-- Step 2: Create secure functions to access this data
-- These functions use SECURITY DEFINER to control access

CREATE OR REPLACE FUNCTION public.get_competitions()
RETURNS TABLE (
  competition_type text,
  competition_name text,
  display_name text
) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, analytics
AS $$
  SELECT 
    mv.competition_type::text,
    mv.competition_name,
    mv.display_name
  FROM analytics.mv_competitions mv;
$$;

CREATE OR REPLACE FUNCTION public.get_completed_matches()
RETURNS TABLE (
  id uuid,
  scheduled_date timestamp with time zone,
  opponent_name text,
  location text,
  fixture_type text,
  competition_type text,
  competition_name text,
  team_name text,
  club_name text,
  our_goals bigint,
  opponent_goals bigint,
  created_at timestamp with time zone
) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, analytics
AS $$
  SELECT 
    mv.id,
    mv.scheduled_date,
    mv.opponent_name,
    mv.location,
    mv.fixture_type::text,
    mv.competition_type::text,
    mv.competition_name,
    mv.team_name,
    mv.club_name,
    mv.our_goals,
    mv.opponent_goals,
    mv.created_at
  FROM analytics.mv_completed_matches mv;
$$;

CREATE OR REPLACE FUNCTION public.get_goal_scorers()
RETURNS TABLE (
  player_id uuid,
  first_name text,
  last_name text,
  jersey_number integer,
  club_name text,
  goals bigint,
  penalty_goals bigint,
  assists bigint
) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, analytics
AS $$
  SELECT 
    mv.player_id,
    mv.first_name,
    mv.last_name,
    mv.jersey_number,
    mv.club_name,
    mv.goals,
    mv.penalty_goals,
    mv.assists
  FROM analytics.mv_goal_scorers mv;
$$;

CREATE OR REPLACE FUNCTION public.get_player_playing_time()
RETURNS TABLE (
  player_id uuid,
  first_name text,
  last_name text,
  jersey_number integer,
  club_name text,
  team_name text,
  matches_played bigint,
  total_minutes_played numeric,
  avg_minutes_per_match numeric
) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, analytics
AS $$
  SELECT 
    mv.player_id,
    mv.first_name,
    mv.last_name,
    mv.jersey_number,
    mv.club_name,
    mv.team_name,
    mv.matches_played,
    mv.total_minutes_played,
    mv.avg_minutes_per_match
  FROM analytics.mv_player_playing_time mv;
$$;

-- Step 3: Update the refresh function to work with new schema
CREATE OR REPLACE FUNCTION public.refresh_report_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'analytics'
AS $$
BEGIN
    -- Refresh materialized views in analytics schema
    REFRESH MATERIALIZED VIEW analytics.mv_completed_matches;
    REFRESH MATERIALIZED VIEW analytics.mv_goal_scorers;
    REFRESH MATERIALIZED VIEW analytics.mv_player_playing_time;  
    REFRESH MATERIALIZED VIEW analytics.mv_competitions;
    
    -- Log the refresh for monitoring
    RAISE NOTICE 'Report views refreshed at %', now();
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA analytics TO postgres;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO postgres;
GRANT EXECUTE ON FUNCTION public.get_competitions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_completed_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_goal_scorers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_playing_time() TO authenticated;