import { describe, expect, it } from 'vitest';
import { hasExistingPlayerTimeLog } from './playerTimeLogDedup';

describe('hasExistingPlayerTimeLog', () => {
  const existing = [
    { player_id: 'p1', period_id: 'period-1' },
    { player_id: 'p2', period_id: 'period-1' },
  ];

  it('finds a match on the same player and period', () => {
    expect(hasExistingPlayerTimeLog(existing, 'p1', 'period-1')).toBe(true);
  });

  it('is not fooled by the same player in a different period', () => {
    expect(hasExistingPlayerTimeLog(existing, 'p1', 'period-2')).toBe(false);
  });

  it('is not fooled by a different player in the same period', () => {
    expect(hasExistingPlayerTimeLog(existing, 'p3', 'period-1')).toBe(false);
  });

  it('returns false against an empty list', () => {
    expect(hasExistingPlayerTimeLog([], 'p1', 'period-1')).toBe(false);
  });
});
