-- Fix the club creation issue by:
-- 1. Updating club_members RLS to allow creators to add themselves as admin
-- 2. Simplifying the triggers to avoid auth issues

-- Update club_members RLS policy to allow creators to add themselves as admin
DROP POLICY IF EXISTS "Club admins can manage all members" ON public.club_members;

CREATE POLICY "Club admins can manage all members" 
ON public.club_members 
FOR ALL
USING (
  user_has_club_access(club_id, 'admin'::user_role) OR
  (auth.uid() = user_id AND NOT EXISTS (
    SELECT 1 FROM public.club_members 
    WHERE club_id = club_members.club_id
  ))
)
WITH CHECK (
  user_has_club_access(club_id, 'admin'::user_role) OR
  (auth.uid() = user_id AND NOT EXISTS (
    SELECT 1 FROM public.club_members 
    WHERE club_id = club_members.club_id
  ))
);

-- Simplify the club creation trigger to just set created_by
CREATE OR REPLACE FUNCTION public.handle_club_creation()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set created_by to current user if not already set
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

-- The admin creation trigger should work now with the updated RLS policy
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