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
  goals: number;
  assists: number;
  team_name: string;
}

interface PlayerPlayingTime {
  player_id: string;
  player_name: string;
  total_minutes: number;
  matches_played: number;
  average_minutes: number;
  team_name: string;
}

export function useReportsData(competitionFilter: string = 'all') {
  return useQuery({
    queryKey: ['reports', competitionFilter],
    queryFn: async () => {
      // Build competition filter condition
      let competitionCondition = {};
      if (competitionFilter !== 'all') {
        if (competitionFilter.startsWith('type:')) {
          const type = competitionFilter.replace('type:', '');
          competitionCondition = { competition_type: type };
        } else if (competitionFilter.startsWith('name:')) {
          const name = competitionFilter.replace('name:', '');
          competitionCondition = { competition_name: name };
        }
      }

      // Optimized query: Get fixtures with match events in a single query
      const { data: fixturesWithEvents, error: fixturesError } = await supabase
        .from('fixtures')
        .select(`
          id,
          scheduled_date,
          opponent_name,
          location,
          competition_type,
          competition_name,
          teams!fk_fixtures_team_id (name),
          match_events!fk_match_events_fixture_id (
            id,
            event_type,
            is_our_team,
            player_id,
            players!fk_match_events_player_id (first_name, last_name)
          ),
          player_time_logs!fk_player_time_logs_fixture_id (
            player_id,
            total_period_minutes,
            players!fk_player_time_logs_player_id (first_name, last_name)
          )
        `)
        .eq('status', 'completed')
        .match(competitionCondition)
        .order('scheduled_date', { ascending: false });

      if (fixturesError) throw fixturesError;

      // Process data efficiently
      const completedMatches: CompletedMatch[] = [];
      const scorersMap = new Map<string, GoalScorer>();
      const playerMatchMap = new Map<string, Map<string, number>>();
      const playingTimeMap = new Map<string, PlayerPlayingTime>();

      (fixturesWithEvents || []).forEach((fixture) => {
        const teamName = fixture.teams?.name || 'Unknown Team';
        
        // Calculate scores from events
        const ourGoals = fixture.match_events?.filter(e => 
          e.event_type === 'goal' && e.is_our_team
        ).length || 0;
        
        const opponentGoals = fixture.match_events?.filter(e => 
          e.event_type === 'goal' && !e.is_our_team
        ).length || 0;

        completedMatches.push({
          id: fixture.id,
          scheduled_date: fixture.scheduled_date,
          opponent_name: fixture.opponent_name,
          location: fixture.location || 'TBC',
          our_score: ourGoals,
          opponent_score: opponentGoals,
          team_name: teamName
        });

        // Process goal scorers
        fixture.match_events?.forEach((event) => {
          if (!event.player_id || !event.players || !event.is_our_team) return;
          
          const playerId = event.player_id;
          const playerName = `${event.players.first_name} ${event.players.last_name}`;
          
          if (!scorersMap.has(playerId)) {
            scorersMap.set(playerId, {
              player_id: playerId,
              player_name: playerName,
              goals: 0,
              assists: 0,
              team_name: teamName
            });
          }
          
          const scorer = scorersMap.get(playerId)!;
          if (event.event_type === 'goal') {
            scorer.goals++;
          } else if (event.event_type === 'assist') {
            scorer.assists++;
          }
        });

        // Process playing time
        fixture.player_time_logs?.forEach((record) => {
          if (!record.player_id || !record.players) return;
          
          const playerId = record.player_id;
          const playerName = `${record.players.first_name} ${record.players.last_name}`;
          const fixtureId = fixture.id;
          
          if (!playerMatchMap.has(playerId)) {
            playerMatchMap.set(playerId, new Map());
          }
          
          if (!playingTimeMap.has(playerId)) {
            playingTimeMap.set(playerId, {
              player_id: playerId,
              player_name: playerName,
              total_minutes: 0,
              matches_played: 0,
              average_minutes: 0,
              team_name: teamName
            });
          }
          
          const playerMatches = playerMatchMap.get(playerId)!;
          const currentMatchMinutes = playerMatches.get(fixtureId) || 0;
          playerMatches.set(fixtureId, currentMatchMinutes + (record.total_period_minutes || 0));
        });
      });

      // Calculate playing time totals
      playerMatchMap.forEach((matches, playerId) => {
        const playerStats = playingTimeMap.get(playerId)!;
        let totalMinutes = 0;
        
        matches.forEach((minutes) => {
          totalMinutes += minutes;
        });
        
        playerStats.total_minutes = totalMinutes;
        playerStats.matches_played = matches.size;
        playerStats.average_minutes = playerStats.matches_played > 0 ? 
          Math.round(playerStats.total_minutes / playerStats.matches_played) : 0;
      });

      const goalScorers = Array.from(scorersMap.values())
        .sort((a, b) => {
          if (b.goals !== a.goals) return b.goals - a.goals;
          return b.assists - a.assists;
        });

      const playingTime = Array.from(playingTimeMap.values())
        .sort((a, b) => b.total_minutes - a.total_minutes);

      return {
        completedMatches,
        goalScorers,
        playingTime
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - reports change less frequently
  });
}

export function useCompetitions() {
  return useQuery({
    queryKey: ['competitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixtures')
        .select('competition_type, competition_name')
        .eq('status', 'completed');

      if (error) throw error;

      const competitionsSet = new Set<string>();
      (data || []).forEach(fixture => {
        if (fixture.competition_type) {
          competitionsSet.add(`type:${fixture.competition_type}`);
        }
        if (fixture.competition_name) {
          competitionsSet.add(`name:${fixture.competition_name}`);
        }
      });

      return Array.from(competitionsSet).map(comp => {
        if (comp.startsWith('type:')) {
          return { type: comp.replace('type:', '') };
        } else {
          return { type: 'tournament', name: comp.replace('name:', '') };
        }
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - competitions change very rarely
  });
}