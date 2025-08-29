-- COMPREHENSIVE RLS POLICY REVIEW AND FIX
-- Step 1: Fix the clubs table policy properly

-- Drop the existing policy first 
DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;

-- Create a proper club creation policy
CREATE POLICY "Authenticated users can create clubs" 
ON public.clubs 
FOR INSERT 
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- Step 2: Now I'll review and document the team and player functionality
-- Let's test the current setup by ensuring all security definer functions are working

-- Verify the club creation trigger is simple and working
CREATE OR REPLACE FUNCTION public.handle_club_creation()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
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