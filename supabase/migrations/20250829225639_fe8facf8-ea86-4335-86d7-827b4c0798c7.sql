-- Fix infinite recursion by using security definer functions for all membership checks

-- Create function to check if user is a member of a club (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_is_club_member(club_id_param uuid, user_id_param uuid)
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
  );
$$;

-- Create function to check if club has no members yet (bypasses RLS)
CREATE OR REPLACE FUNCTION public.club_has_no_members(club_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 
    FROM public.club_members 
    WHERE club_id = club_id_param
  );
$$;

-- Drop all existing policies on club_members
DROP POLICY IF EXISTS "Users can view club members where they belong" ON public.club_members;
DROP POLICY IF EXISTS "Users can add themselves as first member" ON public.club_members;
DROP POLICY IF EXISTS "Admins can manage all members" ON public.club_members;

-- Create new policies using security definer functions
CREATE POLICY "Users can view club members where they belong"
ON public.club_members
FOR SELECT
USING (public.user_is_club_member(club_id, auth.uid()));

CREATE POLICY "Users can add themselves as first member"
ON public.club_members
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  public.club_has_no_members(club_id)
);

CREATE POLICY "Admins can manage all members"
ON public.club_members
FOR ALL
USING (public.user_is_club_admin(club_id, auth.uid()))
WITH CHECK (public.user_is_club_admin(club_id, auth.uid()));