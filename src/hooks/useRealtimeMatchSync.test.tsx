import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useRealtimeMatchSync } from './useRealtimeMatchSync';

// trackerHolder is what the control gate reads. What matters here is WHEN it becomes
// `nobody`: only after the fixtures read has succeeded and found active_tracker_id
// NULL. Each read hangs on its own promise so a test decides when it resolves.
const mocks = vi.hoisted(() => ({
  pendingReads: [] as Array<(result: unknown) => void>,
  user: { id: 'me' } as { id: string } | null,
  // What claim_match_tracking (the only rpc these tests exercise) returns.
  rpcResult: { data: null, error: null } as { data: unknown; error: unknown },
}));

vi.mock('@/integrations/supabase/client', () => {
  interface FakeChannel {
    on: () => FakeChannel;
    subscribe: () => FakeChannel;
  }
  const channel: FakeChannel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: mocks.user } }) },
      channel: () => channel,
      removeChannel: () => {},
      rpc: () => Promise.resolve(mocks.rpcResult),
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () =>
              new Promise((resolve) => {
                mocks.pendingReads.push(resolve);
              }),
          }),
        }),
      }),
    },
  };
});

const client = new QueryClient();
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const fixtureRow = (active_tracker_id: string | null) => ({
  data: {
    active_tracker_id,
    tracking_started_at: active_tracker_id ? '2026-09-20T10:00:00Z' : null,
    match_status: 'in_progress',
    status: 'in_progress',
  },
  error: null,
});

const settleNextRead = async (result: unknown) => {
  await act(async () => {
    mocks.pendingReads.shift()!(result);
  });
};

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks.pendingReads.length = 0;
  mocks.user = { id: 'me' };
  mocks.rpcResult = { data: null, error: null };
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useRealtimeMatchSync › trackerHolder', () => {
  it('is unknown until the fixture read completes — a null matchTracker is not "nobody"', () => {
    const { result } = renderHook(() => useRealtimeMatchSync('fx1'), { wrapper });

    expect(result.current.matchTracker).toBeNull();
    expect(result.current.trackerHolder).toBe('unknown');
  });

  it('is nobody once the read finds active_tracker_id NULL (officials must be able to act)', async () => {
    const { result } = renderHook(() => useRealtimeMatchSync('fx1'), { wrapper });

    await settleNextRead(fixtureRow(null));

    await waitFor(() => expect(result.current.trackerHolder).toBe('nobody'));
    expect(result.current.matchTracker).toBeNull();
  });

  it('is other when another user holds the match (account B while account A tracks)', async () => {
    const { result } = renderHook(() => useRealtimeMatchSync('fx1'), { wrapper });

    await settleNextRead(fixtureRow('account-a'));

    await waitFor(() => expect(result.current.trackerHolder).toBe('other'));
    expect(result.current.matchTracker?.isActiveTracker).toBe(false);
  });

  it('is self when this user holds the match', async () => {
    const { result } = renderHook(() => useRealtimeMatchSync('fx1'), { wrapper });

    await settleNextRead(fixtureRow('me'));

    await waitFor(() => expect(result.current.trackerHolder).toBe('self'));
  });

  it('stays unknown if the read fails — fails closed, does not fall through to nobody', async () => {
    const { result } = renderHook(() => useRealtimeMatchSync('fx1'), { wrapper });

    await settleNextRead({ data: null, error: { message: 'network down' } });

    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(result.current.matchTracker).toBeNull();
    expect(result.current.trackerHolder).toBe('unknown');
  });

  it('is other, not self or nobody, when a tracker exists but there is no signed-in user', async () => {
    mocks.user = null;
    const { result } = renderHook(() => useRealtimeMatchSync('fx1'), { wrapper });

    await settleNextRead(fixtureRow('account-a'));

    await waitFor(() => expect(result.current.trackerHolder).toBe('other'));
  });

  it('goes back to unknown when the fixture changes, until the new fixture has been read', async () => {
    const { result, rerender } = renderHook(({ id }) => useRealtimeMatchSync(id), {
      wrapper,
      initialProps: { id: 'fx1' },
    });
    await settleNextRead(fixtureRow(null));
    await waitFor(() => expect(result.current.trackerHolder).toBe('nobody'));

    rerender({ id: 'fx2' });

    expect(result.current.trackerHolder).toBe('unknown');
    await settleNextRead(fixtureRow('account-a'));
    await waitFor(() => expect(result.current.trackerHolder).toBe('other'));
  });
});

// Claim-on-start relies on these: Start Period claims, and proceeds only if the claim
// returns true. A refusal must also leave local state saying who really holds the match,
// otherwise the refused user is left with an enabled button and an "available" banner.
describe('useRealtimeMatchSync › claimMatchTracking', () => {
  const settledAsNobody = async () => {
    const hook = renderHook(() => useRealtimeMatchSync('fx1'), { wrapper });
    await settleNextRead(fixtureRow(null));
    await waitFor(() => expect(hook.result.current.trackerHolder).toBe('nobody'));
    return hook;
  };
  const claim = async (result: { current: ReturnType<typeof useRealtimeMatchSync> }) => {
    let claimed: boolean | undefined;
    await act(async () => {
      claimed = await result.current.claimMatchTracking();
    });
    return claimed;
  };

  it('succeeds → true, and the holder becomes self', async () => {
    const { result } = await settledAsNobody();
    mocks.rpcResult = {
      data: { success: true, tracker_id: 'me', tracking_started_at: '2026-09-21T10:00:00Z' },
      error: null,
    };

    expect(await claim(result)).toBe(true);
    expect(result.current.trackerHolder).toBe('self');
  });

  it('refused because someone else holds it → false, and local state now says other, not nobody', async () => {
    const { result } = await settledAsNobody();
    mocks.rpcResult = {
      data: {
        success: false,
        error: 'Match is already being tracked',
        current_tracker: 'account-a',
        tracking_started_at: '2026-09-21T09:58:00Z',
      },
      error: null,
    };

    expect(await claim(result)).toBe(false);
    // The gate and banner now agree with the server: Start Period disables, banner names a tracker.
    expect(result.current.trackerHolder).toBe('other');
    expect(result.current.matchTracker?.isActiveTracker).toBe(false);
  });

  it('an rpc error → false, and local state is NOT changed — we do not know who holds it', async () => {
    const { result } = await settledAsNobody();
    mocks.rpcResult = { data: null, error: { message: 'network down' } };

    expect(await claim(result)).toBe(false);
    expect(result.current.trackerHolder).toBe('nobody');
  });

  it('nothing claims by itself: settling as nobody makes no claim', async () => {
    const { result } = await settledAsNobody();

    // No rpc result was ever set up, and the holder is still nobody — the permissive
    // case is untouched by the existence of claim-on-start.
    expect(result.current.trackerHolder).toBe('nobody');
    expect(result.current.matchTracker).toBeNull();
  });
});
