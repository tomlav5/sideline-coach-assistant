import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { FakeCall, FakeResult, FakeState } from '@/test/fakeSupabase';
import { writes } from '@/test/fakeSupabase';
import { usePendingSubs } from '@/hooks/usePendingSubs';
import {
  NO_OPEN_PERIOD_MESSAGE,
  NoOpenPeriodError,
  resolveCurrentPeriod,
  submitSubstitutions,
} from './submitSubstitutions';

const fake = vi.hoisted(
  (): FakeState => ({ calls: [], respond: () => ({ data: null, error: null }) }),
);

vi.mock('@/integrations/supabase/client', async () =>
  (await import('@/test/fakeSupabase')).fakeSupabaseModule(fake),
);
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }));

const ENDED = '2026-09-27T14:31:32Z';

// The three candidate lookups resolveCurrentPeriod makes, as rows.
interface Periods {
  active?: Record<string, unknown> | null;
  currentPeriodId?: string | null;
  byId?: Record<string, unknown> | null;
  latest?: Record<string, unknown> | null;
}

const none: FakeResult = { data: null, error: { code: 'PGRST116' } };

function periodLookups(p: Periods) {
  return (call: FakeCall): FakeResult | undefined => {
    if (call.table === 'match_periods' && call.op === 'select') {
      if (call.filters.is_active === true) return p.active ? { data: p.active, error: null } : none;
      if ('id' in call.filters) return p.byId ? { data: p.byId, error: null } : none;
      if (call.ordered) return p.latest ? { data: p.latest, error: null } : none;
    }
    if (call.table === 'fixtures' && call.op === 'select') {
      return { data: { current_period_id: p.currentPeriodId ?? null }, error: null };
    }
    return undefined;
  };
}

/** Period lookups as given; every other query succeeds with an empty/ok result. */
function useWorld(p: Periods) {
  const lookups = periodLookups(p);
  fake.respond = (call) => {
    const hit = lookups(call);
    if (hit) return hit;
    if (call.table === 'player_match_status') return { data: [{ id: 'pms' }], error: null };
    if (call.table === 'player_time_logs' && call.op === 'select') {
      // The incoming player's active-log read is maybeSingle(): no row is null.
      return { data: call.filters.is_active === true ? null : [], error: null };
    }
    if (call.table === 'player_time_logs' && call.op === 'insert') {
      return { data: { id: 'new-log' }, error: null };
    }
    return { data: null, error: null };
  };
}

const pair = {
  id: 'pair-1',
  playerOut: 'peter',
  playerIn: 'conor',
  offEventId: 'off-1',
  onEventId: 'on-1',
};

const submit = (currentSeconds = 0) =>
  submitSubstitutions({
    fixtureId: 'fx',
    pairs: [pair],
    currentMinute: 1,
    totalMatchMinute: 31,
    currentSeconds,
  });

beforeEach(() => {
  fake.calls = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveCurrentPeriod (BUG-041)', () => {
  it('returns the active period when one exists', async () => {
    useWorld({ active: { id: 'p2', actual_end_time: null, is_active: true } });
    expect(await resolveCurrentPeriod('fx')).toMatchObject({ id: 'p2' });
  });

  it('returns null when the only candidates have ended — the half-time gap', async () => {
    // Production 27 Sep: P1 ended, P2 not yet started. current_period_id still
    // points at P1 and P1 is also the latest period.
    const p1 = { id: 'p1', period_number: 1, is_active: false, actual_end_time: ENDED };
    useWorld({ active: null, currentPeriodId: 'p1', byId: p1, latest: p1 });
    expect(await resolveCurrentPeriod('fx')).toBeNull();
  });

  it('fallback 1 still returns a running period (paused: is_active false, no end time)', async () => {
    const paused = {
      id: 'p1',
      is_active: false,
      pause_time: '2026-09-27T14:10:00Z',
      actual_end_time: null,
    };
    useWorld({ active: null, currentPeriodId: 'p1', byId: paused, latest: null });
    expect(await resolveCurrentPeriod('fx')).toMatchObject({ id: 'p1' });
  });

  it('fallback 2 still returns a running period when current_period_id is missing', async () => {
    const running = { id: 'p2', period_number: 2, is_active: false, actual_end_time: null };
    useWorld({ active: null, currentPeriodId: null, latest: running });
    expect(await resolveCurrentPeriod('fx')).toMatchObject({ id: 'p2' });
  });

  it('fallback 2 still returns a running period when fallback 1 points at an ended one', async () => {
    const p1 = { id: 'p1', period_number: 1, actual_end_time: ENDED };
    const p2 = { id: 'p2', period_number: 2, is_active: false, actual_end_time: null };
    useWorld({ active: null, currentPeriodId: 'p1', byId: p1, latest: p2 });
    expect(await resolveCurrentPeriod('fx')).toMatchObject({ id: 'p2' });
  });
});

describe('submitSubstitutions with no open period (BUG-041)', () => {
  beforeEach(() => {
    const p1 = { id: 'p1', period_number: 1, actual_end_time: ENDED };
    useWorld({ active: null, currentPeriodId: 'p1', byId: p1, latest: p1 });
  });

  it('returns the "start the next period" error and writes NOTHING', async () => {
    const result = await submit();
    expect(result.error).toBeInstanceOf(NoOpenPeriodError);
    expect((result.error as Error).message).toBe(NO_OPEN_PERIOD_MESSAGE);
    expect(result.committedPairIds).toEqual([]);
    expect(result.failedPairId).toBeUndefined();
    expect(writes(fake)).toEqual([]);
  });

  it('leaves every staged pair pending, so the same pairs can be submitted later', async () => {
    const { result: hook } = renderHook(() => usePendingSubs());
    act(() => hook.current.selectPitchPlayer('peter'));
    act(() => hook.current.completePairWithBench('conor'));
    act(() => hook.current.selectPitchPlayer('ann'));
    act(() => hook.current.completePairWithBench('bea'));
    const staged = hook.current.stack;
    expect(staged).toHaveLength(2);

    const result = await submitSubstitutions({
      fixtureId: 'fx',
      pairs: staged.map((p) => ({
        id: p.id,
        playerOut: p.outId,
        playerIn: p.inId,
        offEventId: p.offEventId,
        onEventId: p.onEventId,
      })),
      currentMinute: 1,
      totalMatchMinute: 31,
      currentSeconds: 0,
    });
    // What handleSubmitPendingSubs does with the result.
    act(() => hook.current.removeCommitted(result.committedPairIds));

    expect(result.error).toBeInstanceOf(NoOpenPeriodError);
    expect(hook.current.stack).toEqual(staged);
  });
});

describe('submitSubstitutions into a running period', () => {
  it('writes into a paused period found by fallback 1, crediting minute 0 in the first minute', async () => {
    // A substitution genuinely made in the first minute of a live period is
    // credited from minute 0 — durationMinute is not guarded.
    const paused = { id: 'p2', is_active: false, actual_end_time: null };
    useWorld({ active: null, currentPeriodId: 'p2', byId: paused, latest: paused });

    const result = await submit(45);

    expect(result.error).toBeUndefined();
    expect(result.committedPairIds).toEqual(['pair-1']);
    const inRow = writes(fake).find(
      (c) =>
        c.table === 'player_time_logs' &&
        c.op === 'insert' &&
        (c.payload as { player_id: string }).player_id === 'conor',
    );
    expect(inRow?.payload).toMatchObject({ period_id: 'p2', time_on_minute: 0, is_starter: false });
  });
});
