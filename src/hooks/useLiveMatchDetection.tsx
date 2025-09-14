import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface LiveMatchData {
  hasLiveMatch: boolean;
  liveMatchId: string | null;
  matchType: 'database' | 'localStorage' | null;
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
        // First check for in_progress matches in database
        const { data: inProgressMatches, error } = await supabase
          .from('fixtures')
          .select(`
            id,
            teams!fk_fixtures_team_id(
              club_id,
              club_members!inner(user_id)
            )
          `)
          .eq('match_status', 'in_progress')
          .eq('teams.club_members.user_id', user.id)
          .order('scheduled_date', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (inProgressMatches && inProgressMatches.length > 0) {
          return {
            hasLiveMatch: true,
            liveMatchId: inProgressMatches[0].id,
            matchType: 'database'
          };
        }

        // If no database matches, check localStorage for resumable matches
        const matchKeys = [];
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
              
              // Verify the fixture exists and user has access
              const { data: fixtureExists } = await supabase
                .from('fixtures')
                .select(`
                  id,
                  teams!fk_fixtures_team_id(
                    club_id,
                    club_members!inner(user_id)
                  )
                `)
                .eq('id', fixtureId)
                .eq('teams.club_members.user_id', user.id)
                .single();

              if (fixtureExists) {
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