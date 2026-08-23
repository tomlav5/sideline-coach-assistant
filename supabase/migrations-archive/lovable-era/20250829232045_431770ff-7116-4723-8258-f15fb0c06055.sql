-- Fix the RLS policy to handle the case where created_by is set by trigger
-- Drop existing policies and recreate them properly
DROP POLICY IF EXISTS "Users can insert their own clubs" ON public.clubs;

-- Create insert policy that allows authenticated users to insert clubs
-- The trigger will set created_by automatically
CREATE POLICY "Authenticated users can create clubs"
ON public.clubs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Ensure the trigger exists and works correctly
CREATE OR REPLACE FUNCTION public.handle_club_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Set created_by to current user
  NEW.created_by = auth.uid();
  
  -- Ensure we have a valid user
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create club';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS handle_club_creation_trigger ON public.clubs;
CREATE TRIGGER handle_club_creation_trigger
  BEFORE INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.handle_club_creation();