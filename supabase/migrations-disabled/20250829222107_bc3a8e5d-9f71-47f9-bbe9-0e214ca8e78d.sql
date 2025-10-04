-- Fix search_path security warnings for all functions

-- 1. Fix user_has_club_access function
CREATE OR REPLACE FUNCTION public.user_has_club_access(club_id_param uuid, required_role user_role DEFAULT 'viewer'::user_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.club_members 
    WHERE club_id = club_id_param 
    AND user_id = auth.uid()
    AND (
      role = 'admin' OR 
      (required_role = 'official' AND role IN ('admin', 'official')) OR
      (required_role = 'viewer' AND role IN ('admin', 'official', 'viewer'))
    )
  );
$function$;

-- 2. Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- 3. Fix handle_club_creation function
CREATE OR REPLACE FUNCTION public.handle_club_creation()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-set created_by to current user if not provided
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  
  -- Ensure created_by matches current user for security
  IF NEW.created_by != auth.uid() THEN
    RAISE EXCEPTION 'created_by must match authenticated user';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Fix debug_auth function
CREATE OR REPLACE FUNCTION public.debug_auth()
RETURNS TABLE (
  current_user_id uuid,
  is_authenticated boolean,
  profile_exists boolean
) 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    auth.uid() as current_user_id,
    auth.uid() IS NOT NULL as is_authenticated,
    EXISTS(SELECT 1 FROM public.profiles WHERE user_id = auth.uid()) as profile_exists;
$$;