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
      // Use optimized dashboard_stats view for single query
      const { data, error } = await supabase
        .from('dashboard_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      return {
        upcomingFixtures: data.upcoming_fixtures || 0,
        totalTeams: data.total_teams || 0,
        totalPlayers: data.total_players || 0,
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