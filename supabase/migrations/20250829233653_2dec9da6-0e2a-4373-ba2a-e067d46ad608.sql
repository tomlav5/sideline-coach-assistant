-- APPLY PERMISSIVE RLS POLICIES TO ALL TABLES TO ENABLE FUNCTIONALITY

-- 1. Fix Storage RLS for logo uploads
-- Drop existing storage policies
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload club logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view club logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view club logos" ON storage.objects;

-- Create permissive storage policies
CREATE POLICY "Allow all storage operations for authenticated users"
ON storage.objects
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Also allow public read access to club-assets bucket
CREATE POLICY "Public read access to club assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'club-assets');

-- 2. Apply permissive policies to all other tables
-- Club Members table
ALTER TABLE public.club_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view club members where they belong" ON public.club_members;
DROP POLICY IF EXISTS "Users can add themselves as first member" ON public.club_members;
DROP POLICY IF EXISTS "Admins can manage all members" ON public.club_members;

CREATE POLICY "Allow all for authenticated users - club_members"
ON public.club_members
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Teams table
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view teams" ON public.teams;
DROP POLICY IF EXISTS "Club officials can manage teams" ON public.teams;

CREATE POLICY "Allow all for authenticated users - teams"
ON public.teams
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Players table
ALTER TABLE public.players DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view players" ON public.players;
DROP POLICY IF EXISTS "Club officials can manage players" ON public.players;

CREATE POLICY "Allow all for authenticated users - players"
ON public.players
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Team Players table
ALTER TABLE public.team_players DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view team players" ON public.team_players;
DROP POLICY IF EXISTS "Club officials can manage team players" ON public.team_players;

CREATE POLICY "Allow all for authenticated users - team_players"
ON public.team_players
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Fixtures table
ALTER TABLE public.fixtures DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Club officials can manage fixtures" ON public.fixtures;

CREATE POLICY "Allow all for authenticated users - fixtures"
ON public.fixtures
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Match Events table
ALTER TABLE public.match_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view match events" ON public.match_events;
DROP POLICY IF EXISTS "Club officials can manage match events" ON public.match_events;

CREATE POLICY "Allow all for authenticated users - match_events"
ON public.match_events
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Player Time Logs table
ALTER TABLE public.player_time_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view player time logs" ON public.player_time_logs;
DROP POLICY IF EXISTS "Club officials can manage player time logs" ON public.player_time_logs;

CREATE POLICY "Allow all for authenticated users - player_time_logs"
ON public.player_time_logs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);