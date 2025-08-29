-- Fix RLS policies for better authentication handling

-- 1. Fix clubs table RLS - allow authenticated users to create clubs without specifying created_by
DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;

CREATE POLICY "Authenticated users can create clubs" 
ON public.clubs 
FOR INSERT 
TO authenticated
WITH CHECK (
  created_by = auth.uid()
);

-- 2. Ensure all users can view clubs they're members of (fix the existing policy)
DROP POLICY IF EXISTS "Club members can view clubs" ON public.clubs;

CREATE POLICY "Club members can view clubs" 
ON public.clubs 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_members 
    WHERE club_id = clubs.id 
    AND user_id = auth.uid()
  )
);

-- 3. Update clubs table to auto-set created_by if not provided
CREATE OR REPLACE FUNCTION public.handle_club_creation()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS clubs_creation_trigger ON public.clubs;

CREATE TRIGGER clubs_creation_trigger
  BEFORE INSERT ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_club_creation();

-- 4. Fix club_members RLS policies to be more explicit
DROP POLICY IF EXISTS "Club admins can manage members" ON public.club_members;
DROP POLICY IF EXISTS "Club members can view club members" ON public.club_members;

CREATE POLICY "Club members can view all club members" 
ON public.club_members 
FOR SELECT 
TO authenticated
USING (
  user_has_club_access(club_id, 'viewer'::user_role)
);

CREATE POLICY "Club admins can manage all members" 
ON public.club_members 
FOR ALL
TO authenticated
USING (
  user_has_club_access(club_id, 'admin'::user_role)
)
WITH CHECK (
  user_has_club_access(club_id, 'admin'::user_role)
);

-- 5. Fix profiles table to ensure users have profiles after signup
-- This trigger should already exist, but let's make sure it's working
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
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
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Test that auth.uid() is working by creating a helper function
CREATE OR REPLACE FUNCTION public.debug_auth()
RETURNS TABLE (
  current_user_id uuid,
  is_authenticated boolean,
  profile_exists boolean
) 
LANGUAGE sql 
SECURITY DEFINER
AS $$
  SELECT 
    auth.uid() as current_user_id,
    auth.uid() IS NOT NULL as is_authenticated,
    EXISTS(SELECT 1 FROM public.profiles WHERE user_id = auth.uid()) as profile_exists;
$$;