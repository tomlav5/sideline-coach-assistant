-- Drop insecure views and replace with secure functions

-- Drop the views that cannot have RLS policies
DROP VIEW IF EXISTS public.teams_with_stats;
DROP VIEW IF EXISTS public.fixtures_with_scores;

-- Create secure function for teams with stats
CREATE OR REPLACE FUNCTION public.get_teams_with_stats_secure()
RETURNS TABLE (
  id uuid,
  club_id uuid,
  name text,
  team_type team_type,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  club_name text,
  player_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id,
    t.club_id,
    t.name,
    t.team_type,
    t.created_at,
    t.updated_at,
    c.name as club_name,
    COUNT(tp.player_id) as player_count
  FROM public.teams t
  JOIN public.clubs c ON t.club_id = c.id
  LEFT JOIN public.team_players tp ON t.id = tp.team_id
  WHERE user_has_club_access(t.club_id, 'viewer'::user_role)
  GROUP BY t.id, t.club_id, t.name, t.team_type, t.created_at, t.updated_at, c.name;
$$;

-- Create secure function for fixtures with scores
CREATE OR REPLACE FUNCTION public.get_fixtures_with_scores_secure()
RETURNS TABLE (
  id uuid,
  team_id uuid,
  opponent_name text,
  scheduled_date timestamp with time zone,
  location text,
  fixture_type fixture_type,
  competition_type competition_type,
  competition_name text,
  half_length integer,
  status match_status,
  match_status text,
  selected_squad_data jsonb,
  current_period_id uuid,
  match_state jsonb,
  is_retrospective boolean,
  active_tracker_id uuid,
  tracking_started_at timestamp with time zone,
  last_activity_at timestamp with time zone,
  team_name text,
  club_name text,
  our_goals bigint,
  opponent_goals bigint,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    f.id,
    f.team_id,
    f.opponent_name,
    f.scheduled_date,
    f.location,
    f.fixture_type,
    f.competition_type,
    f.competition_name,
    f.half_length,
    f.status,
    f.match_status,
    f.selected_squad_data,
    f.current_period_id,
    f.match_state,
    f.is_retrospective,
    f.active_tracker_id,
    f.tracking_started_at,
    f.last_activity_at,
    t.name as team_name,
    c.name as club_name,
    COALESCE(
      (SELECT COUNT(*) 
       FROM public.match_events 
       WHERE fixture_id = f.id 
         AND event_type = 'goal' 
         AND is_our_team = true),
      0
    ) as our_goals,
    COALESCE(
      (SELECT COUNT(*) 
       FROM public.match_events 
       WHERE fixture_id = f.id 
         AND event_type = 'goal' 
         AND is_our_team = false),
      0
    ) as opponent_goals,
    f.created_at,
    f.updated_at
  FROM public.fixtures f
  JOIN public.teams t ON f.team_id = t.id
  JOIN public.clubs c ON t.club_id = c.id
  WHERE user_has_club_access(t.club_id, 'viewer'::user_role);
$$;