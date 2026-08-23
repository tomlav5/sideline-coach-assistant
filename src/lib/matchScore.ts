export interface ScorableEvent {
  event_type: string;
  is_our_team: boolean;
}

export interface Score {
  ourGoals: number;
  opponentGoals: number;
}

export const calculateScore = (events: ScorableEvent[]): Score => {
  const ourGoals = events.filter(e => e.event_type === 'goal' && e.is_our_team).length;
  const opponentGoals = events.filter(e => e.event_type === 'goal' && !e.is_our_team).length;
  return { ourGoals, opponentGoals };
};
