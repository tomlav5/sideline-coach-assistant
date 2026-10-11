import { describe, expect, it } from 'vitest';
import { applyOwnGoal, goalScorerFallback } from './ownGoal';
import { calculateScore } from './matchScore';
import { buildMatchTally, type TallyEvent } from './matchTally';

const river = { first_name: 'River', last_name: 'WH' };
const lucas = { first_name: 'Lucas', last_name: 'H' };

// The live dialogs' goal payload, as EnhancedMatchTracker.handleQuickGoal builds it.
const goalPayload = (overrides: Record<string, unknown> = {}) => ({
  fixture_id: 'f1',
  period_id: 'p1',
  event_type: 'goal',
  player_id: 'river' as string | null,
  assist_player_id: 'lucas' as string | null,
  minute_in_period: 12,
  total_match_minute: 12,
  is_our_team: true,
  is_penalty: false,
  is_retrospective: false,
  client_event_id: 'c1',
  ...overrides,
});

const ownGoal = (is_our_team: boolean): TallyEvent & { is_own_goal: boolean } => ({
  event_type: 'goal',
  is_our_team,
  is_own_goal: true,
  player_id: null,
  assist_player_id: null,
});

describe('applyOwnGoal (UX-042)', () => {
  // Protects a child's season record from an own goal being credited to them.
  it('forces player_id and assist_player_id to null when is_own_goal is true', () => {
    const saved = applyOwnGoal(goalPayload(), true);
    expect(saved).toMatchObject({ is_own_goal: true, player_id: null, assist_player_id: null });
  });

  // Protects the data from an event that claims to be both an own goal and a penalty.
  it('never lets is_own_goal and is_penalty both be true', () => {
    const saved = applyOwnGoal(goalPayload({ is_penalty: true }), true);
    expect(saved).toMatchObject({ is_own_goal: true, is_penalty: false });
  });

  // Protects the ordinary goal path — dozens a season — from any change at all:
  // same object back, and no is_own_goal key added to what gets written.
  it('leaves an ordinary goal with a scorer and assist exactly as it was', () => {
    const payload = goalPayload({ is_penalty: true });
    const saved = applyOwnGoal(payload, false);
    expect(saved).toBe(payload);
    expect(saved).not.toHaveProperty('is_own_goal');
    expect(saved).toMatchObject({ player_id: 'river', assist_player_id: 'lucas', is_penalty: true });
  });

  // Protects the editor from being unable to convert an own goal back.
  it('keeps an explicit is_own_goal: false when not an own goal', () => {
    expect(applyOwnGoal(goalPayload({ is_own_goal: false }), false)).toMatchObject({
      is_own_goal: false,
      player_id: 'river',
    });
  });
});

describe('own goals in the score (UX-042)', () => {
  // Protects the scoreline: an own goal for us is still our goal.
  it('an own goal for our team increments our score', () => {
    expect(calculateScore([ownGoal(true)])).toEqual({ ourGoals: 1, opponentGoals: 0 });
  });

  // Protects the scoreline: an own goal by one of ours counts for the opposition.
  it('an own goal for the opposition increments theirs', () => {
    expect(calculateScore([ownGoal(false)])).toEqual({ ourGoals: 0, opponentGoals: 1 });
  });

  // Protects mixed matches from own goals displacing ordinary goals in the count.
  it('counts own goals alongside ordinary goals', () => {
    const events = [
      { event_type: 'goal', is_our_team: true },
      ownGoal(true),
      ownGoal(false),
    ];
    expect(calculateScore(events)).toEqual({ ourGoals: 2, opponentGoals: 1 });
  });
});

describe('own goals in the scorer tally (UX-042)', () => {
  // Confirms buildMatchTally needs no change: own goals have no player_id, so they
  // credit nobody — in either tally — whichever side they counted for.
  it('excludes own goals from both the scorer and assist tallies', () => {
    const tally = buildMatchTally([ownGoal(true), ownGoal(false)]);
    expect(tally).toEqual({ scorers: [], assists: [] });
  });

  // Protects ordinary goals in the same match from being affected by an own goal.
  it('still credits an ordinary goal recorded in the same match', () => {
    const tally = buildMatchTally([
      ownGoal(true),
      {
        event_type: 'goal',
        is_our_team: true,
        player_id: 'river',
        players: river,
        assist_player_id: 'lucas',
        assist_players: lucas,
      },
    ]);
    expect(tally.scorers).toEqual([{ player_id: 'river', ...river, count: 1 }]);
    expect(tally.assists).toEqual([{ player_id: 'lucas', ...lucas, count: 1 }]);
  });
});

describe('goalScorerFallback (UX-042)', () => {
  // Protects the report from showing an own goal as "Unknown" or "Opposition".
  it('reads "Own goal" for an own goal on either side', () => {
    expect(goalScorerFallback({ is_our_team: true, is_own_goal: true })).toBe('Own goal');
    expect(goalScorerFallback({ is_our_team: false, is_own_goal: true })).toBe('Own goal');
  });

  it('keeps the existing fallbacks for everything else', () => {
    expect(goalScorerFallback({ is_our_team: true })).toBe('Unknown');
    expect(goalScorerFallback({ is_our_team: false, is_own_goal: false })).toBe('Opposition');
  });
});
