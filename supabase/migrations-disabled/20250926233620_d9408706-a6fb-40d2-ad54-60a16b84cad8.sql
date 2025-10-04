-- Remove overly permissive testing policies and implement proper club-based access controls

-- =============================================================================
-- CLUBS TABLE - Already has proper policies, just clean up testing policy
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated users - TESTING ONLY" ON public.clubs;

-- =============================================================================
-- CLUB_MEMBERS TABLE - Proper access control
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated users - club_members" ON public.club_members;

-- Club members can view memberships for clubs they belong to
CREATE POLICY "Users can view club memberships for their clubs" 
ON public.club_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.club_members cm2 
    WHERE cm2.club_id = club_members.club_id 
    AND cm2.user_id = auth.uid()
    AND cm2.role IN ('admin', 'official')
  )
);

-- Only club admins can insert new memberships
CREATE POLICY "Club admins can add members" 
ON public.club_members 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.club_members cm 
    WHERE cm.club_id = club_members.club_id 
    AND cm.user_id = auth.uid() 
    AND cm.role = 'admin'
  )
);

-- Only club admins can update memberships  
CREATE POLICY "Club admins can update memberships" 
ON public.club_members 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.club_members cm 
    WHERE cm.club_id = club_members.club_id 
    AND cm.user_id = auth.uid() 
    AND cm.role = 'admin'
  )
);

-- Only club admins can delete memberships
CREATE POLICY "Club admins can remove members" 
ON public.club_members 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.club_members cm 
    WHERE cm.club_id = club_members.club_id 
    AND cm.user_id = auth.uid() 
    AND cm.role = 'admin'
  )
);

-- =============================================================================
-- TEAMS TABLE - Club-based access control
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated users - teams" ON public.teams;

-- Users can view teams from clubs they're members of
CREATE POLICY "Users can view teams from their clubs" 
ON public.teams 
FOR SELECT 
USING (user_has_club_access(club_id, 'viewer'));

-- Club admins and officials can create teams
CREATE POLICY "Club admins and officials can create teams" 
ON public.teams 
FOR INSERT 
WITH CHECK (user_has_club_access(club_id, 'official'));

-- Club admins and officials can update teams
CREATE POLICY "Club admins and officials can update teams" 
ON public.teams 
FOR UPDATE 
USING (user_has_club_access(club_id, 'official'));

-- Only club admins can delete teams
CREATE POLICY "Club admins can delete teams" 
ON public.teams 
FOR DELETE 
USING (user_has_club_access(club_id, 'admin'));

-- =============================================================================
-- PLAYERS TABLE - Club-based access control
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated users - players" ON public.players;

-- Users can view players from clubs they're members of
CREATE POLICY "Users can view players from their clubs" 
ON public.players 
FOR SELECT 
USING (user_has_club_access(club_id, 'viewer'));

-- Club admins and officials can create players
CREATE POLICY "Club admins and officials can create players" 
ON public.players 
FOR INSERT 
WITH CHECK (user_has_club_access(club_id, 'official'));

-- Club admins and officials can update players
CREATE POLICY "Club admins and officials can update players" 
ON public.players 
FOR UPDATE 
USING (user_has_club_access(club_id, 'official'));

-- Only club admins can delete players
CREATE POLICY "Club admins can delete players" 
ON public.players 
FOR DELETE 
USING (user_has_club_access(club_id, 'admin'));

-- =============================================================================
-- TEAM_PLAYERS TABLE - Restrict to club members
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated users - team_players" ON public.team_players;

-- Users can view team assignments for clubs they're members of
CREATE POLICY "Users can view team assignments from their clubs" 
ON public.team_players 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.teams t 
    WHERE t.id = team_players.team_id 
    AND user_has_club_access(t.club_id, 'viewer')
  )
);

-- Club officials can manage team assignments
CREATE POLICY "Club officials can manage team assignments" 
ON public.team_players 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t 
    WHERE t.id = team_players.team_id 
    AND user_has_club_access(t.club_id, 'official')
  )
);

CREATE POLICY "Club officials can update team assignments" 
ON public.team_players 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.teams t 
    WHERE t.id = team_players.team_id 
    AND user_has_club_access(t.club_id, 'official')
  )
);

CREATE POLICY "Club officials can delete team assignments" 
ON public.team_players 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.teams t 
    WHERE t.id = team_players.team_id 
    AND user_has_club_access(t.club_id, 'official')
  )
);

-- =============================================================================
-- FIXTURES TABLE - Club-based access control
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated users - fixtures" ON public.fixtures;

-- Users can view fixtures for teams from their clubs
CREATE POLICY "Users can view fixtures from their clubs" 
ON public.fixtures 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.teams t 
    WHERE t.id = fixtures.team_id 
    AND user_has_club_access(t.club_id, 'viewer')
  )
);

