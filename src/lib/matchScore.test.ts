import { describe, expect, it } from 'vitest';
import { calculateScore, type ScorableEvent } from './matchScore';

describe('calculateScore', () => {
  // Protects the live scoreboard from crediting the wrong side's goal to the other team.
  it('tallies goals for each side separately', () => {
    const events: ScorableEvent[] = [
      { event_type: 'goal', is_our_team: true },
      { event_type: 'goal', is_our_team: true },
      { event_type: 'goal', is_our_team: false },
    ];
    expect(calculateScore(events)).toEqual({ ourGoals: 2, opponentGoals: 1 });
  });

  // Protects the scoreboard from inflating the score when a substitution or assist is logged.
  it('does not count substitution or assist events as goals', () => {
    const events: ScorableEvent[] = [
      { event_type: 'goal', is_our_team: true },
      { event_type: 'assist', is_our_team: true },
      { event_type: 'substitution_on', is_our_team: true },
      { event_type: 'substitution_off', is_our_team: false },
    ];
    expect(calculateScore(events)).toEqual({ ourGoals: 1, opponentGoals: 0 });
  });

  // Protects against a crash or a non-zero score before any events have been recorded.
  it('returns 0-0 for an empty event list', () => {
    expect(calculateScore([])).toEqual({ ourGoals: 0, opponentGoals: 0 });
  });
});
