-- Fix RLS policy for clubs table to properly recognize authenticated users
-- Drop the current policy and create a new one using auth.role()

DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;

CREATE POLICY "Authenticated users can create clubs" 
ON public.clubs 
FOR INSERT 
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- Also update the trigger to ensure the creator is automatically added as admin
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
    RAISE EXCEPTION 'No authenticated user found';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create a trigger that runs after club creation to add the creator as admin
CREATE OR REPLACE FUNCTION public.add_club_creator_as_admin()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add the creator as an admin member
  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS handle_club_creation_trigger ON public.clubs;
DROP TRIGGER IF EXISTS add_club_admin_trigger ON public.clubs;

CREATE TRIGGER handle_club_creation_trigger
  BEFORE INSERT ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_club_creation();

CREATE TRIGGER add_club_admin_trigger
  AFTER INSERT ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.add_club_creator_as_admin();