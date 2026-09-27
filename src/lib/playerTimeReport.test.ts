import { describe, expect, it } from 'vitest';
import { buildPlayerTimes, formatSpell, type PlayerTimeLogRow } from './playerTimeReport';

const row = (overrides: Partial<PlayerTimeLogRow> & { period: number | null }): PlayerTimeLogRow => {
  const { period, ...rest } = overrides;
  return {
    player_id: 'p1',
    time_on_minute: 0,
    time_off_minute: 25,
    total_period_minutes: 25,
    is_starter: true,
    players: { first_name: 'Ardan', last_name: 'L' },
    match_periods: period === null ? null : { period_number: period },
    ...rest,
  };
};

describe('buildPlayerTimes', () => {
  // Protects the basic case: a player on from kick-off is reported as a Starter.
  it('labels a single-spell starter as a Starter', () => {
    const [pt] = buildPlayerTimes([row({ period: 1 })]);
    expect(pt.is_starter).toBe(true);
    expect(pt.spells).toEqual([{ period_number: 1, time_on_minute: 0, time_off_minute: 25 }]);
  });

  // BUG-036: Ardan L was a sub in P1 and started P2, and was reported as "Starter".
  it('labels a player who was a sub in P1 and a starter in P2 as a Sub', () => {
    const [pt] = buildPlayerTimes([
      // Deliberately out of order, starter row first, as the old query returned it.
      row({ period: 2, time_on_minute: 0, time_off_minute: 27, total_period_minutes: 27, is_starter: true }),
      row({ period: 1, time_on_minute: 13, time_off_minute: 25, total_period_minutes: 12, is_starter: false }),
    ]);
    expect(pt.is_starter).toBe(false);
    expect(pt.spells.map(formatSpell).join(' · ')).toBe("P1 13'-25' · P2 0'-27'");
  });

  // Protects the display from depending on the order the query returns rows in.
  it('returns spells in period order, then time order within a period', () => {
    const [pt] = buildPlayerTimes([
      row({ period: 2, time_on_minute: 20, time_off_minute: 30 }),
      row({ period: 1, time_on_minute: 18, time_off_minute: 25 }),
      row({ period: 2, time_on_minute: 0, time_off_minute: 10 }),
      row({ period: 1, time_on_minute: 0, time_off_minute: 5 }),
    ]);
    expect(pt.spells.map((s) => [s.period_number, s.time_on_minute])).toEqual([
      [1, 0],
      [1, 18],
      [2, 0],
      [2, 20],
    ]);
  });

  // An in-progress fixture has an unclosed spell; the report must render it, not crash.
  it('keeps an open spell with a null off value', () => {
    const [pt] = buildPlayerTimes([
      row({ period: 1, time_on_minute: 0, time_off_minute: 25 }),
      row({ period: 2, time_on_minute: 0, time_off_minute: null, total_period_minutes: null }),
    ]);
    expect(pt.spells[1].time_off_minute).toBeNull();
    const text = pt.spells.map(formatSpell).join(' · ');
    expect(text).toBe("P1 0'-25' · P2 0'-");
    expect(text).not.toMatch(/null|undefined|NaN/);
  });

  // A zero-length spell (BUG-033 artefact) must stay visible as a signal to check the data.
  it('keeps a zero-length spell in the output', () => {
    const [pt] = buildPlayerTimes([
      row({ period: 1, time_on_minute: 12, time_off_minute: 12, total_period_minutes: 0 }),
    ]);
    expect(pt.spells).toHaveLength(1);
    expect(formatSpell(pt.spells[0])).toBe("P1 12'-12'");
  });

  // total_minutes was already correct before BUG-036; the fix must not change it.
  it('sums total_period_minutes into total_minutes, treating null as zero', () => {
    const [pt] = buildPlayerTimes([
      row({ period: 1, total_period_minutes: 12 }),
      row({ period: 2, total_period_minutes: 27 }),
      row({ period: 3, total_period_minutes: null, time_off_minute: null }),
    ]);
    expect(pt.total_minutes).toBe(39);
  });

  // Protects the list order: starters first, then most minutes.
  it('sorts starters first, then by total minutes descending', () => {
    const result = buildPlayerTimes([
      row({ player_id: 'sub-big', period: 1, is_starter: false, total_period_minutes: 40 }),
      row({ player_id: 'start-small', period: 1, is_starter: true, total_period_minutes: 10 }),
      row({ player_id: 'start-big', period: 1, is_starter: true, total_period_minutes: 30 }),
    ]);
    expect(result.map((p) => p.player_id)).toEqual(['start-big', 'start-small', 'sub-big']);
  });
});
