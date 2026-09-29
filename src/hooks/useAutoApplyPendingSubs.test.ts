import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { NO_OPEN_PERIOD_MESSAGE } from '@/lib/submitSubstitutions';
import { useAutoApplyPendingSubs, type AutoApplyPendingSubsArgs } from './useAutoApplyPendingSubs';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// The half-time gap as the tracker sees it: P1 ended, the timer (after a reload
// during the break) still reporting P1 at its full length, two pairs staged.
const halfTime = (over: Partial<AutoApplyPendingSubsArgs> = {}): AutoApplyPendingSubsArgs => ({
  startedPeriodId: null,
  reportedPeriodId: 'p1',
  transitionsSettled: true,
  pendingCount: 2,
  recordingLocked: false,
  submit: vi.fn().mockResolvedValue(undefined),
  onApplied: vi.fn(),
  ...over,
});

// The state once Start Period succeeded and the timer reports P2.
const p2Running = (over: Partial<AutoApplyPendingSubsArgs> = {}) =>
  halfTime({ startedPeriodId: 'p2', reportedPeriodId: 'p2', ...over });

describe('useAutoApplyPendingSubs', () => {
  it('applies the pending pairs once the new period has started and confirms once', async () => {
    const args = p2Running();
    renderHook(() => useAutoApplyPendingSubs(args));

    await waitFor(() => expect(args.onApplied).toHaveBeenCalledWith(2));
    expect(args.submit).toHaveBeenCalledTimes(1);
    expect(args.onApplied).toHaveBeenCalledTimes(1);
  });

  it('applies nothing when the start failed or the claim was refused (no started period)', () => {
    const args = halfTime({ startedPeriodId: null });
    const { rerender } = renderHook((a) => useAutoApplyPendingSubs(a), { initialProps: args });
    rerender({ ...args, reportedPeriodId: null });

    expect(args.submit).not.toHaveBeenCalled();
    expect(args.onApplied).not.toHaveBeenCalled();
  });

  it('applies exactly once — later renders and effect re-runs do not re-apply', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const args = p2Running({ submit });
    const { rerender } = renderHook((a) => useAutoApplyPendingSubs(a), { initialProps: args });
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));

    // A realtime update re-renders; more pairs staged mid-period; the lock and
    // transition flags flicker. None of it may re-apply.
    rerender({ ...args, submit: vi.fn().mockResolvedValue(undefined) });
    rerender({ ...args, pendingCount: 1 });
    rerender({ ...args, transitionsSettled: false });
    rerender({ ...args, transitionsSettled: true, reportedPeriodId: null });
    rerender({ ...args, reportedPeriodId: 'p2' });

    expect(submit).toHaveBeenCalledTimes(1);
    expect(args.onApplied).toHaveBeenCalledTimes(1);
  });

  it("waits for the timer to report the NEW period, so the minute is the new period's", async () => {
    // Each render's submit closes over that render's currentSeconds — record
    // which one is actually used.
    const usedSeconds: number[] = [];
    const submitAt = (currentSeconds: number) =>
      vi.fn(async () => {
        usedSeconds.push(currentSeconds);
      });

    // Start Period succeeded, but the timer still reports P1 at 30:53.
    const { rerender } = renderHook((a) => useAutoApplyPendingSubs(a), {
      initialProps: halfTime({ startedPeriodId: 'p2', reportedPeriodId: 'p1', submit: submitAt(1853) }),
    });
    // Timer briefly reports "no period" (the break) — still not P2.
    rerender(halfTime({ startedPeriodId: 'p2', reportedPeriodId: null, submit: submitAt(0) }));
    expect(usedSeconds).toEqual([]);

    // Now the timer reports P2, three seconds in.
    rerender(halfTime({ startedPeriodId: 'p2', reportedPeriodId: 'p2', submit: submitAt(3) }));

    await waitFor(() => expect(usedSeconds).toEqual([3]));
    expect(Math.floor(usedSeconds[0] / 60)).toBe(0); // time_on_minute
  });

  it('waits for the period-transition effect to finish opening spells', async () => {
    const args = p2Running({ transitionsSettled: false });
    const { rerender } = renderHook((a) => useAutoApplyPendingSubs(a), { initialProps: args });
    expect(args.submit).not.toHaveBeenCalled();

    rerender({ ...args, transitionsSettled: true });
    await waitFor(() => expect(args.submit).toHaveBeenCalledTimes(1));
  });

  it('a failed submit is caught — no confirmation, no retry, nothing thrown', async () => {
    // handleSubmitPendingSubs throws after its own error toast and leaves the
    // pairs staged; the period start is not involved.
    const submit = vi.fn().mockRejectedValue(new Error(NO_OPEN_PERIOD_MESSAGE));
    const args = p2Running({ submit });
    const { rerender } = renderHook((a) => useAutoApplyPendingSubs(a), { initialProps: args });

    await waitFor(() => expect(warnSpy).toHaveBeenCalled());
    rerender({ ...args });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(args.onApplied).not.toHaveBeenCalled();
  });

  it('an empty pending stack makes no submit call and no toast', () => {
    const args = p2Running({ pendingCount: 0 });
    renderHook(() => useAutoApplyPendingSubs(args));

    expect(args.submit).not.toHaveBeenCalled();
    expect(args.onApplied).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('when recording is locked, skips with a console.warn instead of silently', () => {
    const args = p2Running({ recordingLocked: true });
    renderHook(() => useAutoApplyPendingSubs(args));

    expect(args.submit).not.toHaveBeenCalled();
    expect(args.onApplied).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('recording is locked'));
  });
});
