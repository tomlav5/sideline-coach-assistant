import { describe, expect, it } from 'vitest';
import {
  playerMinutesPlayed,
  summarisePlayerMinutes,
  type PlayerTimeLogRow,
} from './playerMinutes';

const P1 = 'period-1';
const P2 = 'period-2';

function log(overrides: Partial<PlayerTimeLogRow>): PlayerTimeLogRow {
  return {
    player_id: 'p1',
    time_on_minute: 0,
    time_off_minute: null,
    is_active: true,
    period_id: P1,
    ...overrides,
  };
}

describe('summarisePlayerMinutes', () => {
  it('returns an empty map for no logs', () => {
    expect(summarisePlayerMinutes([], P1)).toEqual({});
  });

  it('records an open interval in the current period as a live on-minute', () => {
    const summary = summarisePlayerMinutes(
      [log({ player_id: 'p1', time_on_minute: 5, is_active: true, period_id: P1 })],
      P1,
    );
    expect(summary.p1).toEqual({
      closedMinutes: 0,
      openOnMinute: 5,
      isActiveNow: true,
    });
  });

  it('sums a closed interval as its duration', () => {
    const summary = summarisePlayerMinutes(
      [log({ time_on_minute: 4, time_off_minute: 22, is_active: false })],
      P1,
    );
    expect(summary.p1.closedMinutes).toBe(18);
    expect(summary.p1.isActiveNow).toBe(false);
  });

  it('clamps a closed interval with time_off before time_on to zero', () => {
    const summary = summarisePlayerMinutes(
      [log({ time_on_minute: 30, time_off_minute: 25, is_active: false })],
      P1,
    );
    expect(summary.p1.closedMinutes).toBe(0);
  });

  it('treats a null time_on_minute on a closed interval as 0', () => {
    const summary = summarisePlayerMinutes(
      [log({ time_on_minute: null, time_off_minute: 12, is_active: false })],
      P1,
    );
    expect(summary.p1.closedMinutes).toBe(12);
  });

  it('ignores an open interval left behind in a past period', () => {
    const summary = summarisePlayerMinutes(
      [log({ time_on_minute: 3, is_active: true, period_id: P1 })],
      P2,
    );
    expect(summary.p1).toEqual({
      closedMinutes: 0,
      openOnMinute: null,
      isActiveNow: false,
    });
  });

  it('sums closed intervals across every period', () => {
    const summary = summarisePlayerMinutes(
      [
        log({ time_on_minute: 0, time_off_minute: 25, is_active: false, period_id: P1 }),
        log({ time_on_minute: 0, time_off_minute: 10, is_active: false, period_id: P2 }),
      ],
      P2,
    );
    expect(summary.p1.closedMinutes).toBe(35);
  });

  it('combines a closed past interval with an open current-period interval', () => {
    const summary = summarisePlayerMinutes(
      [
        log({ time_on_minute: 0, time_off_minute: 25, is_active: false, period_id: P1 }),
        log({ time_on_minute: 0, is_active: true, period_id: P2 }),
      ],
      P2,
    );
    expect(summary.p1).toEqual({
      closedMinutes: 25,
      openOnMinute: 0,
      isActiveNow: true,
    });
  });

  it('returns no isActiveNow player when every log is a closed interval from a past period', () => {
    const summary = summarisePlayerMinutes(
      [
        log({ player_id: 'p1', time_on_minute: 0, time_off_minute: 25, is_active: false, period_id: P1 }),
        log({ player_id: 'p2', time_on_minute: 0, time_off_minute: 30, is_active: false, period_id: P1 }),
      ],
      P2,
    );
    expect(Object.values(summary).some((s) => s.isActiveNow)).toBe(false);
  });

  it('treats every interval as closed when currentPeriodId is null (between periods, BUG-012)', () => {
    const summary = summarisePlayerMinutes(
      [
        // p1: a banked first-half interval plus an interval still open from the
        // period that just ended (close-writes not landed yet).
        log({ player_id: 'p1', time_on_minute: 0, time_off_minute: 20, is_active: false, period_id: P1 }),
        log({ player_id: 'p1', time_on_minute: 20, is_active: true, period_id: P1 }),
        // p2: a plain closed interval.
        log({ player_id: 'p2', time_on_minute: 5, time_off_minute: 30, is_active: false, period_id: P1 }),
      ],
      null,
    );
    expect(summary.p1).toEqual({
      closedMinutes: 20,
      openOnMinute: null,
      isActiveNow: false,
    });
    expect(summary.p2.closedMinutes).toBe(25);
    expect(Object.values(summary).some((s) => s.isActiveNow)).toBe(false);
  });

  it('takes the earliest on-minute if two open intervals exist in the current period', () => {
    const summary = summarisePlayerMinutes(
      [
        log({ time_on_minute: 8, is_active: true, period_id: P1 }),
        log({ time_on_minute: 3, is_active: true, period_id: P1 }),
      ],
      P1,
    );
    expect(summary.p1.openOnMinute).toBe(3);
  });
});

describe('playerMinutesPlayed', () => {
  it('returns 0 for an unknown player', () => {
    expect(playerMinutesPlayed(undefined, 600)).toBe(0);
  });

  it('returns the closed total when there is no open interval', () => {
    expect(
      playerMinutesPlayed(
        { closedMinutes: 18, openOnMinute: null, isActiveNow: false },
        600,
      ),
    ).toBe(18);
  });

  it('accrues the open interval from the current period seconds', () => {
    // 12:30 into the period, came on at minute 5 => 7 minutes and counting.
    expect(
      playerMinutesPlayed(
        { closedMinutes: 0, openOnMinute: 5, isActiveNow: true },
        12 * 60 + 30,
      ),
    ).toBe(7);
  });

  it('never returns a negative number when the clock is behind the on-minute', () => {
    expect(
      playerMinutesPlayed(
        { closedMinutes: 0, openOnMinute: 10, isActiveNow: true },
        30,
      ),
    ).toBe(0);
  });

  it('adds the closed total and the live open interval together', () => {
    expect(
      playerMinutesPlayed(
        { closedMinutes: 25, openOnMinute: 0, isActiveNow: true },
        6 * 60,
      ),
    ).toBe(31);
  });

  it('holds the half-time total instead of resetting to 0 (BUG-007)', () => {
    // 25 minutes banked in the first half; 30 seconds into the second half the
    // open interval contributes 0 — the tile must still read 25, not 0.
    expect(
      playerMinutesPlayed(
        { closedMinutes: 25, openOnMinute: 0, isActiveNow: true },
        30,
      ),
    ).toBe(25);
  });

  it('guards against NaN and negative second counts', () => {
    const summary = { closedMinutes: 10, openOnMinute: 0, isActiveNow: true };
    expect(playerMinutesPlayed(summary, Number.NaN)).toBe(10);
    expect(playerMinutesPlayed(summary, -120)).toBe(10);
  });
});
