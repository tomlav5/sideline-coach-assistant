-- Fix infinite recursion by creating a security definer function 
-- that bypasses RLS when checking club access

-- Create a function that bypasses RLS to check if user is admin
CREATE OR REPLACE FUNCTION public.user_is_club_admin(club_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.club_members 
    WHERE club_id = club_id_param 
    AND user_id = user_id_param
    AND role = 'admin'
  );
$$;

-- Update the club_members policy to avoid recursion
DROP POLICY IF EXISTS "Club admins can manage all members" ON public.club_members;

CREATE POLICY "Club admins can manage all members" 
ON public.club_members 
FOR ALL
USING (
  public.user_is_club_admin(club_id, auth.uid()) OR
  (auth.uid() = user_id AND NOT EXISTS (
    SELECT 1 FROM public.club_members 
    WHERE club_id = club_members.club_id
  ))
)
WITH CHECK (
  public.user_is_club_admin(club_id, auth.uid()) OR
  (auth.uid() = user_id AND NOT EXISTS (
    SELECT 1 FROM public.club_members 
    WHERE club_id = club_members.club_id
  ))
);