import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Club {
  id: string;
  name: string;
  logo_url?: string;
  created_at: string;
}

interface DashboardStats {
  clubs: number;
  teams: number;
  players: number;
  upcomingFixtures: number;
}

interface ActiveMatch {
  id: string;
  scheduled_date: string;
  opponent_name: string;
  location: string | null;
  fixture_type: 'home' | 'away';
  match_status: string;
  team: {
    name: string;
  };
}

export function useDashboardData() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      // Fetch clubs with optimized query
      const { data: clubsData, error: clubsError } = await supabase
        .from('clubs')
        .select(`
          id,
          name,
          logo_url,
          created_at,
          club_members!inner(role),
          teams(
            id,
            players(id)
          )
        `)
        .eq('club_members.user_id', user.id);

      if (clubsError) throw clubsError;

      const clubs: Club[] = clubsData?.map(club => ({
        id: club.id,
        name: club.name,
        logo_url: club.logo_url,
        created_at: club.created_at
      })) || [];

      const clubIds = clubs.map(club => club.id);

      // Calculate stats from the already fetched data
      const teams = clubsData?.flatMap(club => club.teams) || [];
      const players = teams.flatMap(team => team.players || []);

      // Fetch upcoming fixtures
      const { data: fixturesData } = await supabase
        .from('fixtures')
        .select('id')
        .in('team_id', teams.map(t => t.id))
        .not('status', 'in', '(completed,cancelled)')
        .gte('scheduled_date', new Date().toISOString());

      const stats: DashboardStats = {
        clubs: clubs.length,
        teams: teams.length,
        players: players.length,
        upcomingFixtures: fixturesData?.length || 0
      };

      // Check for active matches
      let activeMatch: ActiveMatch | null = null;

      if (clubIds.length > 0) {
        // Check for in-progress matches
        const { data: inProgressMatches } = await supabase
          .from('fixtures')
          .select(`
            id,
            scheduled_date,
            opponent_name,
            location,
            fixture_type,
            match_status,
            team:teams!inner(
              name,
              club_id
            )
          `)
          .in('teams.club_id', clubIds)
          .eq('match_status', 'in_progress')
          .order('scheduled_date', { ascending: false })
          .limit(1);

        if (inProgressMatches && inProgressMatches.length > 0) {
          activeMatch = inProgressMatches[0];
        } else {
          // Check localStorage for resumable matches
          const localStorageKeys = Object.keys(localStorage).filter(key => key.startsWith('match_'));
          for (const key of localStorageKeys) {
            try {
              const fixtureId = key.replace('match_', '');
              const stored = localStorage.getItem(key);
              if (stored) {
                const matchData = JSON.parse(stored);
                const timeSinceLastSave = Date.now() - matchData.timestamp;
                
                if (timeSinceLastSave < 12 * 60 * 60 * 1000 && matchData.gameState?.matchPhase !== 'completed') {
                  const { data: fixtureData } = await supabase
                    .from('fixtures')
                    .select(`
                      id,
                      scheduled_date,
                      opponent_name,
                      location,
                      fixture_type,
                      match_status,
                      team:teams!inner(
                        name,
                        club_id
                      )
                    `)
                    .eq('id', fixtureId)
                    .in('teams.club_id', clubIds)
                    .single();

                  if (fixtureData) {
                    activeMatch = fixtureData;
                    break;
                  } else {
                    localStorage.removeItem(key);
                  }
                } else {
                  localStorage.removeItem(key);
                }
              }
            } catch (error) {
              localStorage.removeItem(key);
            }
          }
        }
      }

      return {
        clubs,
        stats,
        activeMatch
      };
    },
    enabled: !!user,
    staleTime: 1 * 60 * 1000, // 1 minute - dashboard should be relatively fresh
  });
}