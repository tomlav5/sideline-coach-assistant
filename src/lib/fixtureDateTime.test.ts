import { describe, expect, it } from 'vitest';
import { combineFixtureDateTime } from './fixtureDateTime';

describe('combineFixtureDateTime (BUG-044)', () => {
  it('applies a kickoff time to the date', () => {
    const result = combineFixtureDateTime(new Date(2026, 9, 18), '10:30');
    expect(result).toEqual(new Date(2026, 9, 18, 10, 30, 0, 0));
  });

  it('an empty time is local midnight, not an Invalid Date', () => {
    const result = combineFixtureDateTime(new Date(2026, 9, 18, 14, 45, 12), '');
    expect(result).toEqual(new Date(2026, 9, 18, 0, 0, 0, 0));
    expect(() => result.toISOString()).not.toThrow();
  });

  it('clears seconds carried over from the source date', () => {
    const result = combineFixtureDateTime(new Date(2026, 9, 18, 9, 0, 37, 500), '11:15');
    expect(result).toEqual(new Date(2026, 9, 18, 11, 15, 0, 0));
  });

  it('does not mutate the date it was given', () => {
    const date = new Date(2026, 9, 18, 9, 0);
    combineFixtureDateTime(date, '');
    expect(date).toEqual(new Date(2026, 9, 18, 9, 0));
  });

  it('throws a readable error for a malformed time rather than producing NaN', () => {
    expect(() => combineFixtureDateTime(new Date(2026, 9, 18), 'ab:cd')).toThrow('Invalid kickoff time "ab:cd"');
    expect(() => combineFixtureDateTime(new Date(2026, 9, 18), '25:00')).toThrow(/Invalid kickoff time/);
  });
});
