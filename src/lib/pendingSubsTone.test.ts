import { describe, expect, it } from 'vitest';
import { breakSubmitToast, pendingSubsTone } from './pendingSubsTone';
import { isPeriodOpen } from './periodOpen';

// The three shapes a period row takes on the live screen. Pausing sets
// is_active = false and pause_time; only ending sets actual_end_time.
const running = { id: 'p2', is_active: true, pause_time: null, actual_end_time: null };
const paused = { id: 'p2', is_active: false, pause_time: '2026-10-11T10:40:00Z', actual_end_time: null };
const ended = { id: 'p2', is_active: false, pause_time: null, actual_end_time: '2026-10-11T10:45:00Z' };

describe('pendingSubsTone (UX-043)', () => {
  it('mid-period, under 60s: pending', () => {
    expect(pendingSubsTone(59, isPeriodOpen(running))).toBe('pending');
  });

  it('mid-period, 60s and over: still critical — the escalation is kept', () => {
    expect(pendingSubsTone(60, isPeriodOpen(running))).toBe('critical');
    expect(pendingSubsTone(600, isPeriodOpen(running))).toBe('critical');
  });

  it('PAUSED mid-period counts as open: still escalates past 60s (is_active is false here)', () => {
    expect(paused.is_active).toBe(false);
    expect(pendingSubsTone(75, isPeriodOpen(paused))).toBe('critical');
  });

  it('during a break (period ended): never critical, however long the wait', () => {
    expect(pendingSubsTone(75, isPeriodOpen(ended))).toBe('break');
    expect(pendingSubsTone(3600, isPeriodOpen(ended))).toBe('break');
  });

  it('with no period at all (before kick-off, or the timer cleared it): break', () => {
    expect(pendingSubsTone(75, isPeriodOpen(undefined))).toBe('break');
    expect(pendingSubsTone(75, isPeriodOpen(null))).toBe('break');
  });
});

describe('breakSubmitToast (UX-043)', () => {
  it('reads as confirmation and points at Start Period, never "half time"', () => {
    const t = breakSubmitToast(3);
    expect(t.title).toBe('Ready for the next period');
    expect(t.description).toContain('3 substitutions are saved');
    expect(t.description).toContain('Start Period');
    expect(`${t.title} ${t.description}`.toLowerCase()).not.toMatch(/half|only|can't|cannot|not /);
  });

  it('singular', () => {
    expect(breakSubmitToast(1).description).toContain('Your substitution is saved');
  });
});
