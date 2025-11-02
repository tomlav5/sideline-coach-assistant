import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface LiveMatchData {
  hasLiveMatch: boolean;
  liveMatchId: string | null;
  matchType: 'database' | 'localStorage' | null;
  isActiveTracker?: boolean;
  trackerInfo?: {
    activeTrackerId: string | null;
    trackingStartedAt: string | null;
  };
}

export function useLiveMatchDetection() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['live-match-detection', user?.id],
    queryFn: async (): Promise<LiveMatchData> => {
      if (!user) {
        return { hasLiveMatch: false, liveMatchId: null, matchType: null };
      }

      try {
        // Step 1: Find clubs the user belongs to
        const { data: memberships, error: clubsErr } = await supabase
          .from('club_members')
          .select('club_id')
          .eq('user_id', user.id);
        if (clubsErr) throw clubsErr;

        const clubIds = memberships?.map((m: any) => m.club_id) || [];

        // Step 2: Find teams in those clubs
        let teamIds: string[] = [];
        if (clubIds.length > 0) {
          const { data: teamsData, error: teamsErr } = await supabase
            .from('teams')
            .select('id, club_id')
            .in('club_id', clubIds);
          if (teamsErr) throw teamsErr;
          teamIds = (teamsData || []).map((t: any) => t.id);
        }

        // Step 3: Look for in-progress fixtures for those teams (support status or match_status)
        if (teamIds.length > 0) {
          const { data: inProgressMatches, error } = await supabase
            .from('fixtures')
            .select('id, scheduled_date, active_tracker_id, tracking_started_at, last_activity_at')
            .in('team_id', teamIds)
            .or('status.eq.in_progress,match_status.eq.in_progress')
            .order('scheduled_date', { ascending: false })
            .limit(1);

          if (error) throw error;

          if (inProgressMatches && inProgressMatches.length > 0) {
            const match = inProgressMatches[0];
            const isActiveTracker = match.active_tracker_id === user.id;
            
            return {
              hasLiveMatch: true,
              liveMatchId: match.id,
              matchType: 'database',
              isActiveTracker,
              trackerInfo: {
                activeTrackerId: match.active_tracker_id,
                trackingStartedAt: match.tracking_started_at
              }
            };
          }
        }

        // Step 4: If no database matches, check localStorage for resumable matches
        const matchKeys: string[] = [];
        const keyPattern = /^match_/;
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && keyPattern.test(key)) {
            matchKeys.push(key);
          }
        }

        let latestResumableMatch: { id: string; timestamp: number } | null = null;
        const now = Date.now();
        const twelveHours = 12 * 60 * 60 * 1000;

        // Ensure we have teamIds for access verification
        if (teamIds.length === 0 && clubIds.length > 0) {
          const { data: teamsData } = await supabase
            .from('teams')
            .select('id')
            .in('club_id', clubIds);
          teamIds = (teamsData || []).map((t: any) => t.id);
        }

        for (const key of matchKeys) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            
            const data = JSON.parse(raw);
            const timestamp = Number(data?.timestamp) || 0;
            const isCompleted = data?.gameState?.matchPhase === 'completed';
            const isFresh = now - timestamp < twelveHours;

            if (timestamp && isFresh && !isCompleted) {
              const fixtureId = key.replace('match_', '');
              
              // Verify the fixture exists and user has access via team -> club membership
              const { data: fixtureExists } = await supabase
                .from('fixtures')
                .select('id, team_id, match_status')
                .eq('id', fixtureId)
                .single();

              if (fixtureExists && teamIds.includes(fixtureExists.team_id)) {
                if ((fixtureExists as any).match_status === 'completed') {
                  localStorage.removeItem(key);
                  continue;
                }
                if (!latestResumableMatch || timestamp > latestResumableMatch.timestamp) {
                  latestResumableMatch = { id: fixtureId, timestamp };
                }
              } else {
                // Clean up inaccessible match data
                localStorage.removeItem(key);
              }
            } else if (isCompleted || !isFresh) {
              // Clean up old or completed matches
              localStorage.removeItem(key);
            }
          } catch {
            // Remove corrupted entries
            localStorage.removeItem(key);
          }
        }

        return {
          hasLiveMatch: !!latestResumableMatch,
          liveMatchId: latestResumableMatch?.id || null,
          matchType: latestResumableMatch ? 'localStorage' : null
        };
        
      } catch (error) {
        console.error('Error checking live matches:', error);
        return { hasLiveMatch: false, liveMatchId: null, matchType: null };
      }
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 60 * 1000, // Check every minute
    refetchOnWindowFocus: true,
  });
}