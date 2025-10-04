-- Phase 2: Create safe, non-recursive policies on club_members

-- Insert: only club admins can add members
CREATE POLICY "Club admins can add members"
ON public.club_members
FOR INSERT
TO authenticated
WITH CHECK (public.user_is_club_admin(club_id, auth.uid()));

-- Update: only club admins can update memberships
CREATE POLICY "Club admins can update memberships"
ON public.club_members
FOR UPDATE
TO authenticated
USING (public.user_is_club_admin(club_id, auth.uid()))
WITH CHECK (public.user_is_club_admin(club_id, auth.uid()));

-- Delete: only club admins can remove members
CREATE POLICY "Club admins can remove members"
ON public.club_members
FOR DELETE
TO authenticated
USING (public.user_is_club_admin(club_id, auth.uid()));

-- Select: a user can see their own membership rows or any row from clubs they belong to
CREATE POLICY "Users can view club memberships for their clubs"
ON public.club_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR public.user_is_club_member(club_id, auth.uid())
);
