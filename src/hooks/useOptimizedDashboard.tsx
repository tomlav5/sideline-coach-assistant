import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStats {
  upcomingFixtures: number;
  totalTeams: number;
  totalPlayers: number;
}

interface LiveMatchCheck {
  hasLiveMatch: boolean;
  liveMatchId: string | null;
}

// Optimized single query for all stats
export function useOptimizedDashboardStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async (): Promise<DashboardStats> => {
      // Use a single RPC call or optimized query
      const [fixturesResponse, teamsResponse, playersResponse] = await Promise.all([
        supabase
          .from('fixtures')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'scheduled')
          .gte('scheduled_date', new Date().toISOString()),
        supabase
          .from('teams')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('players')
          .select('id', { count: 'exact', head: true })
      ]);

      return {
        upcomingFixtures: fixturesResponse.count || 0,
        totalTeams: teamsResponse.count || 0,
        totalPlayers: playersResponse.count || 0,
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: false,
  });
}

// Optimized localStorage check with memoization
export function useLiveMatchCheck() {
  return useQuery({
    queryKey: ['live-match-check'],
    queryFn: (): LiveMatchCheck => {
      const matchKeys = [];
      const keyPattern = /^match_/;
      
      // More efficient localStorage iteration
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && keyPattern.test(key)) {
          matchKeys.push(key);
        }
      }

      let latest: { id: string; timestamp: number } | null = null;
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
            const id = key.replace('match_', '');
            if (!latest || timestamp > latest.timestamp) {
              latest = { id, timestamp };
            }
          }
        } catch {
          // Remove corrupted entries
          localStorage.removeItem(key);
        }
      }

      return {
        hasLiveMatch: !!latest,
        liveMatchId: latest?.id || null,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 60 * 1000, // Check every minute
    refetchOnWindowFocus: true,
  });
}