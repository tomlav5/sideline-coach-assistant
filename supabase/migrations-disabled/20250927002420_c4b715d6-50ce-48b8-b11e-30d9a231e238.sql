-- Phase 1: Drop existing recursive policies on club_members
DROP POLICY IF EXISTS "Club admins can add members" ON public.club_members;
DROP POLICY IF EXISTS "Club admins can remove members" ON public.club_members;
DROP POLICY IF EXISTS "Club admins can update memberships" ON public.club_members;
DROP POLICY IF EXISTS "Users can view club memberships for their clubs" ON public.club_members;