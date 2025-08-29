-- COMPREHENSIVE RLS POLICY FIX
-- Fix all recursive dependencies and restore proper security

-- 1. First, fix the clubs table policy
DROP POLICY IF EXISTS "Temporary - Anyone can create clubs" ON public.clubs;

-- Restore proper club creation policy using auth.role()
CREATE POLICY "Authenticated users can create clubs" 
ON public.clubs 
FOR INSERT 
TO authenticated
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL);

-- 2. Update user_has_club_access to use security definer to avoid recursion
CREATE OR REPLACE FUNCTION public.user_has_club_access(club_id_param uuid, required_role user_role DEFAULT 'viewer'::user_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.club_members 
    WHERE club_id = club_id_param 
    AND user_id = auth.uid()
    AND (
      role = 'admin' OR 
      (required_role = 'official' AND role IN ('admin', 'official')) OR
      (required_role = 'viewer' AND role IN ('admin', 'official', 'viewer'))
    )
  );
$$;

-- 3. Test if this resolves the policy issues by updating one policy at a time
-- Start with teams table which is simpler
DROP POLICY IF EXISTS "Club members can view teams" ON public.teams;
DROP POLICY IF EXISTS "Club officials can manage teams" ON public.teams;

CREATE POLICY "Club members can view teams"
ON public.teams
FOR SELECT
USING (public.user_is_club_member(club_id, auth.uid()));

CREATE POLICY "Club officials can manage teams"
ON public.teams
FOR ALL
USING (public.user_is_club_admin(club_id, auth.uid()))
WITH CHECK (public.user_is_club_admin(club_id, auth.uid()));