-- Create a function to restart a match (reset all data and timers)
CREATE OR REPLACE FUNCTION public.restart_match(fixture_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user is the active tracker or if no one is tracking
  IF NOT EXISTS (
    SELECT 1 FROM public.fixtures 
    WHERE id = fixture_id_param 
    AND (active_tracker_id = auth.uid() OR active_tracker_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'You must be the active tracker to restart this match';
  END IF;

  -- Delete all match events
  DELETE FROM public.match_events WHERE fixture_id = fixture_id_param;
  
  -- Delete all player time logs
  DELETE FROM public.player_time_logs WHERE fixture_id = fixture_id_param;
  
  -- Delete all match periods
  DELETE FROM public.match_periods WHERE fixture_id = fixture_id_param;
  
  -- Reset all player match statuses to default (off field)
  UPDATE public.player_match_status 
  SET 
    is_on_field = false,
    position = null,
    last_action_minute = null,
    last_action_period_id = null,
    updated_at = now()
  WHERE fixture_id = fixture_id_param;
  
  -- Reset fixture to initial state
  UPDATE public.fixtures 
  SET 
    status = 'scheduled',
    match_status = 'not_started',
    current_period_id = null,
    match_state = '{"status": "not_started", "total_time_seconds": 0}'::jsonb,
    updated_at = now()
  WHERE id = fixture_id_param;
  
  RETURN TRUE;
END;
$function$;