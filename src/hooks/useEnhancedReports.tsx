import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CompletedMatch {
  id: string;
  scheduled_date: string;
  opponent_name: string;
  location: string;
  competition_type: string;
  competition_name?: string;
  our_score: number;
  opponent_score: number;
  team_name: string;
}

interface GoalScorer {
  player_id: string;
  player_name: string;
  goals: number;
  assists: number;
}

interface PlayerPlayingTime {
  player_id: string;
  player_name: string;
  total_minutes: number;
  matches_played: number;
}

export function useEnhancedReportsData(competitionFilter?: string) {
  return useQuery({
    queryKey: ['enhanced-reports', competitionFilter],
    queryFn: async () => {
      // Fetch completed fixtures with enhanced data
      let fixturesQuery = supabase
        .from('fixtures')
        .select(`
          *,
          teams(name, club_id),
          match_periods(*)
        `)
        .eq('match_status', 'completed')
        .order('scheduled_date', { ascending: false });

      if (competitionFilter && competitionFilter !== 'all') {
        fixturesQuery = fixturesQuery.eq('competition_type', competitionFilter as any);
      }

      const { data: fixtures, error: fixturesError } = await fixturesQuery;
      if (fixturesError) throw fixturesError;

      // Get all fixture IDs for further queries
      const fixtureIds = fixtures?.map(f => f.id) || [];

      // Fetch match events with enhanced structure
      const { data: events, error: eventsError } = await supabase
        .from('match_events')
        .select(`
          *,
          players!player_id(first_name, last_name),
          assist_players:players!assist_player_id(first_name, last_name)
        `)
        .in('fixture_id', fixtureIds);

      if (eventsError) throw eventsError;

      // Fetch player time logs with enhanced structure
      const { data: playingTimes, error: playingTimesError } = await supabase
        .from('player_time_logs')
        .select(`
          *,
          players(first_name, last_name)
        `)
        .in('fixture_id', fixtureIds);

      if (playingTimesError) throw playingTimesError;

      // Process completed matches with scores
      const completedMatches: CompletedMatch[] = fixtures?.map(fixture => {
        const ourGoals = events?.filter(e => 
          e.fixture_id === fixture.id && 
          e.event_type === 'goal' && 
          e.is_our_team
        ).length || 0;

        const opponentGoals = events?.filter(e => 
          e.fixture_id === fixture.id && 
          e.event_type === 'goal' && 
          !e.is_our_team
        ).length || 0;

        return {
          id: fixture.id,
          scheduled_date: fixture.scheduled_date,
          opponent_name: fixture.opponent_name,
          location: fixture.location || 'Unknown',
          competition_type: fixture.competition_type || 'friendly',
          competition_name: fixture.competition_name,
          our_score: ourGoals,
          opponent_score: opponentGoals,
          team_name: (fixture.teams as any)?.name || 'Team',
        };
      }) || [];

      // Process goal scorers
      const goalScorerMap = new Map<string, GoalScorer>();
      
      events?.forEach(event => {
        if (event.event_type === 'goal' && event.is_our_team && event.player_id) {
          const playerId = event.player_id;
          const playerData = event.players as any;
          const playerName = playerData ? `${playerData.first_name} ${playerData.last_name}` : 'Unknown';
          
          if (!goalScorerMap.has(playerId)) {
            goalScorerMap.set(playerId, {
              player_id: playerId,
              player_name: playerName,
              goals: 0,
              assists: 0,
            });
          }
          
          goalScorerMap.get(playerId)!.goals++;
        }
        
        if (event.event_type === 'goal' && event.is_our_team && event.assist_player_id) {
          const assistPlayerId = event.assist_player_id;
          const assistPlayerData = event.assist_players as any;
          const assistPlayerName = assistPlayerData ? `${assistPlayerData.first_name} ${assistPlayerData.last_name}` : 'Unknown';
          
          if (!goalScorerMap.has(assistPlayerId)) {
            goalScorerMap.set(assistPlayerId, {
              player_id: assistPlayerId,
              player_name: assistPlayerName,
              goals: 0,
              assists: 0,
            });
          }
          
          goalScorerMap.get(assistPlayerId)!.assists++;
        }
      });

      const goalScorers = Array.from(goalScorerMap.values())
        .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists));

      // Process playing time
      const playingTimeMap = new Map<string, PlayerPlayingTime>();
      
      playingTimes?.forEach(timeLog => {
        const playerId = timeLog.player_id;
        const playerData = timeLog.players as any;
        const playerName = playerData ? `${playerData.first_name} ${playerData.last_name}` : 'Unknown';
        const minutes = timeLog.total_period_minutes || 0;
        
        if (!playingTimeMap.has(playerId)) {
          playingTimeMap.set(playerId, {
            player_id: playerId,
            player_name: playerName,
            total_minutes: 0,
            matches_played: 0,
          });
        }
        
        const playerStats = playingTimeMap.get(playerId)!;
        playerStats.total_minutes += minutes;
        
        // Count as played if more than 0 minutes
        if (minutes > 0) {
          const fixtureAlreadyCounted = completedMatches.some(match => {
            return match.id === timeLog.fixture_id && 
                   playingTimes?.some(pt => pt.fixture_id === match.id && pt.player_id === playerId);
          });
          
          // Only increment if this is the first time log for this player in this fixture
          const isFirstLogForFixture = playingTimes?.findIndex(pt => 
            pt.fixture_id === timeLog.fixture_id && pt.player_id === playerId
          ) === playingTimes?.indexOf(timeLog);
          
          if (isFirstLogForFixture) {
            playerStats.matches_played++;
          }
        }
      });

      const playingTime = Array.from(playingTimeMap.values())
        .sort((a, b) => b.total_minutes - a.total_minutes);

      return {
        completedMatches,
        goalScorers,
        playingTime,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}