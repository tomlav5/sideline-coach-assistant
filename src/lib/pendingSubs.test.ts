import { describe, expect, it } from 'vitest';
import {
  effectiveLineup,
  lockedPlayerIds,
  oldestStagedAt,
  peelLast,
  stagePair,
  type PendingPair,
} from './pendingSubs';

// Deterministic id/clock factories so the stack is fully predictable under test.
function makeStager() {
  let n = 0;
  let clock = 1_000;
  return {
    tick: (ms: number) => {
      clock += ms;
    },
    stage: (stack: PendingPair[], outId: string, inId: string) =>
      stagePair(stack, outId, inId, {
        makeId: () => `id${(n += 1)}`,
        makeEventIds: () => ({ offEventId: `off${n}`, onEventId: `on${n}` }),
        now: () => clock,
      }),
  };
}

describe('stagePair', () => {
  it('appends a pair with the out player, in player and a staged-at stamp', () => {
    const { stage } = makeStager();
    const stack = stage([], 'A', 'X');

    expect(stack).toHaveLength(1);
    expect(stack[0]).toMatchObject({ outId: 'A', inId: 'X', stagedAt: 1_000 });
    expect(stack[0].offEventId).not.toEqual(stack[0].onEventId);
  });

  it('stacks multiple pairs newest-last', () => {
    const { stage } = makeStager();
    let stack = stage([], 'A', 'X');
    stack = stage(stack, 'B', 'Y');
    stack = stage(stack, 'C', 'Z');

    expect(stack.map((p) => [p.outId, p.inId])).toEqual([
      ['A', 'X'],
      ['B', 'Y'],
      ['C', 'Z'],
    ]);
  });

  it('locks out a player already staged on or off, in either direction', () => {
    const { stage } = makeStager();
    let stack = stage([], 'A', 'X');

    // A is already coming off — cannot also bring A on.
    expect(stage(stack, 'B', 'A')).toBe(stack);
    // X is already coming on — cannot also take X off.
    expect(stage(stack, 'X', 'Y')).toBe(stack);
    // A fresh, disjoint pair is fine.
    stack = stage(stack, 'B', 'Y');
    expect(stack).toHaveLength(2);
  });

  it('rejects a no-op or malformed pair', () => {
    const { stage } = makeStager();
    expect(stage([], '', 'X')).toEqual([]);
    expect(stage([], 'A', '')).toEqual([]);
    expect(stage([], 'A', 'A')).toEqual([]);
  });
});

describe('peelLast', () => {
  it('removes the newest pair only, leaving the rest in order', () => {
    const { stage } = makeStager();
    let stack = stage([], 'A', 'X');
    stack = stage(stack, 'B', 'Y');
    stack = stage(stack, 'C', 'Z');

    stack = peelLast(stack);
    expect(stack.map((p) => p.outId)).toEqual(['A', 'B']);

    stack = peelLast(stack);
    expect(stack.map((p) => p.outId)).toEqual(['A']);
  });

  it('is a no-op on an empty stack', () => {
    expect(peelLast([])).toEqual([]);
  });

  it('supports the spec example: stack three, undo twice, one remains', () => {
    const { stage } = makeStager();
    let stack = stage([], 'A', 'X');
    stack = stage(stack, 'B', 'Y');
    stack = stage(stack, 'C', 'Z');

    stack = peelLast(peelLast(stack));

    expect(stack).toHaveLength(1);
    expect(stack[0]).toMatchObject({ outId: 'A', inId: 'X' });
  });
});

describe('lockedPlayerIds', () => {
  it('collects both endpoints of every pending pair', () => {
    const { stage } = makeStager();
    let stack = stage([], 'A', 'X');
    stack = stage(stack, 'B', 'Y');

    expect(lockedPlayerIds(stack)).toEqual(new Set(['A', 'X', 'B', 'Y']));
  });

  it('is empty for an empty stack', () => {
    expect(lockedPlayerIds([]).size).toBe(0);
  });
});

describe('oldestStagedAt', () => {
  it('returns the earliest staged-at across the stack', () => {
    const { stage, tick } = makeStager();
    let stack = stage([], 'A', 'X'); // t=1000
    tick(5_000);
    stack = stage(stack, 'B', 'Y'); // t=6000

    expect(oldestStagedAt(stack)).toBe(1_000);

    // Peeling the newest pair does not change the oldest.
    expect(oldestStagedAt(peelLast(stack))).toBe(1_000);
  });

  it('returns null when nothing is staged', () => {
    expect(oldestStagedAt([])).toBeNull();
  });
});

describe('effectiveLineup', () => {
  const pitch = ['A', 'B', 'C'];
  const bench = ['X', 'Y', 'Z'];

  it('is the committed lineup when nothing is staged', () => {
    expect(effectiveLineup(pitch, bench)).toEqual({
      pitchIds: ['A', 'B', 'C'],
      benchIds: ['X', 'Y', 'Z'],
    });
  });

  it('does not move staged players — everyone holds their committed slot until Submit', () => {
    // FIX 6: a staged pair (B off, X on) leaves B on the pitch and X on the
    // bench, in their original positions. The grid flags them pending; it does
    // not reshuffle until the batch is committed and the lineup reloads.
    expect(effectiveLineup(pitch, bench)).toEqual({
      pitchIds: ['A', 'B', 'C'],
      benchIds: ['X', 'Y', 'Z'],
    });
  });

  it('preserves order and drops duplicates and empty ids', () => {
    expect(effectiveLineup(['A', 'A', 'B', ''], ['X', 'B', 'Y'])).toEqual({
      // 'A' de-duped, '' dropped; 'B' already on the pitch so removed from bench.
      pitchIds: ['A', 'B'],
      benchIds: ['X', 'Y'],
    });
  });
});
