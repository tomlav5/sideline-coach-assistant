import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FakeState } from '@/test/fakeSupabase';
import { writes } from '@/test/fakeSupabase';
import { openSpellsForNewPeriod } from './openPeriodSpells';

const fake = vi.hoisted(
  (): FakeState => ({ calls: [], respond: () => ({ data: null, error: null }) }),
);

vi.mock('@/integrations/supabase/client', async () =>
  (await import('@/test/fakeSupabase')).fakeSupabaseModule(fake),
);

function useWorld(period: Record<string, unknown>) {
  fake.respond = (call) => {
    if (call.table === 'match_periods') return { data: period, error: null };
    if (call.table === 'player_match_status') {
      return { data: [{ player_id: 'a' }, { player_id: 'b' }], error: null };
    }
    if (call.table === 'player_time_logs' && call.op === 'select') return { data: [], error: null };
    return { data: null, error: null };
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fake.calls = [];
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openSpellsForNewPeriod — period-transition step 2 (BUG-041)', () => {
  it('inserts nothing and warns when the resolved period has already ended', async () => {
    useWorld({ id: 'p2', period_number: 2, actual_end_time: '2026-09-27T15:05:00Z' });

    await openSpellsForNewPeriod('fx', 2, 0);

    expect(writes(fake)).toEqual([]);
    expect(fake.calls.some((c) => c.table === 'player_match_status')).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('BUG-041'));
  });

  it('opens a starter spell for each on-field player when the period is running', async () => {
    useWorld({ id: 'p2', period_number: 2, actual_end_time: null, is_active: true });

    await openSpellsForNewPeriod('fx', 2, 0);

    const inserts = writes(fake);
    expect(inserts).toHaveLength(2);
    for (const [i, player] of ['a', 'b'].entries()) {
      expect(inserts[i]).toMatchObject({ table: 'player_time_logs', op: 'insert' });
      expect(inserts[i].payload).toMatchObject({
        fixture_id: 'fx',
        player_id: player,
        period_id: 'p2',
        time_on_minute: 0,
        is_starter: true,
        is_active: true,
      });
    }
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
