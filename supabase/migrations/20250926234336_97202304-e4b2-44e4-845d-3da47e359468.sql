-- Fix critical security issues - Alternative approach for players_with_teams view

-- 1. Create a secure function to replace the insecure players_with_teams view
CREATE OR REPLACE FUNCTION public.get_players_with_teams_secure()
RETURNS TABLE(
  id uuid,
  club_id uuid,
  jersey_number integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  teams json,
  club_name text,
  first_name text,
  last_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.club_id,
    p.jersey_number,
    p.created_at,
    p.updated_at,
    COALESCE(
      json_agg(
        json_build_object(
          'id', t.id,
          'name', t.name,
          'team_type', t.team_type
        )
      ) FILTER (WHERE t.id IS NOT NULL), 
      '[]'::json
    ) as teams,
    c.name as club_name,
    p.first_name,
    p.last_name
  FROM public.players p
  JOIN public.clubs c ON p.club_id = c.id
  LEFT JOIN public.team_players tp ON p.id = tp.player_id
  LEFT JOIN public.teams t ON tp.team_id = t.id
  WHERE user_has_club_access(p.club_id, 'viewer'::user_role)
  GROUP BY p.id, p.club_id, p.jersey_number, p.created_at, p.updated_at, c.name, p.first_name, p.last_name;
$$;

-- 2. Fix database functions missing proper search_path security
CREATE OR REPLACE FUNCTION public.claim_match_tracking(fixture_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_tracker UUID;
  last_activity TIMESTAMP WITH TIME ZONE;
  timeout_minutes INTEGER := 5;
  result JSONB;
BEGIN
  SELECT active_tracker_id, last_activity_at 
  INTO current_tracker, last_activity
  FROM public.fixtures 
  WHERE id = fixture_id_param;
  
  IF current_tracker IS NOT NULL 
     AND current_tracker != auth.uid() 
     AND last_activity > (NOW() - INTERVAL '5 minutes') THEN
    
    SELECT jsonb_build_object(
      'success', false,
      'error', 'Match is already being tracked',
      'current_tracker', current_tracker,
      'tracking_started_at', (SELECT tracking_started_at FROM public.fixtures WHERE id = fixture_id_param)
    ) INTO result;
    
    RETURN result;
  END IF;
  
  UPDATE public.fixtures 
  SET 
    active_tracker_id = auth.uid(),
    tracking_started_at = NOW(),
    last_activity_at = NOW()
  WHERE id = fixture_id_param;
  
  SELECT jsonb_build_object(
    'success', true,
    'tracker_id', auth.uid(),
    'tracking_started_at', NOW()
  ) INTO result;
  
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_match_tracking(fixture_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.fixtures 
  SET 
    active_tracker_id = NULL,
    tracking_started_at = NULL,
    last_activity_at = NULL
  WHERE id = fixture_id_param 
    AND active_tracker_id = auth.uid();
    
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_tracking_activity(fixture_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.fixtures 
  SET last_activity_at = NOW()
  WHERE id = fixture_id_param 
    AND active_tracker_id = auth.uid();
    
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    PERFORM pg_notify('refresh_reports', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'timestamp', extract(epoch from now()),
        'record_id', COALESCE(NEW.id::text, OLD.id::text)
    )::text);
    RETURN COALESCE(NEW, OLD);
END;
$function$;