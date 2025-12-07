import { useMemo } from 'react';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface MatchEvent {
  id: string;
  event_type: string;
  player_id: string;
  assist_player_id?: string;
  minute_in_period: number;
  total_match_minute: number;
}

interface SmartSuggestion {
  playerId: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Provides smart suggestions based on match context and history
 */
export function useSmartSuggestions(
  players: Player[],
  events: MatchEvent[],
  currentPeriod: number
) {
  // Suggest likely assist player based on recent goal patterns
  const suggestAssistPlayer = useMemo(
    () => (scorerId: string): SmartSuggestion | null => {
      if (!scorerId || events.length === 0) return null;

      // Find recent goals by this scorer
      const recentGoalsByScorer = events
        .filter(e => e.event_type === 'goal' && e.player_id === scorerId)
        .slice(-3); // Last 3 goals

      if (recentGoalsByScorer.length === 0) return null;

      // Count assist patterns
      const assistCounts: Record<string, number> = {};
      recentGoalsByScorer.forEach(goal => {
        if (goal.assist_player_id) {
          assistCounts[goal.assist_player_id] = (assistCounts[goal.assist_player_id] || 0) + 1;
        }
      });

      // Find most common assist player
      const entries = Object.entries(assistCounts);
      if (entries.length === 0) return null;

      const [mostCommonAssist, count] = entries.reduce((a, b) => 
        a[1] > b[1] ? a : b
      );

      const confidence: 'high' | 'medium' | 'low' = 
        count >= 2 ? 'high' : count === 1 ? 'medium' : 'low';

      return {
        playerId: mostCommonAssist,
        confidence,
        reason: `Assisted ${count} of last ${recentGoalsByScorer.length} goals by this player`,
      };
    },
    [events]
  );

  // Suggest likely scorers based on current period and recent form
  const suggestLikelyScorers = useMemo(() => {
    if (events.length === 0) return [];

    // Get goals from current period
    const currentPeriodGoals = events.filter(
      e => e.event_type === 'goal' && e.minute_in_period <= 45 // Assuming 45 min periods
    );

    // Count goals per player
    const scorerCounts: Record<string, number> = {};
    currentPeriodGoals.forEach(goal => {
      scorerCounts[goal.player_id] = (scorerCounts[goal.player_id] || 0) + 1;
    });

    // Sort by goal count
    const suggestions: SmartSuggestion[] = Object.entries(scorerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) // Top 5
      .map(([playerId, count]) => ({
        playerId,
        confidence: count >= 3 ? 'high' : count >= 2 ? 'medium' : 'low',
        reason: `${count} goal${count > 1 ? 's' : ''} this match`,
      }));

    return suggestions;
  }, [events, currentPeriod]);

  // Suggest default period length based on team type
  const suggestPeriodLength = useMemo(
    () => (teamType?: string): number => {
      // Common period lengths by team format
      const defaults: Record<string, number> = {
        '5-a-side': 15,
        '6-a-side': 15,
        '7-a-side': 20,
        '9-a-side': 25,
        '11-a-side': 45,
      };

      return defaults[teamType || '11-a-side'] || 45;
    },
    []
  );

  // Get player name for suggestion display
  const getPlayerName = useMemo(
    () => (playerId: string): string => {
      const player = players.find(p => p.id === playerId);
      if (!player) return 'Unknown';
      return `${player.first_name} ${player.last_name}`;
    },
    [players]
  );

  // Suggest next most likely event based on game flow
  const suggestNextEvent = useMemo(() => {
    if (events.length === 0) return null;

    const recentEvents = events.slice(-5); // Last 5 events
    const goalCount = recentEvents.filter(e => e.event_type === 'goal').length;
    
    // If multiple goals recently, substitution likely
    if (goalCount >= 2) {
      return {
        type: 'substitution',
        reason: 'Multiple recent goals - tactical change likely',
        confidence: 'medium' as const,
      };
    }

    return null;
  }, [events]);

  return {
    suggestAssistPlayer,
    suggestLikelyScorers,
    suggestPeriodLength,
    suggestNextEvent,
    getPlayerName,
  };
}
