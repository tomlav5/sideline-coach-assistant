-- Fix search path security issue for claim_match_tracking function
CREATE OR REPLACE FUNCTION public.claim_match_tracking(fixture_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_tracker UUID;
  last_activity TIMESTAMP WITH TIME ZONE;
  timeout_minutes INTEGER := 5; -- 5 minute timeout
  result JSONB;
BEGIN
  -- Get current tracker info
  SELECT active_tracker_id, last_activity_at 
  INTO current_tracker, last_activity
  FROM public.fixtures 
  WHERE id = fixture_id_param;
  
  -- Check if someone else is actively tracking (within timeout)
  IF current_tracker IS NOT NULL 
     AND current_tracker != auth.uid() 
     AND last_activity > (NOW() - INTERVAL '5 minutes') THEN
    
    -- Return info about current tracker
    SELECT jsonb_build_object(
      'success', false,
      'error', 'Match is already being tracked',
      'current_tracker', current_tracker,
      'tracking_started_at', (SELECT tracking_started_at FROM public.fixtures WHERE id = fixture_id_param)
    ) INTO result;
    
    RETURN result;
  END IF;
  
  -- Claim the match for current user
  UPDATE public.fixtures 
  SET 
    active_tracker_id = auth.uid(),
    tracking_started_at = NOW(),
    last_activity_at = NOW()
  WHERE id = fixture_id_param;
  
  -- Return success
  SELECT jsonb_build_object(
    'success', true,
    'tracker_id', auth.uid(),
    'tracking_started_at', NOW()
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Fix search path security issue for update_tracking_activity function
CREATE OR REPLACE FUNCTION public.update_tracking_activity(fixture_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.fixtures 
  SET last_activity_at = NOW()
  WHERE id = fixture_id_param 
    AND active_tracker_id = auth.uid();
    
  RETURN FOUND;
END;
$$;

-- Fix search path security issue for release_match_tracking function  
CREATE OR REPLACE FUNCTION public.release_match_tracking(fixture_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;