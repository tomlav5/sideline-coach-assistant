import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CompletedMatch {
  id: string;
  scheduled_date: string;
  opponent_name: string;
  location: string;
  our_score: number;
  opponent_score: number;
  team_name: string;
  competition_type?: string;
  competition_name?: string;
}

interface GoalScorer {
  player_id: string;
  player_name: string;
  team_name: string;
  goals: number;
  assists: number;
  total_contributions: number;
  competition_type?: string;
  competition_name?: string;
}

interface PlayerPlayingTime {
  player_id: string;
  player_name: string;
  team_name: string;
  total_minutes: number;
  matches_played: number;
  average_minutes: number;
  competition_type?: string;
  competition_name?: string;
}

interface Competition {
  filter_value: string;
  display_name: string;
  competition_type?: string;
  competition_name?: string;
}

// Fetch completed matches with scores using optimized materialized view
export function useCompletedMatches(competitionFilter = 'all', options?: { enabled?: boolean, limit?: number, offset?: number }) {
  return useQuery({
    queryKey: ['completed-matches', competitionFilter, options?.limit, options?.offset],
    queryFn: async (): Promise<CompletedMatch[]> => {
      const { data, error } = await supabase.rpc('get_completed_matches');
      if (error) throw error;

      let filteredData = data || [];

      // Apply competition filter
      if (competitionFilter !== 'all') {
        if (competitionFilter.startsWith('type:')) {
          const type = competitionFilter.replace('type:', '');
          filteredData = filteredData.filter(match => match.competition_type === type);
        } else {
          filteredData = filteredData.filter(match => match.competition_name === competitionFilter);
        }
      }

      // Sort by date descending
      filteredData.sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());

      // Apply pagination
      if (options?.limit) {
        const start = options.offset || 0;
        filteredData = filteredData.slice(start, start + options.limit);
      }

      return filteredData.map(match => ({
        id: match.id,
        scheduled_date: match.scheduled_date,
        opponent_name: match.opponent_name,
        location: match.location || 'TBC',
        our_score: match.our_goals || 0,
        opponent_score: match.opponent_goals || 0,
        team_name: match.team_name || 'Unknown Team',
        competition_type: match.competition_type,
        competition_name: match.competition_name
      }));
    },
    staleTime: 15 * 60 * 1000, // Historical data stays fresh longer (15 min)
    gcTime: 60 * 60 * 1000,    // Keep in cache longer for historical data (1 hour)
    enabled: options?.enabled !== false,
  });
}

// Fetch goal scorers with stats using optimized materialized view
export function useGoalScorers(competitionFilter = 'all', options?: { enabled?: boolean, limit?: number, offset?: number }) {
  return useQuery({
    queryKey: ['goal-scorers', competitionFilter, options?.limit, options?.offset],
    queryFn: async (): Promise<GoalScorer[]> => {
      const { data, error } = await supabase.rpc('get_goal_scorers');
      if (error) throw error;

      // Process and aggregate data
      const playerStats: Record<string, GoalScorer> = {};

      (data || []).forEach((row: any) => {
        const playerId = row.player_id;
        
        if (!playerStats[playerId]) {
          playerStats[playerId] = {
            player_id: playerId,
            player_name: `${row.first_name} ${row.last_name}`,
            team_name: row.club_name, // Using club_name as team context
            goals: 0,
            assists: 0,
            total_contributions: 0,
          };
        }

        playerStats[playerId].goals = row.goals || 0;
        playerStats[playerId].assists = row.assists || 0;
        playerStats[playerId].total_contributions = (row.goals || 0) + (row.assists || 0);
      });

      let result = Object.values(playerStats)
        .sort((a, b) => b.total_contributions - a.total_contributions);

      // Apply pagination
      if (options?.limit) {
        const start = options.offset || 0;
        result = result.slice(start, start + options.limit);
      }

      return result;
    },
    staleTime: 15 * 60 * 1000, // Historical data stays fresh longer (15 min)
    gcTime: 60 * 60 * 1000,    // Keep in cache longer for historical data (1 hour)
    enabled: options?.enabled !== false,
  });
}

// Fetch player playing time stats using optimized materialized view
export function usePlayerPlayingTime(competitionFilter = 'all', options?: { enabled?: boolean, limit?: number, offset?: number }) {
  return useQuery({
    queryKey: ['player-playing-time', competitionFilter, options?.limit, options?.offset],
    queryFn: async (): Promise<PlayerPlayingTime[]> => {
      // Prefer v3 (uses match_periods caps). Fallback to v2 during rollout.
      let data: any = null;
      try {
        const v3 = await supabase.rpc('get_player_playing_time_v3' as any);
        if (v3.error) throw v3.error;
        data = v3.data;
      } catch (e) {
        const v2 = await supabase.rpc('get_player_playing_time_v2' as any);
        if (v2.error) throw v2.error;
        data = v2.data;
      }

      // Process and aggregate data
      const playerStats: Record<string, PlayerPlayingTime> = {};
      const rows: any[] = Array.isArray(data) ? (data as any[]) : ((data as any) ?? []);
      rows.forEach((row: any) => {
        const playerId = row.player_id;
        
        if (!playerStats[playerId]) {
          playerStats[playerId] = {
            player_id: playerId,
            player_name: `${row.first_name} ${row.last_name}`,
            team_name: row.team_name || row.club_name,
            total_minutes: 0,
            matches_played: 0,
            average_minutes: 0,
          };
        }

        playerStats[playerId].total_minutes = row.total_minutes_played || 0;
        playerStats[playerId].matches_played = row.matches_played || 0;
        playerStats[playerId].average_minutes = row.avg_minutes_per_match || 0;
      });

      let result = Object.values(playerStats)
        .sort((a, b) => b.total_minutes - a.total_minutes);

      // Apply pagination
      if (options?.limit) {
        const start = options.offset || 0;
        result = result.slice(start, start + options.limit);
      }

      return result;
    },
    staleTime: 15 * 60 * 1000, // Historical data stays fresh longer (15 min)
    gcTime: 60 * 60 * 1000,    // Keep in cache longer for historical data (1 hour)
    enabled: options?.enabled !== false,
  });
}

// Fetch available competitions using optimized materialized view
export function useCompetitions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['competitions'],
    queryFn: async (): Promise<Competition[]> => {
      const { data, error } = await supabase.rpc('get_competitions');
      if (error) throw error;

      return (data || []).map(comp => ({
        filter_value: comp.competition_name || `type:${comp.competition_type}`,
        display_name: comp.display_name,
        competition_type: comp.competition_type,
        competition_name: comp.competition_name
      }));
    },
    staleTime: 30 * 60 * 1000, // Competitions don't change often
    gcTime: 60 * 60 * 1000,    // Keep in cache for 1 hour
    enabled: options?.enabled !== false,
  });
}

// Hook to refresh materialized views when data changes
export function useRefreshReports() {
  return async () => {
    // Phase 2: Re-enabled with analytics infrastructure
    try {
      await supabase.rpc('refresh_report_views');
    } catch (error) {
      // Log but don't throw - views have auto-refresh triggers
      console.warn('Failed to refresh report views (non-critical):', error);
    }
  };
}