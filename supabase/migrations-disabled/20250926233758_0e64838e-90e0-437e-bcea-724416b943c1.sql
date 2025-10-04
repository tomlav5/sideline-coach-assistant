-- Fix dashboard_stats security by creating a secure function instead of relying on the view

-- Drop the existing dashboard_stats view since we can't secure it properly
DROP VIEW IF EXISTS public.dashboard_stats;

-- Create a secure function that returns dashboard stats for the current user only
CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats()
RETURNS TABLE(
  user_id uuid,
  total_clubs bigint,
  total_teams bigint, 
  total_players bigint,
  upcoming_fixtures bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    auth.uid() as user_id,
    count(DISTINCT c.id) AS total_clubs,
    count(DISTINCT t.id) AS total_teams,
    count(DISTINCT p.id) AS total_players,
    count(DISTINCT
        CASE
            WHEN f.status = 'scheduled'::match_status AND f.scheduled_date >= now() THEN f.id
            ELSE NULL::uuid
        END) AS upcoming_fixtures
   FROM club_members cm
     JOIN clubs c ON cm.club_id = c.id
     LEFT JOIN teams t ON c.id = t.club_id
     LEFT JOIN players p ON c.id = p.club_id
     LEFT JOIN fixtures f ON t.id = f.team_id
  WHERE cm.user_id = auth.uid()
  GROUP BY cm.user_id;
$$;