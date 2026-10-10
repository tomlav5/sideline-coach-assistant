import { describe, expect, it } from 'vitest';
import { buildMatchTally, formatTallyText, type TallyEvent } from './matchTally';

const river = { first_name: 'River', last_name: 'WH' };
const joshua = { first_name: 'Joshua', last_name: 'G' };
const lucas = { first_name: 'Lucas', last_name: 'H' };
const jack = { first_name: 'Jack', last_name: 'S' };

const goal = (
  scorer: { id: string; p: { first_name: string; last_name: string } } | null,
  assist: { id: string; p: { first_name: string; last_name: string } } | null = null,
  is_our_team = true,
): TallyEvent => ({
  event_type: 'goal',
  is_our_team,
  player_id: scorer?.id,
  players: scorer?.p,
  assist_player_id: assist?.id,
  assist_players: assist?.p,
});

const R = { id: 'river', p: river };
const J = { id: 'joshua', p: joshua };
const L = { id: 'lucas', p: lucas };
const K = { id: 'jack', p: jack };

describe('buildMatchTally', () => {
  // Protects FA Full-Time transcription from listing a hat-trick as three separate lines.
  it('counts a player scoring three times once, with count 3', () => {
    const { scorers } = buildMatchTally([goal(R), goal(R), goal(R)]);
    expect(scorers).toHaveLength(1);
    expect(scorers[0]).toMatchObject({ player_id: 'river', count: 3 });
  });

  // Protects the tally order from depending on the order goals were recorded.
  it('orders by count descending, then first name ascending', () => {
    const { scorers } = buildMatchTally([goal(R), goal(L), goal(J), goal(K), goal(L)]);
    expect(scorers.map(s => [s.first_name, s.count])).toEqual([
      ['Lucas', 2],
      ['Jack', 1],
      ['Joshua', 1],
      ['River', 1],
    ]);
  });

  // Protects our players' totals from being credited with opposition goals.
  it('excludes opposition goals from both tallies', () => {
    const tally = buildMatchTally([goal(R, L, false), goal(null, null, false)]);
    expect(tally).toEqual({ scorers: [], assists: [] });
  });

  // Protects assist-only players from being dropped or listed as scorers.
  it('lists a player who assisted but did not score only in assists', () => {
    const { scorers, assists } = buildMatchTally([goal(R, L)]);
    expect(scorers.map(s => s.player_id)).toEqual(['river']);
    expect(assists.map(a => a.player_id)).toEqual(['lucas']);
  });

  // Protects the assist tally from counting unassisted goals.
  it('counts a goal with no assist_player_id in scorers only', () => {
    const { scorers, assists } = buildMatchTally([goal(R)]);
    expect(scorers).toHaveLength(1);
    expect(assists).toEqual([]);
  });

  // Protects the report from crashing on a match with no events yet.
  it('returns empty tallies for an empty events array', () => {
    expect(buildMatchTally([])).toEqual({ scorers: [], assists: [] });
  });

  // Protects the tally from counting non-goal events that carry a player_id.
  it('ignores non-goal events', () => {
    const sub: TallyEvent = { event_type: 'substitution_on', is_our_team: true, player_id: 'river', players: river };
    expect(buildMatchTally([sub])).toEqual({ scorers: [], assists: [] });
  });
});

describe('formatTallyText', () => {
  // Protects the exact text a coach pastes into FA Full-Time.
  it('matches the expected text for a known fixture', () => {
    const events = [
      goal(R, L),
      goal(null, null, false),
      goal(R),
      goal(J, K),
      goal(R, R),
      goal(null, null, false),
      goal(R),
    ];
    const tally = buildMatchTally(events);
    expect(formatTallyText('Wanstead Wanderers', 'Aspire Sport', 5, 8, tally)).toBe(
      'Wanstead Wanderers 5-8 Aspire Sport\n' +
        'Scorers: River WH 4, Joshua G 1\n' +
        'Assists: Jack S 1, Lucas H 1, River WH 1',
    );
  });

  // Protects against an empty "Assists:" line when no goal was assisted.
  it('omits the assists line when there are no assists', () => {
    const tally = buildMatchTally([goal(R)]);
    expect(formatTallyText('Us', 'Them', 1, 0, tally)).toBe('Us 1-0 Them\nScorers: River WH 1');
  });
});
