-- Fix restart_match to avoid FK violation with fixtures.current_period_id -> match_periods.id
-- Clear current_period_id before deleting match_periods

CREATE OR REPLACE FUNCTION public.restart_match(fixture_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure only active tracker (or untracked match) can restart
  IF NOT EXISTS (
    SELECT 1 FROM public.fixtures 
    WHERE id = fixture_id_param 
      AND (active_tracker_id = auth.uid() OR active_tracker_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'You must be the active tracker to restart this match';
  END IF;

  -- 1) Clear the FK reference first to avoid 23503 on match_periods delete
  UPDATE public.fixtures
  SET current_period_id = NULL
  WHERE id = fixture_id_param;

  -- 2) Delete dependent rows (order matters for FK constraints to match_periods)
  DELETE FROM public.match_events WHERE fixture_id = fixture_id_param;
  DELETE FROM public.player_time_logs WHERE fixture_id = fixture_id_param;
  DELETE FROM public.match_periods WHERE fixture_id = fixture_id_param;

  -- 3) Reset player match statuses
  UPDATE public.player_match_status 
  SET 
    is_on_field = false,
    position = null,
    last_action_minute = null,
    last_action_period_id = null,
    updated_at = now()
  WHERE fixture_id = fixture_id_param;

  -- 4) Reset fixture to initial state (do this after deletions)
  UPDATE public.fixtures 
  SET 
    status = 'scheduled',
    match_status = 'not_started',
    match_state = '{"status": "not_started", "total_time_seconds": 0}'::jsonb,
    updated_at = now()
  WHERE id = fixture_id_param;

  RETURN TRUE;
END;
$function$;