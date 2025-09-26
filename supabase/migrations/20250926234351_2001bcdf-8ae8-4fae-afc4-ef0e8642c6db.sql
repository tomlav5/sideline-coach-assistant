-- Fix remaining functions missing search_path security setting

CREATE OR REPLACE FUNCTION public.clean_match_storage_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- This function would ideally notify the frontend to clean localStorage
  -- Since we can't directly access localStorage from database, we'll rely on frontend cleanup
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_club_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Set created_by to current user
  NEW.created_by = auth.uid();
  
  -- Ensure we have a valid user
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create club';
  END IF;
  
  RETURN NEW;
END;
$function$;