-- COMPLETE RESET OF CLUB CREATION SYSTEM
-- First, let's completely clear all existing policies and triggers

-- Drop all existing policies on clubs table
DROP POLICY IF EXISTS "Users can insert their own clubs" ON public.clubs;
DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;
DROP POLICY IF EXISTS "Club admins can update clubs" ON public.clubs;
DROP POLICY IF EXISTS "Club members can view clubs" ON public.clubs;

-- Drop all existing triggers except the essential ones
DROP TRIGGER IF EXISTS handle_club_creation_trigger ON public.clubs;
DROP TRIGGER IF EXISTS clubs_creation_trigger ON public.clubs;

-- Create a simple, straightforward RLS policy for club creation
-- This allows any authenticated user to insert a club where they set themselves as created_by
CREATE POLICY "Authenticated users can create clubs"
ON public.clubs
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow insert if the created_by field matches the current user
  created_by = auth.uid()
);

-- Policy to view clubs where user is a member
CREATE POLICY "Users can view clubs they belong to"
ON public.clubs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM club_members 
    WHERE club_members.club_id = clubs.id 
    AND club_members.user_id = auth.uid()
  )
);

-- Policy to update clubs where user is admin
CREATE POLICY "Club admins can update clubs"
ON public.clubs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM club_members 
    WHERE club_members.club_id = clubs.id 
    AND club_members.user_id = auth.uid()
    AND club_members.role = 'admin'
  )
);

-- Ensure the add_club_creator_as_admin trigger still works
-- This trigger should run AFTER insert to add the creator as admin
CREATE OR REPLACE FUNCTION public.add_club_creator_as_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Add the creator as an admin member
  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  
  RETURN NEW;
END;
$$;

-- Create the trigger to add creator as admin
CREATE TRIGGER add_club_creator_as_admin_trigger
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.add_club_creator_as_admin();