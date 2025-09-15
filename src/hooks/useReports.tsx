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
}

interface GoalScorer {
  player_id: string;
  player_name: string;
  team_name: string;
  goals: number;
  assists: number;
  total_contributions: number;
}

interface PlayerPlayingTime {
  player_id: string;
  player_name: string;
  team_name: string;
  total_minutes: number;
  matches_played: number;
  average_minutes: number;
}

interface Competition {
  type: string;
  name?: string;
}

// Fetch completed matches with scores
export function useCompletedMatches(competitionFilter = 'all') {
  return useQuery({
    queryKey: ['completed-matches', competitionFilter],
    queryFn: async (): Promise<CompletedMatch[]> => {
      let query = supabase
        .from('fixtures_with_scores')
        .select('*')
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: false });

      // Apply competition filter
      if (competitionFilter !== 'all') {
        if (competitionFilter.startsWith('type:')) {
          const type = competitionFilter.replace('type:', '');
          query = query.eq('competition_type', type as any);
        } else {
          query = query.eq('competition_name', competitionFilter);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(fixture => ({
        id: fixture.id,
        scheduled_date: fixture.scheduled_date,
        opponent_name: fixture.opponent_name,
        location: fixture.location || 'TBC',
        our_score: fixture.our_goals || 0,
        opponent_score: fixture.opponent_goals || 0,
        team_name: fixture.team_name || 'Unknown Team'
      }));
    },
    staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
    gcTime: 10 * 60 * 1000,   // Keep in cache for 10 minutes
  });
}

// Fetch goal scorers with stats
export function useGoalScorers(competitionFilter = 'all') {
  return useQuery({
    queryKey: ['goal-scorers', competitionFilter],
    queryFn: async (): Promise<GoalScorer[]> => {
      // Build competition condition
      let competitionCondition = {};
      if (competitionFilter !== 'all') {
        if (competitionFilter.startsWith('type:')) {
          const type = competitionFilter.replace('type:', '');
          competitionCondition = { competition_type: type };
        } else {
          competitionCondition = { competition_name: competitionFilter };
        }
      }

      // Get completed fixtures matching filter
      const { data: fixtures, error: fixturesError } = await supabase
        .from('fixtures')
        .select('id')
        .eq('status', 'completed')
        .match(competitionCondition);

      if (fixturesError) throw fixturesError;
      
      const fixtureIds = (fixtures || []).map(f => f.id);
      if (fixtureIds.length === 0) return [];

      // Get goal events
      const { data: goalEvents, error: goalsError } = await supabase
        .from('match_events')
        .select(`
          player_id,
          event_type,
          players!inner(first_name, last_name),
          fixtures!inner(
            team_id,
            teams!fk_fixtures_team_id(name)
          )
        `)
        .in('fixture_id', fixtureIds)
        .in('event_type', ['goal', 'assist'])
        .eq('is_our_team', true)
        .not('player_id', 'is', null);

      if (goalsError) throw goalsError;

      // Process and aggregate the data
      const playerStats: Record<string, GoalScorer> = {};

      (goalEvents || []).forEach((event: any) => {
        const playerId = event.player_id;
        const playerName = `${event.players.first_name} ${event.players.last_name}`;
        const teamName = event.fixtures?.teams?.name || 'Unknown Team';

        if (!playerStats[playerId]) {
          playerStats[playerId] = {
            player_id: playerId,
            player_name: playerName,
            team_name: teamName,
            goals: 0,
            assists: 0,
            total_contributions: 0
          };
        }

        if (event.event_type === 'goal') {
          playerStats[playerId].goals++;
        } else if (event.event_type === 'assist') {
          playerStats[playerId].assists++;
        }
        
        playerStats[playerId].total_contributions = 
          playerStats[playerId].goals + playerStats[playerId].assists;
      });

      return Object.values(playerStats)
        .sort((a, b) => b.total_contributions - a.total_contributions);
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Fetch player playing time stats
export function usePlayerPlayingTime(competitionFilter = 'all') {
  return useQuery({
    queryKey: ['player-playing-time', competitionFilter],
    queryFn: async (): Promise<PlayerPlayingTime[]> => {
      // Build competition condition
      let competitionCondition = {};
      if (competitionFilter !== 'all') {
        if (competitionFilter.startsWith('type:')) {
          const type = competitionFilter.replace('type:', '');
          competitionCondition = { competition_type: type };
        } else {
          competitionCondition = { competition_name: competitionFilter };
        }
      }

      // Get completed fixtures matching filter
      const { data: fixtures, error: fixturesError } = await supabase
        .from('fixtures')
        .select('id, team_id, teams!fk_fixtures_team_id(name)')
        .eq('status', 'completed')
        .match(competitionCondition);

      if (fixturesError) throw fixturesError;
      
      const fixtureIds = (fixtures || []).map(f => f.id);
      if (fixtureIds.length === 0) return [];

      // Get playing time logs
      const { data: timeLogs, error: timeError } = await supabase
        .from('player_time_logs')
        .select(`
          player_id,
          total_period_minutes,
          players!inner(first_name, last_name)
        `)
        .in('fixture_id', fixtureIds)
        .not('total_period_minutes', 'is', null);

      if (timeError) throw timeError;

      // Process and aggregate the data
      const playerStats: Record<string, PlayerPlayingTime> = {};

      (timeLogs || []).forEach((log: any) => {
        const playerId = log.player_id;
        const playerName = `${log.players.first_name} ${log.players.last_name}`;
        const minutes = log.total_period_minutes || 0;

        if (!playerStats[playerId]) {
          playerStats[playerId] = {
            player_id: playerId,
            player_name: playerName,
            team_name: 'Unknown Team', // Will be updated below
            total_minutes: 0,
            matches_played: 0,
            average_minutes: 0
          };
        }

        playerStats[playerId].total_minutes += minutes;
        playerStats[playerId].matches_played++;
      });

      // Calculate averages and get team names
      const result = Object.values(playerStats).map(player => ({
        ...player,
        average_minutes: player.matches_played > 0 
          ? Math.round(player.total_minutes / player.matches_played) 
          : 0
      }));

      return result.sort((a, b) => b.total_minutes - a.total_minutes);
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Fetch available competitions
export function useCompetitions() {
  return useQuery({
    queryKey: ['competitions'],
    queryFn: async (): Promise<Competition[]> => {
      const { data, error } = await supabase
        .from('fixtures')
        .select('competition_type, competition_name')
        .eq('status', 'completed');

      if (error) throw error;

      const competitions: Competition[] = [];
      const seen = new Set<string>();

      (data || []).forEach(fixture => {
        // Add competition type
        if (fixture.competition_type && !seen.has(`type:${fixture.competition_type}`)) {
          seen.add(`type:${fixture.competition_type}`);
          competitions.push({ 
            type: `type:${fixture.competition_type}`,
            name: fixture.competition_type.charAt(0).toUpperCase() + fixture.competition_type.slice(1)
          });
        }

        // Add named competition
        if (fixture.competition_name && !seen.has(fixture.competition_name)) {
          seen.add(fixture.competition_name);
          competitions.push({ 
            type: fixture.competition_name,
            name: fixture.competition_name
          });
        }
      });

      return competitions;
    },
    staleTime: 10 * 60 * 1000, // Competitions don't change often
    gcTime: 30 * 60 * 1000,
  });
}