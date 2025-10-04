-- Fix remaining function search_path security issues

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_club_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.created_by = auth.uid();
  
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create club';
  END IF;
  
  RETURN NEW;
END;
$function$;