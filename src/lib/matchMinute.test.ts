import { describe, expect, it } from 'vitest';
import { matchMinuteInProgress } from './matchMinute';

// Pins the football minute convention for event timestamps (DEBT-003): there is
// no minute zero, and the minute recorded is the one in progress, not the one
// just completed. getCurrentMinute / getTotalMatchMinute in useEnhancedMatchTimer
// feed match_events.minute_in_period / total_match_minute through this function.
describe('matchMinuteInProgress', () => {
  const min = (m: number, s = 0) => m * 60 + s;

  // Kick-off: the match is in its 1st minute from the first whistle, not minute 0.
  it('treats 0:00 as the 1st minute', () => {
    expect(matchMinuteInProgress(min(0, 0))).toBe(1);
  });

  // A goal 30 seconds in is a 1st-minute goal, not a 0th-minute goal.
  it('treats 0:30 as the 1st minute', () => {
    expect(matchMinuteInProgress(min(0, 30))).toBe(1);
  });

  // Still inside the first 60 seconds, still the 1st minute.
  it('treats 0:59 as the 1st minute', () => {
    expect(matchMinuteInProgress(min(0, 59))).toBe(1);
  });

  // The 1st minute is complete; play is now in the 2nd minute.
  it('rolls to the 2nd minute at exactly 1:00', () => {
    expect(matchMinuteInProgress(min(1, 0))).toBe(2);
  });

  // The canonical case from the DEBT-003 brief: 34:47 is a 35th-minute goal.
  it('treats 34:47 as the 35th minute', () => {
    expect(matchMinuteInProgress(min(34, 47))).toBe(35);
  });

  // Half-time on the whole minute: 45:00 is the first instant of the 46th minute
  // under the half-open-interval convention (minute n = [(n-1):00, n:00)).
  it('treats 45:00 as the 46th minute', () => {
    expect(matchMinuteInProgress(min(45, 0))).toBe(46);
  });

  // Guard: calculateCurrentPeriodTime can briefly return a small negative if
  // paused seconds outrun elapsed time. The match is always in at least minute 1.
  it('clamps negative and non-finite input to the 1st minute', () => {
    expect(matchMinuteInProgress(-5)).toBe(1);
    expect(matchMinuteInProgress(NaN)).toBe(1);
  });
});
