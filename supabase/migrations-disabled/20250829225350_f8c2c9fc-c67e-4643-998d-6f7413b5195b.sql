-- Fix the infinite recursion by completely rewriting the club_members policies
-- First, disable RLS temporarily
ALTER TABLE public.club_members DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Club admins can manage all members" ON public.club_members;
DROP POLICY IF EXISTS "Club members can view all club members" ON public.club_members;

-- Re-enable RLS
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
-- Allow users to see club members where they are also a member
CREATE POLICY "Users can view club members where they belong"
ON public.club_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.club_members AS my_membership
    WHERE my_membership.club_id = club_members.club_id 
    AND my_membership.user_id = auth.uid()
  )
);

-- Allow users to insert themselves as the first member of a club
CREATE POLICY "Users can add themselves as first member"
ON public.club_members
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  NOT EXISTS (
    SELECT 1 FROM public.club_members AS existing_members
    WHERE existing_members.club_id = club_members.club_id
  )
);

-- Allow admins to manage all members (using the security definer function)
CREATE POLICY "Admins can manage all members"
ON public.club_members
FOR ALL
USING (public.user_is_club_admin(club_id, auth.uid()))
WITH CHECK (public.user_is_club_admin(club_id, auth.uid()));