-- Club officials can create fixtures
CREATE POLICY "Club officials can create fixtures" 
ON public.fixtures 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t 
    WHERE t.id = fixtures.team_id 
    AND user_has_club_access(t.club_id, 'official')
  )
);

-- Club officials can update fixtures
CREATE POLICY "Club officials can update fixtures" 
ON public.fixtures 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.teams t 
    WHERE t.id = fixtures.team_id 
    AND user_has_club_access(t.club_id, 'official')
  )
);

-- Only club admins can delete fixtures
CREATE POLICY "Club admins can delete fixtures" 
ON public.fixtures 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.teams t 
    WHERE t.id = fixtures.team_id 
    AND user_has_club_access(t.club_id, 'admin')
  )
);

-- =============================================================================
-- MATCH_PERIODS TABLE - Restrict to club members
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated users - match_periods" ON public.match_periods;

-- Users can view match periods for fixtures from their clubs
CREATE POLICY "Users can view match periods from their clubs" 
ON public.match_periods 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.fixtures f 
    JOIN public.teams t ON t.id = f.team_id 
    WHERE f.id = match_periods.fixture_id 
    AND user_has_club_access(t.club_id, 'viewer')
  )
);

-- Club officials can manage match periods
CREATE POLICY "Club officials can manage match periods" 
ON public.match_periods 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.fixtures f 
    JOIN public.teams t ON t.id = f.team_id 
    WHERE f.id = match_periods.fixture_id 
    AND user_has_club_access(t.club_id, 'official')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fixtures f 
    JOIN public.teams t ON t.id = f.team_id 
    WHERE f.id = match_periods.fixture_id 
    AND user_has_club_access(t.club_id, 'official')
  )
);

-- =============================================================================
-- MATCH_EVENTS TABLE - Restrict to club members
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated users - match_events" ON public.match_events;

-- Users can view match events for fixtures from their clubs
CREATE POLICY "Users can view match events from their clubs" 
ON public.match_events 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.fixtures f 
    JOIN public.teams t ON t.id = f.team_id 
    WHERE f.id = match_events.fixture_id 
    AND user_has_club_access(t.club_id, 'viewer')
  )
);

-- Club officials can manage match events
CREATE POLICY "Club officials can manage match events" 
ON public.match_events 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.fixtures f 
    JOIN public.teams t ON t.id = f.team_id 
    WHERE f.id = match_events.fixture_id 
    AND user_has_club_access(t.club_id, 'official')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fixtures f 
    JOIN public.teams t ON t.id = f.team_id 
    WHERE f.id = match_events.fixture_id 
    AND user_has_club_access(t.club_id, 'official')
  )
);

-- =============================================================================
-- PLAYER_TIME_LOGS TABLE - Restrict to club members
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated users - player_time_logs" ON public.player_time_logs;

-- Users can view player time logs for fixtures from their clubs
CREATE POLICY "Users can view player time logs from their clubs" 
ON public.player_time_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.fixtures f 
    JOIN public.teams t ON t.id = f.team_id 
    WHERE f.id = player_time_logs.fixture_id 
    AND user_has_club_access(t.club_id, 'viewer')
  )
);

-- Club officials can manage player time logs
CREATE POLICY "Club officials can manage player time logs" 
ON public.player_time_logs 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.fixtures f 
    JOIN public.teams t ON t.id = f.team_id 
    WHERE f.id = player_time_logs.fixture_id 
    AND user_has_club_access(t.club_id, 'official')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fixtures f 
    JOIN public.teams t ON t.id = f.team_id 
    WHERE f.id = player_time_logs.fixture_id 
    AND user_has_club_access(t.club_id, 'official')
  )
);

-- =============================================================================
-- PLAYER_MATCH_STATUS TABLE - Restrict to club members
-- =============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated users - player_match_status" ON public.player_match_status;

-- Users can view player match status for fixtures from their clubs
CREATE POLICY "Users can view player match status from their clubs" 
ON public.player_match_status 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.fixtures f 
    JOIN public.teams t ON t.id = f.team_id 
    WHERE f.id = player_match_status.fixture_id 
    AND user_has_club_access(t.club_id, 'viewer')
  )
);

-- Club officials can manage player match status
CREATE POLICY "Club officials can manage player match status" 
ON public.player_match_status 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.fixtures f 
    JOIN public.teams t ON t.id = f.team_id 
    WHERE f.id = player_match_status.fixture_id 
    AND user_has_club_access(t.club_id, 'official')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fixtures f 
    JOIN public.teams t ON t.id = f.team_id 
    WHERE f.id = player_match_status.fixture_id 
    AND user_has_club_access(t.club_id, 'official')
  )
);