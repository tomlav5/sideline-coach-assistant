import { describe, expect, it } from 'vitest';
import { canActOnMatch, deriveTrackerHolder } from './trackerGate';

const SELF = { isActiveTracker: true };
const OTHER = { isActiveTracker: false };

describe('deriveTrackerHolder', () => {
  it('is nobody only once the fixture has been read and no tracker was found', () => {
    expect(deriveTrackerHolder(true, null)).toBe('nobody');
  });

  it('is self when the read is done and this user holds the match', () => {
    expect(deriveTrackerHolder(true, SELF)).toBe('self');
  });

  it('is other when the read is done and another user holds the match', () => {
    expect(deriveTrackerHolder(true, OTHER)).toBe('other');
  });

  it('is unknown before the read completes, even though local tracker state is null', () => {
    // The fail-open case: a null tracker before the first read is "we do not know
    // yet", not "nobody holds it".
    expect(deriveTrackerHolder(false, null)).toBe('unknown');
  });

  it('is unknown before the read completes whatever the local tracker state says', () => {
    expect(deriveTrackerHolder(false, SELF)).toBe('unknown');
    expect(deriveTrackerHolder(false, OTHER)).toBe('unknown');
  });
});

describe('canActOnMatch', () => {
  it('permits the tracker', () => {
    expect(canActOnMatch('self')).toBe(true);
  });

  // The recovery path: a tracker's phone dies, their claim lapses, active_tracker_id
  // goes NULL — every club official must be able to act. Mirrors restart_match.
  it('permits anyone when nobody holds the match', () => {
    expect(canActOnMatch('nobody')).toBe(true);
  });

  it('blocks a non-tracker while another user holds the match', () => {
    expect(canActOnMatch('other')).toBe(false);
  });

  it('fails closed while the holder is unknown', () => {
    expect(canActOnMatch('unknown')).toBe(false);
  });
});

describe('gate, end to end (resolved × local tracker state)', () => {
  it.each([
    // resolved, tracker,  can act
    [false, null, false], // loading / failed read — the old `!matchTracker` allowed this
    [false, SELF, false],
    [false, OTHER, false],
    [true, null, true], // active_tracker_id IS NULL — regression: officials must act
    [true, SELF, true],
    [true, OTHER, false], // account B while account A tracks
  ])('resolved=%s tracker=%j → canAct=%s', (resolved, tracker, expected) => {
    expect(canActOnMatch(deriveTrackerHolder(resolved, tracker))).toBe(expected);
  });
});
