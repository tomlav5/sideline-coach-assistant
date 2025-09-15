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
      let query = supabase
        .from('mv_completed_matches')
        .select('*')
        .order('scheduled_date', { ascending: false });

      // Apply competition filter
      if (competitionFilter !== 'all') {
        if (competitionFilter.startsWith('type:')) {
          const type = competitionFilter.replace('type:', '');
          query = query.eq('competition_type', type);
        } else {
          query = query.eq('competition_name', competitionFilter);
        }
      }

      // Apply pagination
      if (options?.limit) {
        query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(match => ({
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
    staleTime: 10 * 60 * 1000, // Historical data stays fresh longer
    gcTime: 30 * 60 * 1000,    // Keep in cache longer for historical data
    enabled: options?.enabled !== false,
  });
}

// Fetch goal scorers with stats using optimized materialized view
export function useGoalScorers(competitionFilter = 'all', options?: { enabled?: boolean, limit?: number, offset?: number }) {
  return useQuery({
    queryKey: ['goal-scorers', competitionFilter, options?.limit, options?.offset],
    queryFn: async (): Promise<GoalScorer[]> => {
      let query = supabase
        .from('mv_goal_scorers')
        .select('*')
        .order('total_contributions', { ascending: false });

      // Apply competition filter
      if (competitionFilter !== 'all') {
        if (competitionFilter.startsWith('type:')) {
          const type = competitionFilter.replace('type:', '');
          query = query.eq('competition_type', type);
        } else {
          query = query.eq('competition_name', competitionFilter);
        }
      }

      // Apply pagination
      if (options?.limit) {
        query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Aggregate by player (in case player appears in multiple competitions)
      const playerStats: Record<string, GoalScorer> = {};

      (data || []).forEach((row: any) => {
        const playerId = row.player_id;
        
        if (!playerStats[playerId]) {
          playerStats[playerId] = {
            player_id: playerId,
            player_name: row.player_name,
            team_name: row.team_name,
            goals: 0,
            assists: 0,
            total_contributions: 0,
            competition_type: row.competition_type,
            competition_name: row.competition_name
          };
        }

        playerStats[playerId].goals += row.goals || 0;
        playerStats[playerId].assists += row.assists || 0;
        playerStats[playerId].total_contributions += row.total_contributions || 0;
      });

      return Object.values(playerStats)
        .sort((a, b) => b.total_contributions - a.total_contributions);
    },
    staleTime: 10 * 60 * 1000, // Historical data stays fresh longer
    gcTime: 30 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
}

// Fetch player playing time stats using optimized materialized view
export function usePlayerPlayingTime(competitionFilter = 'all', options?: { enabled?: boolean, limit?: number, offset?: number }) {
  return useQuery({
    queryKey: ['player-playing-time', competitionFilter, options?.limit, options?.offset],
    queryFn: async (): Promise<PlayerPlayingTime[]> => {
      let query = supabase
        .from('mv_player_playing_time')
        .select('*')
        .order('total_minutes', { ascending: false });

      // Apply competition filter
      if (competitionFilter !== 'all') {
        if (competitionFilter.startsWith('type:')) {
          const type = competitionFilter.replace('type:', '');
          query = query.eq('competition_type', type);
        } else {
          query = query.eq('competition_name', competitionFilter);
        }
      }

      // Apply pagination
      if (options?.limit) {
        query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Aggregate by player (in case player appears in multiple competitions)
      const playerStats: Record<string, PlayerPlayingTime> = {};

      (data || []).forEach((row: any) => {
        const playerId = row.player_id;
        
        if (!playerStats[playerId]) {
          playerStats[playerId] = {
            player_id: playerId,
            player_name: row.player_name,
            team_name: row.team_name,
            total_minutes: 0,
            matches_played: 0,
            average_minutes: 0,
            competition_type: row.competition_type,
            competition_name: row.competition_name
          };
        }

        playerStats[playerId].total_minutes += row.total_minutes || 0;
        playerStats[playerId].matches_played += row.matches_played || 0;
      });

      // Recalculate averages after aggregation
      const result = Object.values(playerStats).map(player => ({
        ...player,
        average_minutes: player.matches_played > 0 
          ? Math.round(player.total_minutes / player.matches_played) 
          : 0
      }));

      return result.sort((a, b) => b.total_minutes - a.total_minutes);
    },
    staleTime: 10 * 60 * 1000, // Historical data stays fresh longer
    gcTime: 30 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
}

// Fetch available competitions using optimized materialized view
export function useCompetitions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['competitions'],
    queryFn: async (): Promise<Competition[]> => {
      const { data, error } = await supabase
        .from('mv_competitions')
        .select('*')
        .order('display_name');

      if (error) throw error;

      return (data || []).map(comp => ({
        filter_value: comp.filter_value,
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
    const { error } = await supabase.rpc('refresh_report_views');
    if (error) {
      console.error('Error refreshing report views:', error);
      throw error;
    }
  };
}