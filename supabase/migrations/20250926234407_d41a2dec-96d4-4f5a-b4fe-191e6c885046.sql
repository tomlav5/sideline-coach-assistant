-- Fix the last function missing search_path security setting

CREATE OR REPLACE FUNCTION public.add_club_creator_as_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Add the creator as an admin member
  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  
  RETURN NEW;
END;
$function$;