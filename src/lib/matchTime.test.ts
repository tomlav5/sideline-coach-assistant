import { describe, expect, it } from 'vitest';
import { calculateCurrentPeriodTime, calculateTotalMatchTime, type MatchPeriod } from './matchTime';

const NOW = new Date('2026-08-23T12:00:00.000Z').getTime();

const basePeriod: MatchPeriod = {
  id: 'p1',
  fixture_id: 'f1',
  period_number: 1,
  period_type: 'period',
  planned_duration_minutes: 30,
  is_active: true,
  total_paused_seconds: 0,
};

describe('calculateCurrentPeriodTime', () => {
  // Protects the on-pitch timer from freezing or drifting on a device left running.
  it('returns elapsed seconds for a running period with no pauses', () => {
    const period: MatchPeriod = {
      ...basePeriod,
      actual_start_time: new Date(NOW - 600_000).toISOString(),
    };
    expect(calculateCurrentPeriodTime(period, NOW)).toBe(600);
  });

  // Protects against paused time being counted toward the visible match clock.
  it('subtracts total_paused_seconds from a running period', () => {
    const period: MatchPeriod = {
      ...basePeriod,
      actual_start_time: new Date(NOW - 600_000).toISOString(),
      total_paused_seconds: 120,
    };
    expect(calculateCurrentPeriodTime(period, NOW)).toBe(480);
  });

  // Protects a paused clock from silently ticking forward using the current wall-clock time.
  it('freezes at pause_time for a paused period, minus total_paused_seconds', () => {
    const start = NOW - 500_000;
    const period: MatchPeriod = {
      ...basePeriod,
      is_active: false,
      actual_start_time: new Date(start).toISOString(),
      pause_time: new Date(start + 300_000).toISOString(),
      total_paused_seconds: 50,
    };
    expect(calculateCurrentPeriodTime(period, NOW)).toBe(250);
  });

  // Protects a completed period's recorded duration from changing after the period has ended.
  it('freezes at actual_end_time for an ended period, minus total_paused_seconds', () => {
    const start = NOW - 500_000;
    const period: MatchPeriod = {
      ...basePeriod,
      is_active: false,
      actual_start_time: new Date(start).toISOString(),
      actual_end_time: new Date(start + 400_000).toISOString(),
      total_paused_seconds: 30,
    };
    expect(calculateCurrentPeriodTime(period, NOW)).toBe(370);
  });

  // Protects against a crash or a bogus non-zero time when a period hasn't actually started yet.
  it('returns 0 when the period has no actual_start_time', () => {
    const period: MatchPeriod = { ...basePeriod, actual_start_time: undefined };
    expect(calculateCurrentPeriodTime(period, NOW)).toBe(0);
    expect(calculateCurrentPeriodTime(undefined, NOW)).toBe(0);
  });
});

describe('calculateTotalMatchTime', () => {
  // Protects the total match clock (used for player playing-time and reports) from
  // dropping or double-counting time across a multi-period match.
  it('sums two completed periods plus the running current period', () => {
    const period1: MatchPeriod = {
      ...basePeriod,
      id: 'p1',
      is_active: false,
      actual_start_time: new Date(NOW - 3_000_000).toISOString(),
      actual_end_time: new Date(NOW - 3_000_000 + 900_000).toISOString(), // 900s period
      total_paused_seconds: 0,
    };
    const period2: MatchPeriod = {
      ...basePeriod,
      id: 'p2',
      period_number: 2,
      is_active: false,
      actual_start_time: new Date(NOW - 1_800_000).toISOString(),
      actual_end_time: new Date(NOW - 1_800_000 + 850_000).toISOString(), // 850s period
      total_paused_seconds: 50, // -> 800s
    };
    const period3: MatchPeriod = {
      ...basePeriod,
      id: 'p3',
      period_number: 3,
      is_active: true,
      actual_start_time: new Date(NOW - 600_000).toISOString(), // running, 600s so far
    };

    const currentPeriodSeconds = calculateCurrentPeriodTime(period3, NOW);
    const total = calculateTotalMatchTime([period1, period2, period3], period3.id, currentPeriodSeconds);

    expect(total).toBe(900 + 800 + 600);
  });
});
