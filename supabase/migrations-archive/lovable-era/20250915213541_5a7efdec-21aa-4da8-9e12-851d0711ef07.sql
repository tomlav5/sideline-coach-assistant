-- Fix security issues with views by adding proper RLS policies

-- First, drop the views that have security issues
DROP VIEW IF EXISTS players_with_teams;
DROP VIEW IF EXISTS teams_with_stats; 
DROP VIEW IF EXISTS dashboard_stats;
DROP VIEW IF EXISTS fixtures_with_scores;

-- Create views with proper security context (SECURITY INVOKER is default)
CREATE VIEW players_with_teams 
WITH (security_invoker = true) AS
SELECT 
  p.*,
  c.name as club_name,
  COALESCE(
    json_agg(
      json_build_object(
        'id', t.id,
        'name', t.name,
        'team_type', t.team_type,
        'club_id', t.club_id
      )
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'::json
  ) as teams
FROM players p
JOIN clubs c ON p.club_id = c.id
LEFT JOIN team_players tp ON p.id = tp.player_id
LEFT JOIN teams t ON tp.team_id = t.id
GROUP BY p.id, c.name;

CREATE VIEW teams_with_stats 
WITH (security_invoker = true) AS
SELECT 
  t.*,
  c.name as club_name,
  COALESCE(COUNT(tp.player_id), 0) as player_count
FROM teams t
JOIN clubs c ON t.club_id = c.id
LEFT JOIN team_players tp ON t.id = tp.team_id
GROUP BY t.id, c.name;

CREATE VIEW dashboard_stats 
WITH (security_invoker = true) AS
SELECT 
  cm.user_id,
  COUNT(DISTINCT c.id) as total_clubs,
  COUNT(DISTINCT t.id) as total_teams,
  COUNT(DISTINCT p.id) as total_players,
  COUNT(DISTINCT CASE 
    WHEN f.status = 'scheduled' AND f.scheduled_date >= NOW() 
    THEN f.id 
  END) as upcoming_fixtures
FROM club_members cm
JOIN clubs c ON cm.club_id = c.id
LEFT JOIN teams t ON c.id = t.club_id
LEFT JOIN players p ON c.id = p.club_id
LEFT JOIN fixtures f ON t.id = f.team_id
GROUP BY cm.user_id;

CREATE VIEW fixtures_with_scores 
WITH (security_invoker = true) AS
SELECT 
  f.*,
  t.name as team_name,
  c.name as club_name,
  COALESCE(our_goals.goal_count, 0) as our_goals,
  COALESCE(opponent_goals.goal_count, 0) as opponent_goals
FROM fixtures f
JOIN teams t ON f.team_id = t.id
JOIN clubs c ON t.club_id = c.id
LEFT JOIN (
  SELECT 
    fixture_id,
    COUNT(*) as goal_count
  FROM match_events 
  WHERE event_type = 'goal' AND is_our_team = true
  GROUP BY fixture_id
) our_goals ON f.id = our_goals.fixture_id
LEFT JOIN (
  SELECT 
    fixture_id,
    COUNT(*) as goal_count
  FROM match_events 
  WHERE event_type = 'goal' AND is_our_team = false
  GROUP BY fixture_id
) opponent_goals ON f.id = opponent_goals.fixture_id;